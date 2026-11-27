"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { signUp } from "../actions";
import { Checkbox, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/app/client";
import { COUNTRIES } from "@/lib/countries";

export function SignupForm({ plan }: { plan?: string }) {
  const t = useTranslations("auth");
  const [state, action] = React.useActionState(signUp, undefined);

  if (state?.message === "confirmEmail") {
    return (
      <div className="animate-fade-up text-center">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
          <MailCheck className="h-8 w-8" />
        </div>
        <h1 className="font-display text-2xl font-bold">{t("checkEmailTitle")}</h1>
        <p className="mt-2 text-slate-500">{t("messages.confirmEmail")}</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-3xl font-bold text-slate-900">{t("signupTitle")}</h1>
      <p className="mt-2 text-sm text-slate-500">{t("signupSubtitle")}</p>
      <form action={action} className="mt-8 space-y-4">
        <input type="hidden" name="plan" value={plan ?? ""} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fullName")}>
            <Input name="full_name" required autoComplete="name" />
          </Field>
          <Field label={t("company")}>
            <Input name="company" required autoComplete="organization" />
          </Field>
        </div>
        <Field label={t("country")}>
          <Select name="country" defaultValue="GB">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("workEmail")}>
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label={t("password")} hint={t("passwordHint")}>
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <Checkbox
          name="terms"
          required
          label={
            <span>
              {t.rich("acceptTerms", {
                terms: (c) => <Link href="/legal/terms" className="font-medium text-brand-600 underline">{c}</Link>,
                privacy: (c) => <Link href="/legal/privacy" className="font-medium text-brand-600 underline">{c}</Link>,
              })}
            </span>
          }
        />
        {state?.error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : state.error}</p>
        )}
        <SubmitButton className="w-full" size="lg">
          {t("createAccount")}
        </SubmitButton>
        <p className="text-center text-xs text-slate-500">{t("noCard")}</p>
        <p className="text-center text-sm text-slate-500">
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">
            {t("signIn")}
          </Link>
        </p>
      </form>
    </div>
  );
}
