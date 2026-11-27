import "server-only";
import { country } from "@/lib/countries";

export interface VatCheckResult {
  /** number passes the country's format rules */
  formatValid: boolean;
  /** confirmed by VIES / HMRC */
  verified: boolean;
  /** true when the online service could not be reached / used */
  offline: boolean;
  normalized: string;
  name?: string | null;
  address?: string | null;
  message?: string;
}

// Format patterns for the national part (without the country prefix).
const PATTERNS: Record<string, RegExp> = {
  GB: /^(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
  AT: /^U\d{8}$/,
  BE: /^[01]\d{9}$/,
  BG: /^\d{9,10}$/,
  CY: /^\d{8}[A-Z]$/,
  CZ: /^\d{8,10}$/,
  DE: /^\d{9}$/,
  DK: /^\d{8}$/,
  EE: /^\d{9}$/,
  EL: /^\d{9}$/,
  ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^\d{8}$/,
  FR: /^[A-HJ-NP-Z0-9]{2}\d{9}$/,
  HR: /^\d{11}$/,
  HU: /^\d{8}$/,
  IE: /^(\d{7}[A-W][A-I]?|\d[A-Z+*]\d{5}[A-W])$/,
  IT: /^\d{11}$/,
  LT: /^(\d{9}|\d{12})$/,
  LU: /^\d{8}$/,
  LV: /^\d{11}$/,
  MT: /^\d{8}$/,
  NL: /^\d{9}B\d{2}$/,
  PL: /^\d{10}$/,
  PT: /^\d{9}$/,
  RO: /^\d{2,10}$/,
  SE: /^\d{12}$/,
  SI: /^\d{8}$/,
  SK: /^\d{10}$/,
  XI: /^(\d{9}|\d{12})$/,
};

/** Split "DE123456789" / "123456789" (+ country) into prefix + national number. */
export function normalizeVat(raw: string, countryCode: string) {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9+*]/g, "");
  const info = country(countryCode);
  const expected = info?.vatPrefix ?? countryCode.toUpperCase();
  let prefix = expected;
  let national = cleaned;
  if (/^[A-Z]{2}/.test(cleaned) && (PATTERNS[cleaned.slice(0, 2)] || cleaned.slice(0, 2) === expected)) {
    prefix = cleaned.slice(0, 2);
    national = cleaned.slice(2);
  }
  if (prefix === "GR") prefix = "EL";
  return { prefix, national, full: prefix + national };
}

export function checkVatFormat(raw: string, countryCode: string) {
  const { prefix, national, full } = normalizeVat(raw, countryCode);
  const re = PATTERNS[prefix];
  return { valid: re ? re.test(national) : national.length >= 6, prefix, national, full };
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

export async function verifyVat(raw: string, countryCode: string): Promise<VatCheckResult> {
  const f = checkVatFormat(raw, countryCode);
  const base = { formatValid: f.valid, normalized: f.full };
  if (!f.valid) return { ...base, verified: false, offline: false, message: "format" };

  try {
    if (f.prefix === "GB") {
      const res = await fetchWithTimeout(
        `https://api.service.hmrc.gov.uk/organisations/vat/check-vat-number/lookup/${f.national}`,
        { headers: { Accept: "application/vnd.hmrc.2.0+json" } },
      );
      if (res.status === 404) return { ...base, verified: false, offline: false, message: "notFound" };
      if (!res.ok) return { ...base, verified: false, offline: true, message: "offline" };
      const data = (await res.json()) as { target?: { name?: string; address?: Record<string, string> } };
      const addr = data.target?.address ? Object.values(data.target.address).filter(Boolean).join(", ") : null;
      return { ...base, verified: !!data.target, offline: false, name: data.target?.name ?? null, address: addr };
    }

    const res = await fetchWithTimeout("https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ countryCode: f.prefix, vatNumber: f.national }),
    });
    if (!res.ok) return { ...base, verified: false, offline: true, message: "offline" };
    const data = (await res.json()) as { valid?: boolean; name?: string; address?: string; userError?: string };
    if (data.userError && data.userError !== "VALID" && data.userError !== "INVALID") {
      return { ...base, verified: false, offline: true, message: "offline" };
    }
    const clean = (s?: string) => (s && s !== "---" ? s.replace(/\n/g, ", ").trim() : null);
    return {
      ...base,
      verified: !!data.valid,
      offline: false,
      name: clean(data.name),
      address: clean(data.address),
      message: data.valid ? undefined : "notFound",
    };
  } catch {
    return { ...base, verified: false, offline: true, message: "offline" };
  }
}
