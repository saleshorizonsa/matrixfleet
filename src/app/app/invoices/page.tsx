import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertCircle, CheckCircle2, Clock, Plus, Receipt, Search, Truck } from "lucide-react";
import { requireOffice } from "@/lib/auth";
import { Card, EmptyState, Input, LinkButton, PageHeader, Stat, TBody, THead, TR, Table } from "@/components/ui";
import { InvoiceStatusBadge, sumByCurrency } from "@/components/invoices/status";
import { INVOICE_TABS, effectiveStatus, paidWithin, type InvoiceTab } from "@/lib/invoices";
import { date, daysUntil, intlLocale, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/lib/types";

export const metadata = { title: "Invoices" };

type Row = Invoice & { customer: { name: string } | null };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const ctx = await requireOffice(["owner", "admin", "accountant", "dispatcher"]);
  const t = await getTranslations("invoices");
  const loc = intlLocale(await getLocale());
  const sp = await searchParams;
  const tab: InvoiceTab = (INVOICE_TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as InvoiceTab) : "all";
  const q = (sp.q ?? "").trim().toLowerCase();

  const [{ data }, { count: toInvoice }] = await Promise.all([
    ctx.supabase
      .from("hl_invoices")
      .select("*, customer:hl_customers(name)")
      .order("issue_date", { ascending: false })
      .order("number", { ascending: false })
      .limit(1000)
      .returns<Row[]>(),
    ctx.supabase.from("hl_jobs").select("id", { count: "exact", head: true }).eq("status", "delivered").is("invoice_id", null),
  ]);

  const all = (data ?? []).map((i) => ({ ...i, eff: effectiveStatus(i) }));
  const counts = Object.fromEntries(INVOICE_TABS.map((k) => [k, k === "all" ? all.length : all.filter((i) => i.eff === k).length]));
  const rows = all
    .filter((i) => tab === "all" || i.eff === tab)
    .filter((i) => !q || i.number.toLowerCase().includes(q) || (i.customer?.name ?? "").toLowerCase().includes(q));

  const fmtSums = (sums: Record<string, number>) => {
    const entries = Object.entries(sums);
    if (!entries.length) return money(0, ctx.org.currency, loc);
    return entries.map(([c, v]) => money(v, c, loc)).join(" · ");
  };
  const outstanding = all.filter((i) => i.eff === "sent" || i.eff === "overdue");
  const overdue = all.filter((i) => i.eff === "overdue");
  const paid30 = paidWithin(
    all.filter((i) => i.eff === "paid"),
    30,
  );

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <LinkButton href="/app/invoices/new">
            <Plus className="h-4 w-4" /> {t("new")}
          </LinkButton>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("kpi.outstanding")} value={fmtSums(sumByCurrency(outstanding))} delta={t("kpi.invoicesCount", { count: outstanding.length })} icon={<Clock className="h-5 w-5" />} tone="sky" />
        <Stat label={t("kpi.overdue")} value={fmtSums(sumByCurrency(overdue))} delta={t("kpi.invoicesCount", { count: overdue.length })} icon={<AlertCircle className="h-5 w-5" />} tone="red" />
        <Stat label={t("kpi.paid30")} value={fmtSums(sumByCurrency(paid30))} delta={t("kpi.invoicesCount", { count: paid30.length })} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <Link href="/app/invoices/new" className="block transition hover:-translate-y-0.5">
          <Stat label={t("kpi.toInvoice")} value={t("kpi.jobsCount", { count: toInvoice ?? 0 })} delta={t("new") + " →"} icon={<Truck className="h-5 w-5" />} tone="amber" />
        </Link>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex gap-1 overflow-x-auto">
            {INVOICE_TABS.map((k) => (
              <Link
                key={k}
                href={`/app/invoices?tab=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  tab === k ? "bg-ink-900 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {t(`tabs.${k}`)}
                <span className={cn("rounded-full px-1.5 text-xs", tab === k ? "bg-white/15" : "bg-slate-100 text-slate-500")}>{counts[k]}</span>
              </Link>
            ))}
          </nav>
          <form className="relative sm:w-64">
            <input type="hidden" name="tab" value={tab} />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={sp.q} placeholder={`${t("cols.number")}, ${t("cols.customer")}…`} className="h-9 pl-9" />
          </form>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-7 w-7" />}
            title={t("empty.title")}
            description={t("empty.description")}
            action={
              <LinkButton href="/app/invoices/new">
                <Plus className="h-4 w-4" /> {t("new")}
              </LinkButton>
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <th>{t("cols.number")}</th>
                <th>{t("cols.customer")}</th>
                <th className="hidden md:table-cell">{t("cols.issued")}</th>
                <th>{t("cols.due")}</th>
                <th className="text-right">{t("cols.total")}</th>
                <th>{t("cols.status")}</th>
              </tr>
            </THead>
            <TBody>
              {rows.map((i) => {
                const d = daysUntil(i.due_date);
                return (
                  <TR key={i.id} className="cursor-pointer">
                    <td>
                      <Link href={`/app/invoices/${i.id}`} className="font-mono text-sm font-semibold text-slate-900 hover:text-brand-600">
                        {i.number}
                      </Link>
                    </td>
                    <td className="max-w-[240px] truncate">
                      <Link href={`/app/invoices/${i.id}`}>{i.customer?.name ?? (i.buyer_snapshot as { name?: string })?.name ?? "—"}</Link>
                    </td>
                    <td className="hidden text-slate-500 md:table-cell">{date(i.issue_date, loc)}</td>
                    <td>
                      <div className="text-slate-700">{date(i.due_date, loc)}</div>
                      {(i.eff === "sent" || i.eff === "overdue") && d !== null && (
                        <div className={cn("text-xs", d < 0 ? "text-rose-600" : "text-slate-400")}>
                          {d < 0 ? t("detail.overdueBy", { days: -d }) : t("detail.dueIn", { days: d })}
                        </div>
                      )}
                    </td>
                    <td className="text-right font-semibold tabular-nums text-slate-900">{money(i.total, i.currency, loc)}</td>
                    <td>
                      <InvoiceStatusBadge status={i.eff} />
                    </td>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
