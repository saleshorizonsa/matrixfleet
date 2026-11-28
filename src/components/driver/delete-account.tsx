"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteDriverAccount } from "@/app/driver/actions";
import { Input } from "@/components/ui";
import { SubmitButton } from "@/components/app/client";

export function DeleteDriverAccount() {
  const t = useTranslations("driver.profile");
  const [state, action] = React.useActionState(deleteDriverAccount, undefined);
  const [text, setText] = React.useState("");
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-rose-200">
      <div className="flex items-center gap-2 font-semibold text-rose-700">
        <Trash2 className="h-5 w-5" /> {t("deleteTitle")}
      </div>
      <p className="text-sm text-slate-600">{t("deleteBody")}</p>
      <Input name="confirm" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("deleteConfirm")} autoComplete="off" aria-label={t("deleteConfirm")} />
      {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{t(state.error)}</p>}
      <SubmitButton variant="danger" className="w-full" disabled={text.trim() !== "DELETE"}>
        {t("deleteButton")}
      </SubmitButton>
    </form>
  );
}
