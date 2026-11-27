import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { IdCard, Plus, Smartphone } from "lucide-react";
import { requireOffice } from "@/lib/auth";
import { Avatar, Badge, Card, EmptyState, LinkButton, PageHeader, TBody, THead, TR, Table } from "@/components/ui";
import { ExpiryBadge, OnlineDot } from "@/components/fleet/ui";
import { isOnline } from "@/components/fleet/compliance";
import type { Driver } from "@/lib/types";

export const metadata = { title: "Drivers" };

const STATUS_TONE = { active: "green", off: "slate", inactive: "red" } as const;

export default async function DriversPage() {
  const ctx = await requireOffice();
  const t = await getTranslations("fleet");
  const { data } = await ctx.supabase.from("hl_drivers").select("*").eq("org_id", ctx.org.id).order("full_name");
  const drivers = (data ?? []) as Driver[];
  const online = drivers.filter((d) => isOnline(d.last_seen_at)).length;

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("drivers.title")}
        description={t("drivers.summary", { count: drivers.length, online })}
        actions={
          <LinkButton href="/app/fleet/drivers/new">
            <Plus className="h-4 w-4" /> {t("drivers.add")}
          </LinkButton>
        }
      />
      <Card>
        {drivers.length === 0 ? (
          <EmptyState
            icon={<IdCard className="h-7 w-7" />}
            title={t("drivers.emptyTitle")}
            description={t("drivers.emptyText")}
            action={
              <LinkButton href="/app/fleet/drivers/new">
                <Plus className="h-4 w-4" /> {t("drivers.add")}
              </LinkButton>
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <th>{t("drivers.driver")}</th>
                <th>{t("drivers.status")}</th>
                <th>{t("docs.licence_expiry")}</th>
                <th>{t("docs.cpc_expiry")}</th>
                <th>{t("docs.tacho_card_expiry")}</th>
                <th>{t("drivers.app")}</th>
              </tr>
            </THead>
            <TBody>
              {drivers.map((d) => (
                <TR key={d.id}>
                  <td>
                    <Link href={`/app/fleet/drivers/${d.id}`} className="flex items-center gap-3">
                      <span className="relative">
                        <Avatar name={d.full_name} colour={d.colour} size={36} />
                        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-0.5">
                          <OnlineDot online={isOnline(d.last_seen_at)} />
                        </span>
                      </span>
                      <span>
                        <span className="block font-medium text-slate-900 hover:text-brand-600">{d.full_name}</span>
                        <span className="block text-xs text-slate-500">{d.phone ?? d.email ?? "—"}</span>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[d.status]}>{t(`driverStatus.${d.status}`)}</Badge>
                  </td>
                  <td>
                    <ExpiryBadge date={d.licence_expiry} compact />
                  </td>
                  <td>
                    <ExpiryBadge date={d.cpc_expiry} compact />
                  </td>
                  <td>
                    <ExpiryBadge date={d.tacho_card_expiry} compact />
                  </td>
                  <td>
                    {d.user_id ? (
                      <Badge tone="brand">
                        <Smartphone className="h-3 w-3" /> {t("drivers.linked")}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400">{t("drivers.notLinked")}</span>
                    )}
                  </td>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
