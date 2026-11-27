"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Mail, Smartphone } from "lucide-react";
import { inviteDriver } from "@/app/app/fleet/actions";
import { Button, Field, Input, buttonClass } from "@/components/ui";
import { Modal, SubmitButton } from "@/components/app/client";

export function InviteDriverButton({ driverId, email, name, orgName }: { driverId: string; email: string | null; name: string; orgName: string }) {
  const t = useTranslations("fleet");
  const tc = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const [state, action] = React.useActionState(inviteDriver, undefined);

  const mailto = state?.link
    ? `mailto:${state.email}?subject=${encodeURIComponent(t("invite.mailSubject", { org: orgName }))}&body=${encodeURIComponent(
        t("invite.mailBody", { name, org: orgName, link: state.link }),
      )}`
    : "#";

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Smartphone className="h-4 w-4" /> {t("invite.button")}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("invite.title")}>
        {state?.link ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{t("invite.ready", { email: state.email ?? "" })}</p>
            <div className="flex gap-2">
              <Input readOnly value={state.link} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(state.link!);
                  toast.success(tc("copied"));
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <a href={mailto} className={buttonClass("primary", "md", "w-full")}>
              <Mail className="h-4 w-4" /> {t("invite.sendEmail")}
            </a>
            <p className="text-xs text-slate-500">{t("invite.expires")}</p>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="driver_id" value={driverId} />
            <p className="text-sm text-slate-600">{t("invite.description")}</p>
            <Field label={tc("email")}>
              <Input name="email" type="email" required defaultValue={email ?? ""} />
            </Field>
            {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : state.error}</p>}
            <SubmitButton className="w-full">{t("invite.create")}</SubmitButton>
          </form>
        )}
      </Modal>
    </>
  );
}
