import { getTranslations } from "next-intl/server";
import { Download, Server, ShieldCheck, Lock } from "lucide-react";
import Link from "next/link";
import { requireOffice, ADMIN_ROLES } from "@/lib/auth";
import { Card, CardBody, CardHeader, buttonClass } from "@/components/ui";
import { DangerZone } from "@/components/settings/danger-zone";

export const metadata = { title: "Privacy & data" };

export default async function PrivacyPage() {
  const ctx = await requireOffice();
  const t = await getTranslations("settings.privacy");
  const isAdmin = ADMIN_ROLES.includes(ctx.membership.role);
  const isOwner = ctx.membership.role === "owner";

  const facts = [
    { icon: Server, title: t("residencyTitle"), body: t("residencyBody") },
    { icon: Lock, title: t("securityTitle"), body: t("securityBody") },
    { icon: ShieldCheck, title: t("rolesTitle"), body: t("rolesBody") },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {facts.map((f) => (
          <Card key={f.title} className="p-5">
            <f.icon className="h-6 w-6 text-brand-500" />
            <div className="mt-3 font-semibold text-slate-900">{f.title}</div>
            <p className="mt-1 text-sm text-slate-500">{f.body}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title={t("exportTitle")} description={t("exportHint")} />
        <CardBody className="flex flex-wrap items-center gap-3">
          {isAdmin ? (
            <a href="/api/gdpr/export" className={buttonClass("primary")} download>
              <Download className="h-4 w-4" /> {t("exportButton")}
            </a>
          ) : (
            <p className="text-sm text-slate-500">{t("adminOnly")}</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("retentionTitle")} />
        <CardBody>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            <li>{t("retention.invoices")}</li>
            <li>{t("retention.jobs")}</li>
            <li>{t("retention.gps")}</li>
            <li>{t("retention.checks")}</li>
            <li>{t("retention.audit")}</li>
            <li>{t("retention.backups")}</li>
          </ul>
          <p className="mt-4 text-sm text-slate-500">
            {t.rich("legalLinks", {
              privacy: (c) => <Link href="/legal/privacy" className="font-medium text-brand-600 underline">{c}</Link>,
              dpa: (c) => <Link href="/legal/dpa" className="font-medium text-brand-600 underline">{c}</Link>,
            })}
          </p>
        </CardBody>
      </Card>

      <DangerZone orgName={ctx.org.name} isOwner={isOwner} />
    </div>
  );
}
