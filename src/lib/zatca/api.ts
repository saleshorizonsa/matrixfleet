// ZATCA Fatoora API client (e-invoicing Phase 2, API version V2).
import type { ZatcaEnv } from "./crypto";

const BASE: Record<ZatcaEnv, string> = {
  sandbox: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal",
  simulation: "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation",
  production: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core",
};

export interface ZatcaMessage {
  type?: string;
  code?: string;
  category?: string;
  message?: string;
  status?: string;
}

export interface ZatcaResult {
  ok: boolean;
  httpStatus: number;
  status?: string; // CLEARED | NOT_CLEARED | REPORTED | NOT_REPORTED | PASS | WARNING | ERROR
  warnings: ZatcaMessage[];
  errors: ZatcaMessage[];
  clearedInvoice?: string;
  raw: Record<string, unknown>;
}

export interface CsidResult {
  requestID: string;
  binarySecurityToken: string;
  secret: string;
  dispositionMessage?: string;
}

export class ZatcaError extends Error {
  constructor(
    message: string,
    public httpStatus: number,
    public body: unknown,
  ) {
    super(message);
  }
}

const basic = (token: string, secret: string) => "Basic " + Buffer.from(`${token}:${secret}`).toString("base64");

async function call(env: ZatcaEnv, path: string, init: { method?: string; headers: Record<string, string>; body: unknown }) {
  const res = await fetch(BASE[env] + path, {
    method: init.method ?? "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Version": "V2", "Accept-Language": "en", ...init.headers },
    body: JSON.stringify(init.body),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  const textBody = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = textBody ? JSON.parse(textBody) : {};
  } catch {
    json = { message: textBody.slice(0, 500) };
  }
  return { status: res.status, json };
}

/** Step 1 of onboarding: CSR + one-time code from the Fatoora portal → compliance CSID. */
export async function requestComplianceCsid(env: ZatcaEnv, csrB64: string, otp: string): Promise<CsidResult> {
  const { status, json } = await call(env, "/compliance", { headers: { OTP: otp }, body: { csr: csrB64 } });
  if (status !== 200 || !json.binarySecurityToken) throw new ZatcaError(errorText(json) || "compliance CSID refused", status, json);
  return json as unknown as CsidResult;
}

/** Step 3: exchange the compliance CSID (after the checks passed) for the production CSID. */
export async function requestProductionCsid(env: ZatcaEnv, complianceToken: string, complianceSecret: string, requestId: string): Promise<CsidResult> {
  const { status, json } = await call(env, "/production/csids", {
    headers: { Authorization: basic(complianceToken, complianceSecret) },
    body: { compliance_request_id: requestId },
  });
  if (status !== 200 || !json.binarySecurityToken) throw new ZatcaError(errorText(json) || "production CSID refused", status, json);
  return json as unknown as CsidResult;
}

export interface SubmitInput {
  hash: string;
  uuid: string;
  xml: string;
}

const payload = (i: SubmitInput) => ({ invoiceHash: i.hash, uuid: i.uuid, invoice: Buffer.from(i.xml, "utf8").toString("base64") });

/** Step 2: compliance check of a sample document with the compliance CSID. */
export function complianceCheck(env: ZatcaEnv, token: string, secret: string, i: SubmitInput) {
  return submit(env, "/compliance/invoices", token, secret, i, {});
}

/** Standard (B2B) invoices: real-time clearance. */
export function clearInvoice(env: ZatcaEnv, token: string, secret: string, i: SubmitInput) {
  return submit(env, "/invoices/clearance/single", token, secret, i, { "Clearance-Status": "1" });
}

/** Simplified (B2C) invoices: reporting within 24 hours. */
export function reportInvoice(env: ZatcaEnv, token: string, secret: string, i: SubmitInput) {
  return submit(env, "/invoices/reporting/single", token, secret, i, { "Clearance-Status": "0" });
}

async function submit(env: ZatcaEnv, path: string, token: string, secret: string, i: SubmitInput, extra: Record<string, string>): Promise<ZatcaResult> {
  const { status, json } = await call(env, path, { headers: { Authorization: basic(token, secret), ...extra }, body: payload(i) });
  const vr = (json.validationResults ?? {}) as { warningMessages?: ZatcaMessage[]; errorMessages?: ZatcaMessage[]; status?: string };
  const st = (json.clearanceStatus ?? json.reportingStatus ?? vr.status) as string | undefined;
  const errors = vr.errorMessages ?? [];
  if (!vr.errorMessages && status >= 400) errors.push({ type: "ERROR", code: String(status), message: errorText(json) || "request failed" });
  return {
    ok: (status === 200 || status === 202) && errors.length === 0,
    httpStatus: status,
    status: st,
    warnings: vr.warningMessages ?? [],
    errors,
    clearedInvoice: typeof json.clearedInvoice === "string" ? json.clearedInvoice : undefined,
    raw: json,
  };
}

function errorText(json: Record<string, unknown>) {
  if (typeof json.message === "string") return json.message;
  if (Array.isArray(json.errors)) return json.errors.map((e) => (typeof e === "string" ? e : (e as { message?: string }).message)).join("; ");
  if (typeof json.dispositionMessage === "string") return json.dispositionMessage;
  return "";
}
