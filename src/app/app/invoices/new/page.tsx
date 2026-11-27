import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireOffice } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { InvoiceForm, type InvoiceFormCustomer, type InvoiceFormJob } from "@/components/invoices/invoice-form";
import { CUSTOMER_COLS, JOB_COLS } from "@/components/invoices/queries";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ job?: string; customer?: string }> }) {
  const ctx = await requireOffice(["owner", "admin", "accountant", "dispatcher"]);
  const t = await getTranslations("invoices");
  const sp = await searchParams;

  const [{ data: customers }, { data: jobs }] = await Promise.all([
    ctx.supabase.from("hl_customers").select(CUSTOMER_COLS).order("name").returns<InvoiceFormCustomer[]>(),
    ctx.supabase
      .from("hl_jobs")
      .select(JOB_COLS)
      .eq("status", "delivered")
      .is("invoice_id", null)
      .order("delivered_at", { ascending: true })
      .limit(1000)
      .returns<InvoiceFormJob[]>(),
  ]);

  return (
    <div>
      <Link href="/app/invoices" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> {t("title")}
      </Link>
      <PageHeader title={t("newTitle")} />
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
        preselectJob={sp.job}
        preselectCustomer={sp.customer}
      />
    </div>
  );
}
