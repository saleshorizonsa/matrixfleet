import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, NAMESPACES, isLocale, type Locale } from "./config";

async function detectLocale(): Promise<Locale> {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}

async function loadNamespace(locale: Locale, ns: string) {
  try {
    return (await import(`../../messages/${locale}/${ns}.json`)).default;
  } catch {
    return {};
  }
}

export default getRequestConfig(async () => {
  const locale = await detectLocale();
  const messages: Record<string, unknown> = {};
  await Promise.all(
    NAMESPACES.map(async (ns) => {
      const fallback = locale === DEFAULT_LOCALE ? {} : await loadNamespace(DEFAULT_LOCALE, ns);
      const own = await loadNamespace(locale, ns);
      messages[ns] = deepMerge(fallback, own);
    }),
  );
  return { locale, messages, timeZone: "Europe/London" };
});

function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object"
        ? deepMerge(a[k] as Record<string, unknown>, v as Record<string, unknown>)
        : v;
  }
  return out;
}

export { LOCALES };
