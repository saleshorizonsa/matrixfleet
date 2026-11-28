import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BadgeCheck, Plus, Search, Users } from "lucide-react";
import { requireOffice } from "@/lib/auth";
import { Badge, Card, EmptyState, Input, LinkButton, PageHeader, TBody, THead, TR, Table } from "@/components/ui";
import { Flag } from "@/components/customers/flag";
import { ImportCustomersButton } from "@/components/customers/import-dialog";
import { intlLocale, money } from "@/lib/format";
import type { Customer } from "@/lib/types";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const ctx = await requireOffice();
  const t = await getTranslations("customers");
  const loc = intlLocale(await getLocale());

  let query = ctx.supabase.from("hl_customers").select("*").eq("org_id", ctx.org.id).order("name").limit(500);
  // characters with meaning in PostgREST filter syntax are removed so search text can't alter the filter
  // (commas and brackets would add conditions; dots inside a value are harmless, so email search still works)
  const needle = q?.trim().replace(/[%,()*"\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  if (needle) query = query.or(`name.ilike.%${needle}%,email.ilike.%${needle}%,city.ilike.%${needle}%,vat_number.ilike.%${needle}%,postcode.ilike.%${needle}%`);
  const [{ data }, { data: jobs }] = await Promise.all([
    query,
    ctx.supabase.from("hl_jobs").select("customer_id, price_net, status").eq("org_id", ctx.org.id).neq("status", "cancelled").limit(10000),
  ]);
  const customers = (data ?? []) as Customer[];
  const stats = new Map<string, { jobs: number; revenue: number }>();
  for (const j of (jobs ?? []) as { customer_id: string | null; price_net: number | null; status: string }[]) {
    if (!j.customer_id) continue;
    const s = stats.get(j.customer_id) ?? { jobs: 0, revenue: 0 };
    s.jobs++;
    if (j.status === "delivered" || j.status === "invoiced") s.revenue += Number(j.price_net ?? 0);
    stats.set(j.customer_id, s);
  }

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("subtitle", { count: customers.length })}
        actions={
          <>
            <ImportCustomersButton />
            <LinkButton href="/app/customers/new">
              <Plus className="h-4 w-4" /> {t("add")}
            </LinkButton>
          </>
        }
      />
      <Card>
        <form className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder={t("searchPlaceholder")} className="pl-9" />
          </div>
        </form>
        {customers.length === 0 ? (
          <EmptyState
            icon={<Users className="h-7 w-7" />}
            title={needle ? t("noResults") : t("emptyTitle")}
            description={needle ? undefined : t("emptyText")}
            action={
              !needle && (
                <LinkButton href="/app/customers/new">
                  <Plus className="h-4 w-4" /> {t("add")}
                </LinkButton>
              )
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <th>{t("columns.customer")}</th>
                <th>{t("columns.location")}</th>
                <th>{t("columns.vat")}</th>
                <th className="text-right">{t("columns.jobs")}</th>
                <th className="text-right">{t("columns.revenue")}</th>
              </tr>
            </THead>
            <TBody>
              {customers.map((c) => {
                const s = stats.get(c.id);
                return (
                  <TR key={c.id}>
                    <td>
                      <Link href={`/app/customers/${c.id}`} className="group flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 font-display text-sm font-bold text-brand-600">
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span>
                          <span className="block font-medium text-slate-900 group-hover:text-brand-600">{c.name}</span>
                          <span className="block text-xs text-slate-500">{c.contact_name ?? c.email ?? t(`kind.${c.kind}`)}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="text-slate-600">
                      <Flag code={c.country} className="mr-1.5" />
                      {[c.city, c.postcode].filter(Boolean).join(", ") || c.country}
                    </td>
                    <td>
                      {c.vat_number ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-mono text-xs text-slate-600">{c.vat_number}</span>
                          {c.vat_verified ? (
                            <BadgeCheck className="h-4 w-4 text-emerald-500" aria-label={t("vat.verified")} />
                          ) : (
                            <Badge tone="amber">{t("vat.unverified")}</Badge>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{s?.jobs ?? 0}</td>
                    <td className="text-right font-medium tabular-nums">{money(s?.revenue ?? 0, ctx.org.currency, loc)}</td>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
