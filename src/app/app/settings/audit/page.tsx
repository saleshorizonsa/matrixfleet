import { getTranslations, getLocale } from "next-intl/server";
import { ScrollText } from "lucide-react";
import { requireOffice, ADMIN_ROLES } from "@/lib/auth";
import { Badge, Card, EmptyState, LinkButton, Table, TBody, THead, TR } from "@/components/ui";
import { dateTime, intlLocale } from "@/lib/format";
import type { AuditLog } from "@/lib/types";

export const metadata = { title: "Audit log" };
const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireOffice(ADMIN_ROLES);
  const t = await getTranslations("settings.audit");
  const locale = intlLocale(await getLocale());
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim();

  let query = ctx.supabase
    .from("hl_audit_logs")
    .select("*", { count: "exact" })
    .eq("org_id", ctx.org.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.ilike("action", `%${q.replace(/[%_]/g, "")}%`);
  const { data, count } = await query;
  const rows = (data ?? []) as AuditLog[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (p: number) => `/app/settings/audit?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">{t("title")}</h3>
          <p className="text-sm text-slate-500">{t("subtitle")}</p>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder={t("filter")}
            className="h-9 rounded-xl px-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </form>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-6 w-6" />} title={t("empty")} />
      ) : (
        <Table>
          <THead>
            <tr>
              <th>{t("when")}</th>
              <th>{t("who")}</th>
              <th>{t("action")}</th>
              <th>{t("entity")}</th>
              <th>{t("details")}</th>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <td className="whitespace-nowrap text-slate-500">{dateTime(r.created_at, locale)}</td>
                <td className="text-slate-700">{r.actor_email ?? (r.user_id ? r.user_id.slice(0, 8) : t("system"))}</td>
                <td>
                  <Badge tone={r.action.includes("deleted") || r.action.includes("removed") ? "red" : r.action.startsWith("billing") ? "violet" : "slate"}>
                    {r.action}
                  </Badge>
                </td>
                <td className="text-slate-500">
                  {r.entity}
                  {r.entity_id ? <span className="ml-1 font-mono text-xs text-slate-400">{r.entity_id.slice(0, 12)}</span> : null}
                </td>
                <td className="max-w-xs truncate font-mono text-xs text-slate-400" title={JSON.stringify(r.details)}>
                  {Object.keys(r.details ?? {}).length ? JSON.stringify(r.details) : ""}
                </td>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
          <span>{t("page", { page, pages })}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <LinkButton href={href(page - 1)} variant="secondary" size="sm">
                {t("prev")}
              </LinkButton>
            )}
            {page < pages && (
              <LinkButton href={href(page + 1)} variant="secondary" size="sm">
                {t("next")}
              </LinkButton>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
