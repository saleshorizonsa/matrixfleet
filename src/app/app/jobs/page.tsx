import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Calculator, Flame, Package, Plus, Search, Snowflake } from "lucide-react";
import { requireOffice } from "@/lib/auth";
import { Avatar, Card, EmptyState, Input, LinkButton, PageHeader, Table, TBody, THead, TR, buttonClass } from "@/components/ui";
import { StatusBadge } from "@/components/app/status-badge";
import { JOB_STATUSES, date as fmtDate, distance, intlLocale, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Job, JobStatus } from "@/lib/types";

export const metadata = { title: "Jobs" };

const PAGE_SIZE = 50;

type Row = Job & {
  customer: { name: string } | null;
  driver: { full_name: string; colour: string } | null;
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; date?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireOffice();
  const t = await getTranslations("jobs");
  const locale = intlLocale(await getLocale());
  const status = JOB_STATUSES.includes(sp.status as JobStatus) ? (sp.status as JobStatus) : sp.status === "active" ? "active" : undefined;
  const q = (sp.q ?? "").replace(/[,()%*]/g, " ").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  let query = ctx.supabase
    .from("hl_jobs")
    .select("*, customer:hl_customers(name), driver:hl_drivers(full_name, colour)", { count: "exact" })
    .eq("org_id", ctx.org.id)
    .order("scheduled_date", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status === "active") query = query.in("status", ["booked", "assigned", "in_transit"]);
  else if (status) query = query.eq("status", status);
  if (sp.date) query = query.eq("scheduled_date", sp.date);
  if (q) {
    const like = `%${q}%`;
    query = query.or(
      ["reference", "customer_ref", "pickup_city", "delivery_city", "pickup_postcode", "delivery_postcode", "goods_description"]
        .map((c) => `${c}.ilike.${like}`)
        .join(","),
    );
  }

  const [{ data, count }, { data: statusRows }] = await Promise.all([
    query,
    ctx.supabase.from("hl_jobs").select("status").eq("org_id", ctx.org.id).limit(10000),
  ]);
  const jobs = (data ?? []) as Row[];
  const counts: Record<string, number> = {};
  for (const r of statusRows ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const activeCount = (counts.booked ?? 0) + (counts.assigned ?? 0) + (counts.in_transit ?? 0);
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const tabs: { key: string | undefined; label: string; n: number }[] = [
    { key: undefined, label: t("tabs.all"), n: totalCount },
    { key: "active", label: t("tabs.active"), n: activeCount },
    ...(["quote", "booked", "assigned", "in_transit", "delivered", "invoiced", "cancelled"] as JobStatus[]).map((s) => ({
      key: s,
      label: t(`tabs.${s}`),
      n: counts[s] ?? 0,
    })),
  ];
  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, status: sp.status, date: sp.date, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/app/jobs${s ? `?${s}` : ""}`;
  };
  const pages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <LinkButton href="/app/jobs/new?quote=1" variant="secondary">
              <Calculator className="h-4 w-4" /> {t("newQuote")}
            </LinkButton>
            <LinkButton href="/app/jobs/new">
              <Plus className="h-4 w-4" /> {t("newJob")}
            </LinkButton>
          </>
        }
      />

      <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
        {tabs.map((tab) => {
          const active = (sp.status ?? undefined) === tab.key;
          return (
            <Link
              key={tab.key ?? "all"}
              href={href({ status: tab.key, page: undefined })}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition",
                active ? "bg-ink-900 text-white shadow" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900",
              )}
            >
              {tab.label}
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-white/15" : "bg-slate-100 text-slate-500")}>{tab.n}</span>
            </Link>
          );
        })}
      </div>

      <Card>
        <form className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row" action="/app/jobs">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={sp.q} placeholder={t("searchPlaceholder")} className="pl-9" />
          </div>
          <Input name="date" type="date" defaultValue={sp.date} className="sm:w-44" />
          <button className={buttonClass("secondary")}>{t("applyFilters")}</button>
          {(sp.q || sp.date) && (
            <Link href={href({ q: undefined, date: undefined })} className={buttonClass("ghost")}>
              {t("clearFilters")}
            </Link>
          )}
        </form>

        {jobs.length === 0 ? (
          <EmptyState
            icon={<Package className="h-7 w-7" />}
            title={q || sp.date || status ? t("emptyFiltered") : t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <LinkButton href="/app/jobs/new">
                <Plus className="h-4 w-4" /> {t("newJob")}
              </LinkButton>
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <th>{t("reference")}</th>
                <th>{t("customer")}</th>
                <th>{t("routeCol")}</th>
                <th>{t("date")}</th>
                <th>{t("driver")}</th>
                <th>{t("statusCol")}</th>
                <th className="text-right">{t("price")}</th>
              </tr>
            </THead>
            <TBody>
              {jobs.map((j) => (
                <TR key={j.id} className="group cursor-pointer">
                  <td>
                    <Link href={`/app/jobs/${j.id}`} className="font-mono text-[13px] font-semibold text-brand-600 group-hover:underline">
                      {j.reference}
                    </Link>
                    <div className="mt-0.5 flex gap-1">
                      {j.adr && <Flame className="h-3.5 w-3.5 text-orange-500" aria-label="ADR" />}
                      {j.temperature_controlled && <Snowflake className="h-3.5 w-3.5 text-sky-500" />}
                    </div>
                  </td>
                  <td className="max-w-[180px] truncate text-slate-700">{j.customer?.name ?? <span className="text-slate-400">—</span>}</td>
                  <td>
                    <Link href={`/app/jobs/${j.id}`} className="flex items-center gap-1.5 text-slate-800">
                      <span className="truncate">{j.pickup_city || j.pickup_postcode || "—"}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{j.delivery_city || j.delivery_postcode || "—"}</span>
                    </Link>
                    <div className="text-xs text-slate-400">{distance(j.distance_km, ctx.org.distance_unit)}</div>
                  </td>
                  <td className="whitespace-nowrap text-slate-600">{fmtDate(j.scheduled_date, locale)}</td>
                  <td>
                    {j.driver ? (
                      <span className="inline-flex items-center gap-2 text-slate-700">
                        <Avatar name={j.driver.full_name} colour={j.driver.colour} size={24} />
                        <span className="truncate">{j.driver.full_name}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={j.status} />
                  </td>
                  <td className="text-right font-medium tabular-nums text-slate-900">{money(j.price_net, j.currency, locale)}</td>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>{t("pageOf", { page, pages })}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link className={buttonClass("secondary", "sm")} href={href({ page: String(page - 1) })}>
                  ←
                </Link>
              )}
              {page < pages && (
                <Link className={buttonClass("secondary", "sm")} href={href({ page: String(page + 1) })}>
                  →
                </Link>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
