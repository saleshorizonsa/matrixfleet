"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Clock, FileCode2, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { retryZatca } from "@/app/app/invoices/actions";
import { Button, Card, CardBody, CardHeader, buttonClass } from "@/components/ui";
import type { Invoice } from "@/lib/types";

type Props = Pick<Invoice, "id" | "zatca_status" | "zatca_kind" | "zatca_icv" | "zatca_messages" | "zatca_env" | "zatca_submitted_at" | "status">;

/** ZATCA state of a Saudi e-invoice: cleared / reported / waiting / rejected, with retry. */
export function ZatcaPanel({ inv, connected, submittedLabel }: { inv: Props; connected: boolean; submittedLabel: string | null }) {
  const t = useTranslations("invoices.zatca");
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const st = inv.zatca_status;

  const retry = () =>
    start(async () => {
      const r = await retryZatca(inv.id);
      if (r.ok) toast.success(t(`result.${r.zatca ?? "cleared"}`));
      else toast.error(t.has(`result.${r.zatca}`) ? t(`result.${r.zatca}`) : t("result.failed"));
      router.refresh();
    });

  const icon =
    st === "cleared" || st === "reported" ? (
      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
    ) : st === "warning" ? (
      <ShieldCheck className="h-5 w-5 text-amber-600" />
    ) : st === "rejected" ? (
      <XCircle className="h-5 w-5 text-rose-600" />
    ) : (
      <Clock className="h-5 w-5 text-slate-400" />
    );

  return (
    <Card>
      <CardHeader title={t("title")} />
      <CardBody className="space-y-3 text-sm">
        <div className="flex items-start gap-3">
          {icon}
          <div>
            <div className="font-semibold text-slate-900">{t(`state.${st ?? (connected ? "notSubmitted" : "notConnected")}`)}</div>
            <div className="text-slate-500">
              {inv.zatca_kind ? t(`kind.${inv.zatca_kind}`) : null}
              {inv.zatca_icv ? ` · ICV ${inv.zatca_icv}` : null}
              {inv.zatca_env && inv.zatca_env !== "production" ? ` · ${t(`env.${inv.zatca_env}`)}` : null}
            </div>
            {submittedLabel && <div className="text-xs text-slate-400">{submittedLabel}</div>}
          </div>
        </div>
        {!!inv.zatca_messages?.length && (
          <ul className={`space-y-1 rounded-xl p-3 text-xs ${st === "rejected" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-900"}`}>
            {inv.zatca_messages.map((m, i) => (
              <li key={i} className="break-words">
                {m}
              </li>
            ))}
          </ul>
        )}
        {st === "rejected" && inv.status === "draft" && <p className="text-slate-600">{t("rejectedHelp")}</p>}
        {(st === "failed" || (st === "rejected" && inv.status === "draft")) && connected && (
          <Button variant="secondary" disabled={pending} onClick={retry}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {st === "failed" ? t("retry") : t("resubmit")}
          </Button>
        )}
        {st && st !== "rejected" && (
          <a href={`/api/zatca/xml/${inv.id}`} className={buttonClass("ghost", "sm")}>
            <FileCode2 className="h-4 w-4" /> {t("downloadXml")}
          </a>
        )}
        {!connected && !st && <p className="text-xs text-slate-500">{t("phase1Note")}</p>}
      </CardBody>
    </Card>
  );
}
