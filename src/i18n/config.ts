export const LOCALES = ["en", "de", "fr", "es", "pl"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "hl_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  pl: "Polski",
};

/**
 * Message namespaces. Each lives in messages/<locale>/<namespace>.json so
 * modules can be translated independently.
 */
export const NAMESPACES = [
  "common",
  "nav",
  "auth",
  "landing",
  "dashboard",
  "jobs",
  "dispatch",
  "tracking",
  "driver",
  "fleet",
  "customers",
  "invoices",
  "settings",
  "billing",
] as const;

export function isLocale(v: string | undefined | null): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}
