"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Mail, Trash2, UserPlus } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Field, Input, LinkButton, Select, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/app/client";
import { ActionForm } from "./action-form";
import { inviteMember, revokeInvitation, changeRole, removeMember } from "@/app/app/settings/actions";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["admin", "dispatcher", "driver", "accountant", "owner"];

function mailto(email: string, link: string, orgName: string, t: ReturnType<typeof useTranslations>) {
  const subject = encodeURIComponent(t("mailSubject", { org: orgName }));
  const body = encodeURIComponent(t("mailBody", { org: orgName, link }));
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

async function copy(text: string, msg: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(msg);
  } catch {
    window.prompt("", text);
  }
}

export function InviteForm({
  appUrl,
  orgName,
  atLimit,
  canInviteOwner,
}: {
  appUrl: string;
  orgName: string;
  atLimit: boolean;
  canInviteOwner: boolean;
}) {
  const t = useTranslations("settings.team");
  const tn = useTranslations("nav");
  const [last, setLast] = React.useState<{ link: string; email: string } | null>(null);
  const emailRef = React.useRef("");

  return (
    <Card className="h-fit">
      <CardHeader title={t("inviteTitle")} description={t("inviteHint")} />
      <CardBody>
        {atLimit ? (
          <div className="space-y-3 text-sm text-slate-600">
            <p>{t("limitReached")}</p>
            <LinkButton href="/app/settings/billing" size="sm">
              {t("upgrade")}
            </LinkButton>
          </div>
        ) : (
          <ActionForm
            action={inviteMember}
            resetOnSuccess
            onSuccess={(s) => s.token && setLast({ link: `${appUrl}/invite/${s.token}`, email: emailRef.current })}
            className="space-y-4"
          >
            <Field label={t("email")}>
              <Input name="email" type="email" required onChange={(e) => (emailRef.current = e.target.value)} />
            </Field>
            <Field label={t("role")} hint={t("roleHint")}>
              <Select name="role" defaultValue="dispatcher">
                {ROLES.filter((r) => r !== "owner" || canInviteOwner).map((r) => (
                  <option key={r} value={r}>
                    {tn(`role.${r}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton className="w-full">
              <UserPlus className="h-4 w-4" />
              {t("sendInvite")}
            </SubmitButton>
          </ActionForm>
        )}
        {last && (
          <div className="mt-5 space-y-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
            <p className="text-sm font-medium text-emerald-800">{t("inviteCreated")}</p>
            <Input readOnly value={last.link} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" type="button" onClick={() => copy(last.link, t("linkCopied"))}>
                <Copy className="h-4 w-4" /> {t("copyLink")}
              </Button>
              <a href={mailto(last.email, last.link, orgName, t)} className={buttonClass("secondary", "sm")}>
                <Mail className="h-4 w-4" /> {t("emailIt")}
              </a>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function InvitationActions({ id, link, email, orgName }: { id: string; link: string; email: string; orgName: string }) {
  const t = useTranslations("settings.team");
  const [pending, start] = React.useTransition();
  return (
    <div className="flex justify-end gap-1">
      <button type="button" className={buttonClass("ghost", "sm")} onClick={() => copy(link, t("linkCopied"))} title={t("copyLink")}>
        <Copy className="h-4 w-4" />
      </button>
      <a href={mailto(email, link, orgName, t)} className={buttonClass("ghost", "sm")} title={t("emailIt")}>
        <Mail className="h-4 w-4" />
      </a>
      <button
        type="button"
        disabled={pending}
        className={buttonClass("ghost", "sm", "text-rose-600 hover:bg-rose-50 hover:text-rose-700")}
        onClick={() => window.confirm(t("revokeConfirm")) && start(() => revokeInvitation(id))}
        title={t("revoke")}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function MemberActions({ userId, role, viewerIsOwner }: { userId: string; role: Role; viewerIsOwner: boolean }) {
  const t = useTranslations("settings.team");
  const ts = useTranslations("settings");
  const tn = useTranslations("nav");
  const [pending, start] = React.useTransition();
  const locked = role === "owner" && !viewerIsOwner;

  const report = (r: { ok?: boolean; error?: string }) => {
    if (r.error) toast.error(ts.has(`errors.${r.error}`) ? ts(`errors.${r.error}`) : r.error);
    else toast.success(ts("saved"));
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <Select
        aria-label={t("role")}
        className="h-8 w-36 text-xs"
        value={role}
        disabled={pending || locked}
        onChange={(e) => {
          const next = e.target.value as Role;
          start(async () => report(await changeRole(userId, next)));
        }}
      >
        {ROLES.filter((r) => r !== "owner" || viewerIsOwner || role === "owner").map((r) => (
          <option key={r} value={r}>
            {tn(`role.${r}`)}
          </option>
        ))}
      </Select>
      <button
        type="button"
        disabled={pending || locked}
        className={buttonClass("ghost", "sm", "text-rose-600 hover:bg-rose-50 hover:text-rose-700")}
        onClick={() => window.confirm(t("removeConfirm")) && start(async () => report(await removeMember(userId)))}
        title={t("remove")}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
