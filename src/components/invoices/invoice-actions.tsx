"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, CheckCircle2, Copy, Download, ExternalLink, Loader2, Mail, Pencil, Send, Undo2, Wallet } from "lucide-react";
import { duplicateInvoice, markPaid, markSent, markUnpaid, voidInvoice } from "@/app/app/invoices/actions";
import { Button, Field, Input, buttonClass } from "@/components/ui";
import { ConfirmButton, Modal } from "@/components/app/client";
import type { InvoiceStatus } from "@/lib/types";

export function InvoiceActions({
  id,
  number,
  status,
  buyerEmail,
  emailSubject,
  emailBody,
}: {
  id: string;
  number: string;
  status: InvoiceStatus; // effective status (may be "overdue")
  buyerEmail: string | null;
  emailSubject: string;
  emailBody: string;
}) {
  const t = useTranslations("invoices");
  const tc = useTranslations("common");
  const [pending, start] = React.useTransition();
  const [payOpen, setPayOpen] = React.useState(false);
  const [paidOn, setPaidOn] = React.useState(() => new Date().toISOString().slice(0, 10));

  const run = (fn: () => Promise<unknown>, ok?: string) =>
    start(async () => {
      try {
        await fn();
        if (ok) toast.success(ok);
      } catch (e) {
        // redirects thrown by server actions are not errors
        if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
        toast.error(tc("errorGeneric"));
      }
    });

  const mailto = `mailto:${buyerEmail ?? ""}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      <a href={`/api/pdf/invoice/${id}?download=1`} className={buttonClass("secondary", "md")}>
        <Download className="h-4 w-4" /> {t("detail.downloadPdf")}
      </a>
      <a href={`/api/pdf/invoice/${id}`} target="_blank" rel="noreferrer" className={buttonClass("ghost", "md")} title={t("detail.viewPdf")}>
        <ExternalLink className="h-4 w-4" />
      </a>

      {status === "draft" && (
        <>
          <Link href={`/app/invoices/${id}/edit`} className={buttonClass("secondary", "md")}>
            <Pencil className="h-4 w-4" /> {t("detail.edit")}
          </Link>
          <Button disabled={pending} onClick={() => run(() => markSent(id), t("status.sent"))}>
            <Send className="h-4 w-4" /> {t("detail.markSent")}
          </Button>
        </>
      )}

      {(status === "sent" || status === "overdue") && (
        <Button variant="primary" disabled={pending} onClick={() => setPayOpen(true)}>
          <Wallet className="h-4 w-4" /> {t("detail.recordPayment")}
        </Button>
      )}
      {status === "paid" && (
        <Button variant="ghost" disabled={pending} onClick={() => run(() => markUnpaid(id))}>
          <Undo2 className="h-4 w-4" /> {t("detail.markUnpaid")}
        </Button>
      )}

      {status !== "void" && (
        <a
          href={mailto}
          className={buttonClass("ghost", "md")}
          onClick={() => toast.info(t("detail.emailHint"))}
          title={t("detail.emailHint")}
        >
          <Mail className="h-4 w-4" /> {t("detail.email")}
        </a>
      )}
      <Button variant="ghost" disabled={pending} onClick={() => run(() => duplicateInvoice(id))}>
        <Copy className="h-4 w-4" /> {t("detail.duplicate")}
      </Button>
      {status !== "void" && (
        <ConfirmButton action={() => voidInvoice(id)} message={t("detail.voidConfirm")} variant="ghost" size="md" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
          <Ban className="h-4 w-4" /> {t("detail.void")}
        </ConfirmButton>
      )}

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={`${t("detail.recordPayment")} · ${number}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPayOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                run(async () => {
                  await markPaid(id, paidOn);
                  setPayOpen(false);
                }, t("status.paid"))
              }
            >
              <CheckCircle2 className="h-4 w-4" /> {t("detail.markPaid")}
            </Button>
          </>
        }
      >
        <Field label={t("detail.paidOn")}>
          <Input type="date" value={paidOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setPaidOn(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
