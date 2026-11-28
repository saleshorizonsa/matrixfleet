"use client";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button, LinkButton } from "@/components/ui";

/** Generic error page: no stack trace or internal details, only a reference to quote to support. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h1 className="font-display text-2xl font-bold text-slate-900">{t("errorTitle")}</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">{t("errorGeneric")}</p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-slate-400">
          {t("errorReference")}: {error.digest}
        </p>
      )}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>{t("tryAgain")}</Button>
        <LinkButton href="/" variant="secondary">
          {t("home")}
        </LinkButton>
      </div>
    </div>
  );
}
