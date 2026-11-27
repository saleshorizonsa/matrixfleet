"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Mail, KeyRound } from "lucide-react";
import { signIn, sendMagicLink } from "../actions";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/app/client";
import { cn } from "@/lib/utils";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const t = useTranslations("auth");
  const [mode, setMode] = React.useState<"password" | "magic">("password");
  const [pwState, pwAction] = React.useActionState(signIn, undefined);
  const [mlState, mlAction] = React.useActionState(sendMagicLink, undefined);
  const state = mode === "password" ? pwState : mlState;
  const error = state?.error ?? initialError;

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-3xl font-bold text-slate-900">{t("loginTitle")}</h1>
      <p className="mt-2 text-sm text-slate-500">
        {t("noAccount")}{" "}
        <Link href="/signup" className="font-semibold text-brand-600 hover:underline">
          {t("startTrial")}
        </Link>
      </p>

      <div className="mt-8 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium">
        {(["password", "magic"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn("flex items-center justify-center gap-2 rounded-lg py-2 transition", mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
          >
            {m === "password" ? <KeyRound className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            {t(m === "password" ? "withPassword" : "withMagicLink")}
          </button>
        ))}
      </div>

      <form action={mode === "password" ? pwAction : mlAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label={t("email")}>
          <Input name="email" type="email" autoComplete="email" required placeholder="you@company.co.uk" />
        </Field>
        {mode === "password" && (
          <Field label={t("password")}>
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
        )}
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{t.has(`errors.${error}`) ? t(`errors.${error}`) : error}</p>}
        {state?.message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{t(`messages.${state.message}`)}</p>}
        <SubmitButton className="w-full" size="lg">
          {mode === "password" ? t("signIn") : t("sendLink")}
        </SubmitButton>
      </form>
    </div>
  );
}
