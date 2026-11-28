"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Copy, FileMinus2, Loader2, Pencil, Send, Undo2, Wallet } from "lucide-react";
import { DocumentToolbar } from "@/components/documents/document-toolbar";
import { createCreditNote, duplicateInvoice, markPaid, markSent, markUnpaid, voidInvoice } from "@/app/app/invoices/actions";
import { Button, Field, Input, Textarea, buttonClass } from "@/components/ui";
import { ConfirmButton, Modal } from "@/components/app/client";
import type { InvoiceStatus } from "@/lib/types";

export function InvoiceActions({
  id,
  number,
  status,
  buyerEmail,
  emailSubject,
  emailBody,
  buyerPhone = null,
  whatsappText = "",
  docType = "invoice",
  einvoiceLocked = false,
  einvoicing = false,
}: {
  id: string;
  number: string;
  status: InvoiceStatus; // effective status (may be "overdue")
  buyerEmail: string | null;
  emailSubject: string;
  emailBody: string;
  buyerPhone?: string | null;
  whatsappText?: string;
  docType?: "invoice" | "credit_note" | "debit_note";
  /** submitted to ZATCA: cannot be voided or edited, only credited */
  einvoiceLocked?: boolean;
  /** company issues through ZATCA (issuing may take a moment and can be refused) */
  einvoicing?: boolean;
}) {
  const router = useRouter();
  const tz = useTranslations("invoices.zatca");
  const [creditOpen, setCreditOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      <DocumentToolbar
        kind="invoice"
        id={id}
        filename={`${number}.pdf`}
        shareable={status !== "draft" && status !== "void"}
        email={{ to: buyerEmail ?? "", subject: emailSubject, message: emailBody }}
        whatsapp={{ phone: buyerPhone ?? "", message: whatsappText }}
      />

      {status === "draft" && (
        <>
          <Link href={`/app/invoices/${id}/edit`} className={buttonClass("secondary", "md")}>
            <Pencil className="h-4 w-4" /> {t("detail.edit")}
          </Link>
          <Button
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await markSent(id);
                if (!r.ok) toast.error(tz.has(`result.${r.zatca}`) ? tz(`result.${r.zatca}`) : tz("result.failed"));
                else toast.success(r.zatca ? tz(`result.${r.zatca}`) : t("status.sent"));
                router.refresh();
              })
            }
          >
            <Send className="h-4 w-4" /> {einvoicing ? tz("issue") : t("detail.markSent")}
          </Button>
        </>
      )}

      {(status === "sent" || status === "overdue") && docType === "invoice" && (
        <Button variant="primary" disabled={pending} onClick={() => setPayOpen(true)}>
          <Wallet className="h-4 w-4" /> {t("detail.recordPayment")}
        </Button>
      )}
      {status === "paid" && (
        <Button variant="ghost" disabled={pending} onClick={() => run(() => markUnpaid(id))}>
          <Undo2 className="h-4 w-4" /> {t("detail.markUnpaid")}
        </Button>
      )}

      {docType === "invoice" && (
        <Button variant="ghost" disabled={pending} onClick={() => run(() => duplicateInvoice(id))}>
          <Copy className="h-4 w-4" /> {t("detail.duplicate")}
        </Button>
      )}
      {docType === "invoice" && status !== "draft" && status !== "void" && (
        <Button variant="ghost" disabled={pending} onClick={() => setCreditOpen(true)}>
          <FileMinus2 className="h-4 w-4" /> {t("detail.creditNote")}
        </Button>
      )}
      {status !== "void" && !einvoiceLocked && (
        <ConfirmButton action={() => voidInvoice(id)} message={t("detail.voidConfirm")} variant="ghost" size="md" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
          <Ban className="h-4 w-4" /> {t("detail.void")}
        </ConfirmButton>
      )}

      <Modal
        open={creditOpen}
        onClose={() => setCreditOpen(false)}
        title={`${t("detail.creditNote")} · ${number}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreditOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button disabled={pending || reason.trim().length < 3} onClick={() => run(() => createCreditNote(id, reason))}>
              <FileMinus2 className="h-4 w-4" /> {t("detail.createCreditNote")}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">{t("detail.creditNoteHelp")}</p>
        <Field label={t("form.creditReason")}>
          <Textarea value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>

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
