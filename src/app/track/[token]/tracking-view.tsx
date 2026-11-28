"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Clock, MapPin, Package, PackageCheck, Phone, RefreshCw, Truck, UserCheck } from "lucide-react";
import { MapView, type MapMarker } from "@/components/maps";
import { LogoMark } from "@/components/app/logo";
import { LanguageSwitcher } from "@/components/app/client";
import { country } from "@/lib/countries";
import { intlLocale } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/types";

/** Same zone on server and browser, so times render identically (no hydration mismatch). */
const TZ = "Europe/London";

export interface TrackingData {
  reference: string;
  status: JobStatus;
  company: string;
  company_logo: string | null;
  company_phone: string | null;
  pickup_city: string | null;
  pickup_country: string | null;
  delivery_city: string | null;
  delivery_country: string | null;
  delivery_postcode: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  scheduled_date: string | null;
  delivery_from: string | null;
  delivery_to: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  pod_signed_by: string | null;
  driver_first_name: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
  driver_seen_at: string | null;
  events: { kind: string; status: JobStatus | null; at: string }[];
}

const STEPS: JobStatus[] = ["booked", "assigned", "in_transit", "delivered"];

export function TrackingView({ data }: { data: TrackingData }) {
  const t = useTranslations("tracking.public");
  const ts = useTranslations("common.status");
  const locale = intlLocale(useLocale());
  const router = useRouter();
  const [lastRefresh, setLastRefresh] = React.useState(() => Date.now());
  const done = data.status === "delivered" || data.status === "invoiced";
  const cancelled = data.status === "cancelled";

  React.useEffect(() => {
    if (done || cancelled) return;
    const id = setInterval(() => {
      router.refresh();
      setLastRefresh(Date.now());
    }, 30_000);
    return () => clearInterval(id);
  }, [done, cancelled, router]);

  const stepIndex = done ? 3 : Math.max(0, STEPS.indexOf(data.status));
  const fmtTime = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso)) : null;
  const fmtDay = (d: string | null) => (d ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(new Date(`${d}T12:00:00Z`)) : null);
  const stepAt = (s: JobStatus) => data.events.filter((e) => e.status === s).at(-1)?.at ?? null;

  const markers: MapMarker[] = [];
  if (data.pickup_lat != null && data.pickup_lng != null) markers.push({ id: "p", kind: "pickup", lat: data.pickup_lat, lng: data.pickup_lng, label: data.pickup_city ?? "" });
  if (data.delivery_lat != null && data.delivery_lng != null) markers.push({ id: "d", kind: "delivery", lat: data.delivery_lat, lng: data.delivery_lng, label: data.delivery_city ?? "" });
  if (data.driver_lat != null && data.driver_lng != null)
    markers.push({ id: "drv", kind: "driver", lat: data.driver_lat, lng: data.driver_lng, label: data.driver_first_name ?? "", live: true, color: "#5B5BF7" });

  const headline = cancelled ? t("headline.cancelled") : done ? t("headline.delivered") : data.status === "in_transit" ? t("headline.onTheWay") : t("headline.scheduled");
  const eta =
    data.delivery_from || data.delivery_to
      ? [fmtTime(data.delivery_from), fmtTime(data.delivery_to)].filter(Boolean).join(" – ")
      : fmtDay(data.scheduled_date);

  return (
    <div className="min-h-screen bg-surface">
      {/* header */}
      <header className="relative overflow-hidden bg-ink-900 text-white">
        <div className="bg-grid absolute inset-0" />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/40 blur-[90px]" />
        <div className="relative mx-auto max-w-3xl px-5 pb-24 pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {data.company_logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.company_logo} alt={data.company} className="h-10 w-10 rounded-xl bg-white object-contain p-1" />
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 font-display text-lg font-bold">{data.company.slice(0, 1)}</span>
              )}
              <div>
                <div className="font-display font-semibold">{data.company}</div>
                <div className="text-xs text-white/50">{t("shipment")} {data.reference}</div>
              </div>
            </div>
            <LanguageSwitcher dark />
          </div>
          <h1 className="mt-10 font-display text-3xl font-bold sm:text-4xl">{headline}</h1>
          {!cancelled && (
            <p className="mt-2 flex items-center gap-2 text-white/70">
              <Clock className="h-4 w-4 text-lime-signal" />
              {done ? t("deliveredOn", { date: fmtTime(data.delivered_at) ?? "" }) : eta ? t("expected", { eta }) : t("awaitingSchedule")}
            </p>
          )}
        </div>
      </header>

      <main className="relative mx-auto -mt-16 max-w-3xl space-y-4 px-5 pb-10">
        {/* route summary + stepper */}
        <section className="animate-fade-up rounded-2xl bg-white p-5 shadow-xl shadow-ink-900/5 ring-1 ring-slate-200/70">
          <div className="flex items-center gap-3">
            <Place label={t("from")} city={data.pickup_city} ctry={data.pickup_country} />
            <div className="relative flex flex-1 items-center">
              <div className="h-0.5 w-full rounded bg-slate-100" />
              <div className="absolute h-0.5 rounded bg-brand-500 transition-all" style={{ width: `${(stepIndex / 3) * 100}%` }} />
              <Truck
                className="absolute h-5 w-5 -translate-x-1/2 text-brand-600 transition-all"
                style={{ left: `${(stepIndex / 3) * 100}%` }}
              />
            </div>
            <Place label={t("to")} city={data.delivery_city} ctry={data.delivery_country} right />
          </div>

          {!cancelled && (
            <ol className="mt-6 grid grid-cols-4 gap-2">
              {STEPS.map((s, i) => {
                const reached = i <= stepIndex;
                const current = i === stepIndex && !done;
                const Icon = [Package, UserCheck, Truck, PackageCheck][i];
                const at = s === "in_transit" ? data.picked_up_at ?? stepAt(s) : s === "delivered" ? data.delivered_at ?? stepAt(s) : stepAt(s);
                return (
                  <li key={s} className="flex flex-col items-center text-center">
                    <span
                      className={cn(
                        "relative grid h-10 w-10 place-items-center rounded-full transition",
                        reached ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30" : "bg-slate-100 text-slate-400",
                        current && "text-white",
                      )}
                    >
                      {current && <span className="pulse-ring absolute inset-0 rounded-full text-brand-500" />}
                      <Icon className="relative h-5 w-5" />
                    </span>
                    <span className={cn("mt-2 text-xs font-medium", reached ? "text-slate-900" : "text-slate-400")}>{ts(s)}</span>
                    {at && reached && <span className="text-[10px] text-slate-400">{fmtTime(at)}</span>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* map */}
        {markers.length > 0 && !done && (
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
            <MapView markers={markers} route={markers.length >= 2 && data.pickup_lat != null && data.delivery_lat != null ? [[data.pickup_lat, data.pickup_lng!], [data.delivery_lat, data.delivery_lng!]] : null} className="h-72 w-full sm:h-80" />
            {data.status === "in_transit" && (
              <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  {data.driver_first_name ? t("driverLive", { name: data.driver_first_name }) : t("liveLocation")}
                </span>
                {/* "updated at" is the render time, which can tick over a minute between server and browser */}
                <span className="inline-flex items-center gap-1" suppressHydrationWarning>
                  <RefreshCw className="h-3 w-3" /> {t("updated", { time: new Date(lastRefresh).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: TZ }) })}
                </span>
              </div>
            )}
          </section>
        )}

        {/* POD */}
        {done && (
          <section className="animate-fade-up rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
              <div>
                <div className="font-display font-semibold text-emerald-900">{t("podTitle")}</div>
                <p className="mt-0.5 text-sm text-emerald-800">
                  {data.pod_signed_by ? t("podSignedBy", { name: data.pod_signed_by, date: fmtTime(data.delivered_at) ?? "" }) : t("podDelivered", { date: fmtTime(data.delivered_at) ?? "" })}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* destination + contact */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <MapPin className="h-4 w-4 text-emerald-500" /> {t("deliveryTo")}
            </div>
            <div className="mt-2 font-medium text-slate-900">{[data.delivery_postcode, data.delivery_city].filter(Boolean).join(" ") || "—"}</div>
            <div className="text-sm text-slate-500">{country(data.delivery_country)?.name}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("questions")}</div>
            <div className="mt-2 font-medium text-slate-900">{data.company}</div>
            {data.company_phone ? (
              <a href={`tel:${data.company_phone}`} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
                <Phone className="h-4 w-4" /> {data.company_phone}
              </a>
            ) : (
              <div className="text-sm text-slate-500">{t("contactCarrier")}</div>
            )}
          </div>
        </section>

        <footer className="flex items-center justify-center gap-2 pt-6 text-xs text-slate-400">
          <LogoMark size={18} />
          <span>
            {t("poweredBy")} <span className="font-semibold text-slate-600">MatrixFleet</span> · Matrix Infotech Ltd
          </span>
        </footer>
      </main>
    </div>
  );
}

function Place({ label, city, ctry, right }: { label: string; city: string | null; ctry: string | null; right?: boolean }) {
  return (
    <div className={cn("min-w-0 max-w-[38%]", right && "text-right")}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="truncate font-display text-lg font-bold text-slate-900">{city ?? "—"}</div>
      <div className="text-xs text-slate-500">{ctry ? country(ctry)?.name ?? ctry : ""}</div>
    </div>
  );
}
