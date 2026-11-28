"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { acceptInvitation } from "../../actions";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/app/client";

export function InviteForm({
  token,
  email,
  orgName,
  role,
  signedInEmail,
  defaultName,
}: {
  token: string;
  email: string;
  orgName: string;
  role: string;
  signedInEmail: string | null;
  defaultName: string;
}) {
  const t = useTranslations("auth");
  const tn = useTranslations("nav");
  const [state, action] = React.useActionState(acceptInvitation, undefined);
  const signedIn = !!signedInEmail;

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-3xl font-bold text-slate-900">{t("inviteTitle", { org: orgName })}</h1>
      <p className="mt-2 text-sm text-slate-500">{t("inviteSubtitle", { role: tn(`role.${role}`) })}</p>
      {state?.message === "confirmEmail" ? (
        <p className="mt-6 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{t("messages.confirmEmail")}</p>
      ) : (
        <form action={action} className="mt-8 space-y-4">
          <input type="hidden" name="token" value={token} />
          <Field label={t("fullName")}>
            <Input name="full_name" required defaultValue={defaultName} />
          </Field>
          <Field label={t("email")}>
            <Input name="email" type="email" defaultValue={signedInEmail ?? email} readOnly={signedIn} required />
          </Field>
          {!signedIn && (
            <Field label={t("password")} hint={t("passwordHint")}>
              <Input name="password" type="password" minLength={8} required autoComplete="new-password" />
            </Field>
          )}
          {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : state.error}</p>}
          <SubmitButton className="w-full" size="lg">
            {t("acceptInvite")}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
