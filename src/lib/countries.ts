// UK + EU-27 (+ NO/CH for cross-border haulage) + the six GCC states.
// Standard VAT rates as of 2026 — keep under review.
export type Region = "uk" | "eu" | "europe" | "gcc";

export interface CountryInfo {
  code: string;
  name: string;
  currency: string;
  vat: number;
  eu: boolean;
  region: Region;
  vatPrefix?: string; // VIES prefix where it differs from ISO (Greece = EL)
  /** false where no VAT system is in force (Qatar, Kuwait) */
  hasVat?: boolean;
  /** national e-invoicing scheme built into MatrixFleet */
  einvoicing?: "zatca";
  /** default distance unit for companies in this country */
  distanceUnit?: "km" | "mi";
  /** what the VAT number is called on invoices */
  vatLabel?: string;
}

export const COUNTRIES: CountryInfo[] = [
  { code: "GB", name: "United Kingdom", currency: "GBP", vat: 20, eu: false, region: "uk", distanceUnit: "mi" },
  { code: "IE", name: "Ireland", currency: "EUR", vat: 23, eu: true, region: "eu" },
  { code: "DE", name: "Germany", currency: "EUR", vat: 19, eu: true, region: "eu" },
  { code: "FR", name: "France", currency: "EUR", vat: 20, eu: true, region: "eu" },
  { code: "ES", name: "Spain", currency: "EUR", vat: 21, eu: true, region: "eu" },
  { code: "IT", name: "Italy", currency: "EUR", vat: 22, eu: true, region: "eu" },
  { code: "NL", name: "Netherlands", currency: "EUR", vat: 21, eu: true, region: "eu" },
  { code: "BE", name: "Belgium", currency: "EUR", vat: 21, eu: true, region: "eu" },
  { code: "PL", name: "Poland", currency: "PLN", vat: 23, eu: true, region: "eu" },
  { code: "PT", name: "Portugal", currency: "EUR", vat: 23, eu: true, region: "eu" },
  { code: "AT", name: "Austria", currency: "EUR", vat: 20, eu: true, region: "eu" },
  { code: "SE", name: "Sweden", currency: "SEK", vat: 25, eu: true, region: "eu" },
  { code: "DK", name: "Denmark", currency: "DKK", vat: 25, eu: true, region: "eu" },
  { code: "FI", name: "Finland", currency: "EUR", vat: 25.5, eu: true, region: "eu" },
  { code: "CZ", name: "Czechia", currency: "CZK", vat: 21, eu: true, region: "eu" },
  { code: "SK", name: "Slovakia", currency: "EUR", vat: 23, eu: true, region: "eu" },
  { code: "HU", name: "Hungary", currency: "HUF", vat: 27, eu: true, region: "eu" },
  { code: "RO", name: "Romania", currency: "RON", vat: 21, eu: true, region: "eu" },
  { code: "BG", name: "Bulgaria", currency: "EUR", vat: 20, eu: true, region: "eu" },
  { code: "GR", name: "Greece", currency: "EUR", vat: 24, eu: true, region: "eu", vatPrefix: "EL" },
  { code: "HR", name: "Croatia", currency: "EUR", vat: 25, eu: true, region: "eu" },
  { code: "SI", name: "Slovenia", currency: "EUR", vat: 22, eu: true, region: "eu" },
  { code: "LT", name: "Lithuania", currency: "EUR", vat: 21, eu: true, region: "eu" },
  { code: "LV", name: "Latvia", currency: "EUR", vat: 21, eu: true, region: "eu" },
  { code: "EE", name: "Estonia", currency: "EUR", vat: 24, eu: true, region: "eu" },
  { code: "LU", name: "Luxembourg", currency: "EUR", vat: 17, eu: true, region: "eu" },
  { code: "CY", name: "Cyprus", currency: "EUR", vat: 19, eu: true, region: "eu" },
  { code: "MT", name: "Malta", currency: "EUR", vat: 18, eu: true, region: "eu" },
  { code: "NO", name: "Norway", currency: "NOK", vat: 25, eu: false, region: "europe" },
  { code: "CH", name: "Switzerland", currency: "CHF", vat: 8.1, eu: false, region: "europe" },
  // GCC — VAT under the GCC Unified VAT Agreement. Qatar and Kuwait have not introduced VAT yet.
  { code: "SA", name: "Saudi Arabia", currency: "SAR", vat: 15, eu: false, region: "gcc", einvoicing: "zatca", distanceUnit: "km" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", vat: 5, eu: false, region: "gcc", distanceUnit: "km", vatLabel: "TRN" },
  { code: "BH", name: "Bahrain", currency: "BHD", vat: 10, eu: false, region: "gcc", distanceUnit: "km" },
  { code: "OM", name: "Oman", currency: "OMR", vat: 5, eu: false, region: "gcc", distanceUnit: "km" },
  { code: "QA", name: "Qatar", currency: "QAR", vat: 0, eu: false, region: "gcc", hasVat: false, distanceUnit: "km" },
  { code: "KW", name: "Kuwait", currency: "KWD", vat: 0, eu: false, region: "gcc", hasVat: false, distanceUnit: "km" },
];

export const REGIONS: { id: Region; countries: string[] }[] = (["uk", "eu", "europe", "gcc"] as Region[]).map((id) => ({
  id,
  countries: COUNTRIES.filter((c) => c.region === id).map((c) => c.code),
}));

export const CURRENCIES = ["GBP", "EUR", "PLN", "SEK", "DKK", "CZK", "HUF", "RON", "NOK", "CHF", "SAR", "AED", "BHD", "OMR", "QAR", "KWD"];

export function country(code: string | null | undefined): CountryInfo | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code === code.toUpperCase());
}

export function isEU(code: string | null | undefined) {
  return !!country(code)?.eu;
}

export function isGCC(code: string | null | undefined) {
  return country(code)?.region === "gcc";
}

/** true when the country has a VAT system in force */
export function hasVat(code: string | null | undefined) {
  const c = country(code);
  return !!c && c.hasVat !== false;
}

/** Minor-unit decimals of a currency (KWD, BHD and OMR use 3). */
export function currencyDecimals(currency: string | null | undefined): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency: (currency || "GBP").toUpperCase() }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** Saudi VAT number: 15 digits, starting and ending with 3. */
export function isSaudiVatNumber(v: string | null | undefined) {
  return !!v && /^3\d{13}3$/.test(v);
}
