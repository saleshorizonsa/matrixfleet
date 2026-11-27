// UK + EU-27 (+ NO/CH for cross-border haulage). Standard VAT rates as of 2026 — keep under review.
export interface CountryInfo {
  code: string;
  name: string;
  currency: string;
  vat: number;
  eu: boolean;
  vatPrefix?: string; // VIES prefix where it differs from ISO (Greece = EL)
}

export const COUNTRIES: CountryInfo[] = [
  { code: "GB", name: "United Kingdom", currency: "GBP", vat: 20, eu: false },
  { code: "IE", name: "Ireland", currency: "EUR", vat: 23, eu: true },
  { code: "DE", name: "Germany", currency: "EUR", vat: 19, eu: true },
  { code: "FR", name: "France", currency: "EUR", vat: 20, eu: true },
  { code: "ES", name: "Spain", currency: "EUR", vat: 21, eu: true },
  { code: "IT", name: "Italy", currency: "EUR", vat: 22, eu: true },
  { code: "NL", name: "Netherlands", currency: "EUR", vat: 21, eu: true },
  { code: "BE", name: "Belgium", currency: "EUR", vat: 21, eu: true },
  { code: "PL", name: "Poland", currency: "PLN", vat: 23, eu: true },
  { code: "PT", name: "Portugal", currency: "EUR", vat: 23, eu: true },
  { code: "AT", name: "Austria", currency: "EUR", vat: 20, eu: true },
  { code: "SE", name: "Sweden", currency: "SEK", vat: 25, eu: true },
  { code: "DK", name: "Denmark", currency: "DKK", vat: 25, eu: true },
  { code: "FI", name: "Finland", currency: "EUR", vat: 25.5, eu: true },
  { code: "CZ", name: "Czechia", currency: "CZK", vat: 21, eu: true },
  { code: "SK", name: "Slovakia", currency: "EUR", vat: 23, eu: true },
  { code: "HU", name: "Hungary", currency: "HUF", vat: 27, eu: true },
  { code: "RO", name: "Romania", currency: "RON", vat: 21, eu: true },
  { code: "BG", name: "Bulgaria", currency: "EUR", vat: 20, eu: true },
  { code: "GR", name: "Greece", currency: "EUR", vat: 24, eu: true, vatPrefix: "EL" },
  { code: "HR", name: "Croatia", currency: "EUR", vat: 25, eu: true },
  { code: "SI", name: "Slovenia", currency: "EUR", vat: 22, eu: true },
  { code: "LT", name: "Lithuania", currency: "EUR", vat: 21, eu: true },
  { code: "LV", name: "Latvia", currency: "EUR", vat: 21, eu: true },
  { code: "EE", name: "Estonia", currency: "EUR", vat: 24, eu: true },
  { code: "LU", name: "Luxembourg", currency: "EUR", vat: 17, eu: true },
  { code: "CY", name: "Cyprus", currency: "EUR", vat: 19, eu: true },
  { code: "MT", name: "Malta", currency: "EUR", vat: 18, eu: true },
  { code: "NO", name: "Norway", currency: "NOK", vat: 25, eu: false },
  { code: "CH", name: "Switzerland", currency: "CHF", vat: 8.1, eu: false },
];

export const CURRENCIES = ["GBP", "EUR", "PLN", "SEK", "DKK", "CZK", "HUF", "RON", "NOK", "CHF"];

export function country(code: string | null | undefined): CountryInfo | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code === code.toUpperCase());
}

export function isEU(code: string | null | undefined) {
  return !!country(code)?.eu;
}
