import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Clock, FileText, History, Lock, Package } from "lucide-react";
import { requireOffice } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { InvoiceStatusBadge } from "@/components/invoices/status";
import { ZatcaPanel } from "@/components/invoices/zatca-panel";
import { getZatcaStatus, zatcaRequired } from "@/lib/zatca";
import { buyerSnapshot, effectiveStatus, sellerSnapshot, type BuyerSnapshot, type SellerSnapshot } from "@/lib/invoices";
import { date, dateTime, daysUntil, intlLocale, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AuditLog, Customer, Invoice, InvoiceLine } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireOffice(["owner", "admin", "accountant", "dispatcher"]);
  const { data } = await supabase.from("hl_invoices").select("number").eq("id", id).maybeSingle();
  return { title: data?.number ?? "Invoice" };
}

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zatca?: string; fields?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireOffice(["owner", "admin", "accountant", "dispatcher"]);
  const t = await getTranslations("invoices");
  const loc = intlLocale(await getLocale());

  const { data: invoice } = await ctx.supabase.from("hl_invoices").select("*").eq("id", id).maybeSingle<Invoice>();
  if (!invoice) notFound();

  const saudi = zatcaRequired(ctx.org);
  const tz = await getTranslations("invoices.zatca");
  const [{ data: lines }, { data: customer }, { data: jobs }, { data: logs }, zatcaUnit, { data: original }] = await Promise.all([
    ctx.supabase.from("hl_invoice_lines").select("*").eq("invoice_id", id).order("position").returns<InvoiceLine[]>(),
    invoice.customer_id
      ? ctx.supabase.from("hl_customers").select("*").eq("id", invoice.customer_id).maybeSingle<Customer>()
      : Promise.resolve({ data: null as Customer | null }),
    ctx.supabase
      .from("hl_jobs")
      .select("id, reference, pickup_city, delivery_city, status")
      .eq("invoice_id", id)
      .returns<{ id: string; reference: string; pickup_city: string | null; delivery_city: string | null; status: string }[]>(),
    ctx.supabase
      .from("hl_audit_logs")
      .select("*")
      .eq("entity", "invoice")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<AuditLog[]>(),
    saudi ? getZatcaStatus(ctx.org.id) : Promise.resolve(null),
    invoice.original_invoice_id
      ? ctx.supabase.from("hl_invoices").select("id,number").eq("id", invoice.original_invoice_id).maybeSingle<{ id: string; number: string }>()
      : Promise.resolve({ data: null }),
  ]);
  const connected = zatcaUnit?.status === "active";
  const zs = invoice.zatca_status;
  const einvoiceLocked = !!zs && zs !== "rejected";
  const banner = sp.zatca && tz.has(`result.${sp.zatca}`) ? sp.zatca : null;
  const bannerFields = (sp.fields ?? "").split(",").filter((f) => /^[a-z_0-9]+$/.test(f)).slice(0, 10);

  const status = effectiveStatus(invoice);
  const seller = (invoice.seller_snapshot as unknown as SellerSnapshot)?.name ? (invoice.seller_snapshot as unknown as SellerSnapshot) : sellerSnapshot(ctx.org);
  const buyer = (invoice.buyer_snapshot as unknown as BuyerSnapshot)?.name
    ? (invoice.buyer_snapshot as unknown as BuyerSnapshot)
    : customer
      ? buyerSnapshot(customer)
      : ({ name: "—", kind: "business", country: ctx.org.country } as BuyerSnapshot);
  const totalStr = money(invoice.total, invoice.currency, loc);
  const company = seller.legal_name || seller.name;
  const d = daysUntil(invoice.due_date);

  return (
    <div>
      <Link href="/app/invoices" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> {t("title")}
      </Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            {invoice.doc_type === "credit_note" && (
              <span className="rounded-lg bg-violet-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-200">
                {t("creditNote")}
              </span>
            )}
            <h1 className="font-mono text-2xl font-bold text-slate-900 sm:text-[28px]">{invoice.number}</h1>
            <InvoiceStatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {buyer.name} · <span className="font-semibold text-slate-800">{totalStr}</span>
            {original && (
              <>
                {" · "}
                <Link href={`/app/invoices/${original.id}`} className="text-brand-700 hover:underline">
                  {t("creditNoteFor", { number: original.number })}
                </Link>
              </>
            )}
          </p>
        </div>
        <InvoiceActions
          id={invoice.id}
          number={invoice.number}
          status={status}
          buyerEmail={buyer.email ?? customer?.email ?? null}
          emailSubject={t("detail.emailSubject", { number: invoice.number, company })}
          emailBody={t("detail.emailBody", { number: invoice.number, total: totalStr, due: date(invoice.due_date, loc), company })}
          docType={invoice.doc_type ?? "invoice"}
          einvoiceLocked={einvoiceLocked}
          einvoicing={connected}
        />
      </div>

      {banner && (
        <div
          className={cn(
            "mb-6 rounded-2xl p-4 text-sm ring-1",
            ["cleared", "reported"].includes(banner)
              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
              : banner === "warning" || banner === "pending"
                ? "bg-amber-50 text-amber-900 ring-amber-200"
                : "bg-rose-50 text-rose-800 ring-rose-200",
          )}
        >
          <div className="font-semibold">{tz(`result.${banner}`)}</div>
          {bannerFields.length > 0 && (
            <div className="mt-1">
              {tz("missingBuyer")}{" "}
              {bannerFields.map((f) => (tz.has(`buyerField.${f}`) ? tz(`buyerField.${f}`) : f)).join(", ")}
              {invoice.customer_id && (
                <>
                  {" · "}
                  <Link href={`/app/customers/${invoice.customer_id}/edit`} className="font-semibold underline">
                    {tz("editCustomer")}
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <InvoicePreview invoice={invoice} lines={lines ?? []} seller={seller} buyer={buyer} status={status} locale={loc} />

        <div className="space-y-6">
          {saudi && (
            <ZatcaPanel
              inv={invoice}
              connected={connected}
              submittedLabel={invoice.zatca_submitted_at ? tz("submittedOn", { date: dateTime(invoice.zatca_submitted_at, loc) }) : null}
            />
          )}
          <Card>
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                {status === "draft" ? <FileText className="mt-0.5 h-4 w-4 text-slate-400" /> : <Lock className="mt-0.5 h-4 w-4 text-slate-400" />}
                <p className="text-slate-600">{status === "draft" ? t("detail.draftNote") : t("detail.immutableNote")}</p>
              </div>
              {(status === "sent" || status === "overdue") && d !== null && (
                <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2 font-medium", d < 0 ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-700")}>
                  <Clock className="h-4 w-4" />
                  {d < 0 ? t("detail.overdueBy", { days: -d }) : t("detail.dueIn", { days: d })}
                </div>
              )}
              {invoice.sent_at && <div className="text-slate-500">{t("detail.sentOn", { date: date(invoice.sent_at, loc) })}</div>}
              {invoice.paid_at && <div className="font-medium text-emerald-700">{t("detail.paidOnDate", { date: date(invoice.paid_at, loc) })}</div>}
            </CardBody>
          </Card>

          {!!jobs?.length && (
            <Card>
              <CardHeader title={t("detail.linkedJobs")} />
              <ul className="divide-y divide-slate-100">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <Link href={`/app/jobs/${j.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      <Package className="h-4 w-4 text-brand-500" />
                      <span className="font-mono font-semibold text-slate-900">{j.reference}</span>
                      <span className="truncate text-slate-500">
                        {j.pickup_city ?? "—"} → {j.delivery_city ?? "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {!!logs?.length && (
            <Card>
              <CardHeader title={t("detail.activity")} />
              <ol className="space-y-3 p-5">
                {logs.map((l) => (
                  <li key={l.id} className="flex gap-3 text-sm">
                    <History className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                    <div>
                      <div className="font-medium text-slate-800">{l.action.replace("invoice.", "")}</div>
                      <div className="text-xs text-slate-400">
                        {dateTime(l.created_at, loc)}
                        {l.actor_email ? ` · ${l.actor_email}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
