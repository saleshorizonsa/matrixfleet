import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2, ExternalLink, ShieldCheck, XCircle } from "lucide-react";
import { requireOffice, ADMIN_ROLES } from "@/lib/auth";
import { Badge, Card, CardBody, CardHeader, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/app/client";
import { ActionForm } from "@/components/settings/action-form";
import { getZatcaStatus, sellerProblems, zatcaConfigured, zatcaRequired } from "@/lib/zatca";
import { date, intlLocale } from "@/lib/format";
import { connectZatca } from "./actions";

export const metadata = { title: "E-invoicing (ZATCA)" };

export default async function EinvoicingPage() {
  const ctx = await requireOffice();
  if (!zatcaRequired(ctx.org)) notFound();
  const t = await getTranslations("settings.einvoicing");
  const loc = intlLocale(await getLocale());
  const canEdit = ADMIN_ROLES.includes(ctx.membership.role);
  const status = await getZatcaStatus(ctx.org.id);
  const problems = sellerProblems(ctx.org);
  const configured = zatcaConfigured();
  const active = status?.status === "active";

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card>
          <CardHeader
            title={t("title")}
            description={t("intro")}
            action={
              active ? (
                <Badge tone={status.environment === "production" ? "green" : "amber"}>
                  <ShieldCheck className="h-3 w-3" /> {t(`env.${status.environment}`)}
                </Badge>
              ) : (
                <Badge tone="slate">{t("notConnected")}</Badge>
              )
            }
          />
          <CardBody className="space-y-4 text-sm">
            {active ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">{t("status")}</dt>
                  <dd className="flex items-center gap-1.5 font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> {t("connected")}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("invoicesSigned")}</dt>
                  <dd className="font-semibold text-slate-900">{status.icv}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("connectedOn")}</dt>
                  <dd className="font-semibold text-slate-900">{date(status.onboardedAt, loc)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("certificateUntil")}</dt>
                  <dd className="font-semibold text-slate-900">{date(status.certificateExpiresAt, loc)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">{t("device")}</dt>
                  <dd className="break-all font-mono text-xs text-slate-700">{status.egsSerial}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-slate-600">{t("notConnectedBody")}</p>
            )}
            {active && status.environment !== "production" && (
              <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <p>{t("testWarning")}</p>
              </div>
            )}
            {status?.lastError && !active && (
              <div className="flex gap-2 rounded-xl bg-rose-50 p-3 text-rose-800">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="break-words">{status.lastError}</p>
              </div>
            )}
            {status?.checks && (
              <div>
                <div className="mb-2 font-semibold text-slate-800">{t("checks")}</div>
                <ul className="space-y-1.5">
                  {status.checks.map((c) => (
                    <li key={c.name} className="flex items-start gap-2">
                      {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
                      <div>
                        <div className="text-slate-800">{t(`check.${c.name}`)}</div>
                        {c.messages.map((m, i) => (
                          <div key={i} className="text-xs text-slate-500">
                            {m}
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>

        {!configured && (
          <Card>
            <CardBody className="flex gap-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t("notConfigured")}
            </CardBody>
          </Card>
        )}

        {problems.length > 0 && (
          <Card>
            <CardHeader title={t("missingTitle")} description={t("missingBody")} />
            <CardBody className="space-y-3 text-sm">
              <ul className="list-inside list-disc text-slate-700">
                {problems.map((p) => (
                  <li key={p}>{t(`field.${p}`)}</li>
                ))}
              </ul>
              <Link href="/app/settings" className="font-semibold text-brand-700 hover:underline">
                {t("openCompany")}
              </Link>
            </CardBody>
          </Card>
        )}

        {canEdit && configured && problems.length === 0 && (
          <Card>
            <CardHeader title={active ? t("reconnectTitle") : t("connectTitle")} description={t("connectBody")} />
            <CardBody>
              <ActionForm action={connectZatca} className="grid gap-4 sm:grid-cols-2">
                <Field label={t("environment")} hint={t("environmentHint")}>
                  <Select name="environment" defaultValue={status?.environment ?? "simulation"}>
                    <option value="production">{t("env.production")}</option>
                    <option value="simulation">{t("env.simulation")}</option>
                    <option value="sandbox">{t("env.sandbox")}</option>
                  </Select>
                </Field>
                <Field label={t("otp")} hint={t("otpHint")}>
                  <Input name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required placeholder="123456" />
                </Field>
                <div className="sm:col-span-2 flex justify-end">
                  <SubmitButton>{active ? t("reconnect") : t("connect")}</SubmitButton>
                </div>
              </ActionForm>
            </CardBody>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader title={t("howTitle")} />
        <CardBody className="space-y-3 text-sm text-slate-600">
          <ol className="list-inside list-decimal space-y-2">
            <li>{t("how1")}</li>
            <li>{t("how2")}</li>
            <li>{t("how3")}</li>
            <li>{t("how4")}</li>
          </ol>
          <a href="https://fatoora.zatca.gov.sa/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
            fatoora.zatca.gov.sa <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <p className="text-xs text-slate-500">{t("howNote")}</p>
        </CardBody>
      </Card>
    </div>
  );
}
