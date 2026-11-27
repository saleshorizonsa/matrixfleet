"use client";
import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Check, Sparkles } from "lucide-react";
import { PLANS } from "@/lib/plans";
import { buttonClass } from "@/components/ui";
import { intlLocale, money } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PricingSection() {
  const t = useTranslations("landing.pricing");
  const tb = useTranslations("billing");
  const locale = intlLocale(useLocale());
  const [currency, setCurrency] = React.useState<"GBP" | "EUR">(locale === "en-GB" ? "GBP" : "EUR");

  return (
    <div>
      <div className="mb-10 flex justify-center">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm font-medium" role="group" aria-label={t("currency")}>
          {(["GBP", "EUR"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={currency === c}
              onClick={() => setCurrency(c)}
              className={cn("rounded-lg px-4 py-1.5 transition", currency === c ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
            >
              {c === "GBP" ? "£ GBP" : "€ EUR"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "relative flex flex-col rounded-3xl p-8 transition hover:-translate-y-1",
              plan.highlight ? "bg-ink-900 text-white shadow-2xl shadow-brand-500/25 ring-2 ring-brand-500" : "bg-white ring-1 ring-slate-200",
            )}
          >
            {plan.highlight && (
              <span className="absolute -top-3.5 left-8 inline-flex items-center gap-1 rounded-full bg-lime-signal px-3 py-1 text-xs font-bold text-ink-900">
                <Sparkles className="h-3 w-3" /> {tb("popular")}
              </span>
            )}
            <div className={cn("font-display text-xl font-semibold", plan.highlight ? "text-white" : "text-slate-900")}>{plan.name}</div>
            <p className={cn("mt-1 text-sm", plan.highlight ? "text-white/60" : "text-slate-500")}>{t(`desc.${plan.id}`)}</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-display text-5xl font-bold">{money(plan.price[currency], currency, locale).replace(/[.,]00$/, "")}</span>
              <span className={cn("text-sm", plan.highlight ? "text-white/60" : "text-slate-500")}>{tb("perMonth")}</span>
            </div>
            <div className={cn("text-xs", plan.highlight ? "text-white/45" : "text-slate-400")}>{tb("exclVat")}</div>
            <Link
              href={`/signup?plan=${plan.id}`}
              className={buttonClass(plan.highlight ? "lime" : "dark", "lg", "mt-7 w-full")}
            >
              {t("cta")}
            </Link>
            <ul className="mt-8 space-y-3 text-sm">
              <li className="flex gap-3">
                <Check className={cn("h-5 w-5 shrink-0", plan.highlight ? "text-lime-signal" : "text-brand-500")} />
                {Number.isFinite(plan.vehicles) ? tb("upToVehicles", { n: plan.vehicles }) : tb("unlimitedVehicles")}
              </li>
              <li className="flex gap-3">
                <Check className={cn("h-5 w-5 shrink-0", plan.highlight ? "text-lime-signal" : "text-brand-500")} />
                {Number.isFinite(plan.users) ? tb("upToUsers", { n: plan.users }) : tb("unlimitedUsers")}
              </li>
              {plan.features.map((f) => (
                <li key={f} className="flex gap-3">
                  <Check className={cn("h-5 w-5 shrink-0", plan.highlight ? "text-lime-signal" : "text-brand-500")} />
                  {tb(`features.${f}`)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-slate-500">{t("trialNote")}</p>
    </div>
  );
}
