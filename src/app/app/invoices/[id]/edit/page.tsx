import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireOffice } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { InvoiceForm, type InvoiceFormCustomer, type InvoiceFormJob } from "@/components/invoices/invoice-form";
import { CUSTOMER_COLS, JOB_COLS } from "@/components/invoices/queries";
import type { Invoice, InvoiceLine } from "@/lib/types";

export const metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOffice(["owner", "admin", "accountant", "dispatcher"]);
  const t = await getTranslations("invoices");

  const { data: invoice } = await ctx.supabase.from("hl_invoices").select("*").eq("id", id).maybeSingle<Invoice>();
  if (!invoice) notFound();
  if (invoice.status !== "draft") redirect(`/app/invoices/${id}`);
  // signed for ZATCA and waiting for an answer: no edits, only "retry"
  if (invoice.zatca_status && invoice.zatca_status !== "rejected") redirect(`/app/invoices/${id}`);

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: lines }, { data: customers }, { data: jobs }, { data: original }] = await Promise.all([
    ctx.supabase.from("hl_invoice_lines").select("*").eq("invoice_id", id).order("position").returns<InvoiceLine[]>(),
    ctx.supabase.from("hl_customers").select(CUSTOMER_COLS).order("name").returns<InvoiceFormCustomer[]>(),
    ctx.supabase
      .from("hl_jobs")
      .select(JOB_COLS)
      .or(`and(status.eq.delivered,invoice_id.is.null),invoice_id.eq.${id}`)
      .order("delivered_at", { ascending: true })
      .limit(1000)
      .returns<InvoiceFormJob[]>(),
    invoice.original_invoice_id
      ? ctx.supabase.from("hl_invoices").select("number").eq("id", invoice.original_invoice_id).maybeSingle<{ number: string }>()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div>
      <Link href={`/app/invoices/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> {invoice.number}
      </Link>
      <PageHeader title={invoice.doc_type === "credit_note" ? t("creditNoteTitle", { number: invoice.number }) : t("editTitle", { number: invoice.number })} />
      <InvoiceForm
        customers={customers ?? []}
        jobs={jobs ?? []}
        org={{
          country: ctx.org.country,
          default_vat_rate: Number(ctx.org.default_vat_rate),
          currency: ctx.org.currency,
          payment_terms_days: ctx.org.payment_terms_days,
          locale: ctx.org.locale,
        }}
        initial={{
          invoice_id: invoice.id,
          number: invoice.number,
          customer_id: invoice.customer_id,
          issue_date: invoice.issue_date,
          supply_date: invoice.supply_date,
          due_date: invoice.due_date,
          currency: invoice.currency,
          vat_treatment: invoice.vat_treatment,
          vat_rate: Number(invoice.vat_rate),
          vat_note: invoice.vat_note,
          notes: invoice.notes,
          doc_type: invoice.doc_type,
          adjustment_reason: invoice.adjustment_reason,
          original_number: original?.number ?? null,
          lines: (lines ?? []).map((l) => ({ description: l.description, quantity: Number(l.quantity), unit_price: Number(l.unit_price), job_id: l.job_id })),
        }}
      />
    </div>
  );
}
