"use client";
import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui";
import { intlLocale, money } from "@/lib/format";
import { PLANS } from "@/lib/plans";

/** Simple, transparent ROI model shown on the landing page. */
export function RoiCalculator() {
  const t = useTranslations("landing.roi");
  const locale = intlLocale(useLocale());
  const [currency, setCurrency] = React.useState<"GBP" | "EUR">("GBP");
  const [vehicles, setVehicles] = React.useState(8);
  const [jobsPerDay, setJobsPerDay] = React.useState(3);
  const [hourly, setHourly] = React.useState(18);
  const [minutesPerJob, setMinutesPerJob] = React.useState(12);

  // assumptions: 21 working days; MatrixFleet removes ~70% of manual admin per job
  // (phone calls, paper PODs, re-typing invoices); 2% fewer empty/failed runs.
  const jobs = vehicles * jobsPerDay * 21;
  const hoursSaved = (jobs * minutesPerJob * 0.7) / 60;
  const adminSaving = hoursSaved * hourly;
  const invoiceSpeedup = jobs * 0.9; // faster invoicing / fewer missed charges per job
  const plan = vehicles <= 3 ? PLANS[0] : vehicles <= 15 ? PLANS[1] : PLANS[2];
  const cost = plan.price[currency];
  const net = adminSaving + invoiceSpeedup - cost;
  const m = (v: number) => money(Math.round(v), currency, locale).replace(/[.,]00$/, "");

  const slider = (label: string, value: number, set: (n: number) => void, min: number, max: number, step = 1, suffix = "") => (
    <label className="block">
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-white/70">{label}</span>
        <span className="font-semibold tabular-nums text-white">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="w-full accent-[#C6F432]"
      />
    </label>
  );

  return (
    <div className="grid overflow-hidden rounded-3xl bg-ink-900 ring-1 ring-white/10 lg:grid-cols-2">
      <div className="space-y-6 p-8 sm:p-10">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold text-white">{t("inputs")}</h3>
          <div className="flex rounded-lg bg-white/5 p-0.5 text-xs ring-1 ring-white/10">
            {(["GBP", "EUR"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`rounded-md px-2.5 py-1 font-medium ${currency === c ? "bg-white text-ink-900" : "text-white/60"}`}
              >
                {c === "GBP" ? "£ GBP" : "€ EUR"}
              </button>
            ))}
          </div>
        </div>
        {slider(t("vehicles"), vehicles, setVehicles, 1, 50)}
        {slider(t("jobsPerDay"), jobsPerDay, setJobsPerDay, 1, 15)}
        {slider(t("minutesPerJob"), minutesPerJob, setMinutesPerJob, 2, 40, 1, " min")}
        {slider(t("hourly", { symbol: currency === "GBP" ? "£" : "€" }), hourly, setHourly, 10, 45)}
        <p className="text-xs leading-relaxed text-white/40">{t("assumptions")}</p>
      </div>
      <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-500 to-brand-800 p-8 sm:p-10">
        <div className="bg-grid absolute inset-0 opacity-40" />
        <div className="relative">
          <div className="text-sm font-medium text-white/70">{t("result")}</div>
          <div className="mt-2 font-display text-5xl font-bold text-white sm:text-6xl">{m(Math.max(0, net))}</div>
          <div className="mt-1 text-sm text-white/70">{t("perMonth")}</div>
          <dl className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
              <dt className="text-xs text-white/60">{t("hoursSaved")}</dt>
              <dd className="mt-1 font-display text-2xl font-bold text-white">{Math.round(hoursSaved)} h</dd>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
              <dt className="text-xs text-white/60">{t("planCost", { plan: plan.name })}</dt>
              <dd className="mt-1 font-display text-2xl font-bold text-white">{m(cost)}</dd>
            </div>
          </dl>
        </div>
        <Link href="/signup" className={buttonClass("lime", "lg", "relative mt-8 w-full")}>
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
