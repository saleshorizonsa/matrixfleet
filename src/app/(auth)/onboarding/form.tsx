"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { createOrganization } from "../actions";
import { Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/app/client";
import { COUNTRIES, CURRENCIES, country as findCountry } from "@/lib/countries";

export function OnboardingForm({ defaults }: { defaults: { company?: string; full_name?: string; country: string; currency?: string } }) {
  const t = useTranslations("auth");
  const [state, action] = React.useActionState(createOrganization, undefined);
  const [ctry, setCtry] = React.useState(defaults.country);
  const [currency, setCurrency] = React.useState(defaults.currency ?? findCountry(defaults.country)?.currency ?? "GBP");

  return (
    <div className="animate-fade-up">
      <div className="text-xs font-semibold uppercase tracking-wider text-brand-600">{t("onboardingStep")}</div>
      <h1 className="mt-1 font-display text-3xl font-bold text-slate-900">{t("onboardingTitle")}</h1>
      <p className="mt-2 text-sm text-slate-500">{t("onboardingSubtitle")}</p>
      <form action={action} className="mt-8 space-y-4">
        <Field label={t("fullName")}>
          <Input name="full_name" required defaultValue={defaults.full_name} />
        </Field>
        <Field label={t("company")}>
          <Input name="company" required defaultValue={defaults.company} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("country")}>
            <Select
              name="country"
              value={ctry}
              onChange={(e) => {
                setCtry(e.target.value);
                setCurrency(findCountry(e.target.value)?.currency ?? "EUR");
              }}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("currency")}>
            <Select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : state.error}</p>}
        <SubmitButton className="w-full" size="lg">
          {t("finishSetup")}
        </SubmitButton>
      </form>
    </div>
  );
}
