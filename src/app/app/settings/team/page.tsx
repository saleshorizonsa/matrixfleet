import { getTranslations, getLocale } from "next-intl/server";
import { requireOffice, ADMIN_ROLES } from "@/lib/auth";
import { limitsFor } from "@/lib/plans";
import { Avatar, Badge, Card, CardHeader, EmptyState, Table, TBody, THead, TR } from "@/components/ui";
import { InviteForm, MemberActions, InvitationActions } from "@/components/settings/team-client";
import { date, intlLocale } from "@/lib/format";
import { APP_URL } from "@/lib/utils";
import type { Invitation, Membership } from "@/lib/types";
import { Users } from "lucide-react";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const ctx = await requireOffice();
  const t = await getTranslations("settings.team");
  const tn = await getTranslations("nav");
  const locale = intlLocale(await getLocale());
  const isAdmin = ADMIN_ROLES.includes(ctx.membership.role);

  const [{ data: members }, { data: invites }] = await Promise.all([
    ctx.supabase.from("hl_memberships").select("*").eq("org_id", ctx.org.id).order("created_at"),
    isAdmin
      ? ctx.supabase
          .from("hl_invitations")
          .select("*")
          .eq("org_id", ctx.org.id)
          .is("accepted_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Invitation[] }),
  ]);
  const list = (members ?? []) as Membership[];
  const pending = ((invites ?? []) as Invitation[]).filter((i) => new Date(i.expires_at) > new Date());
  const limit = limitsFor(ctx.org).users;
  const used = list.length + pending.length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card>
          <CardHeader
            title={t("members")}
            description={t("usage", { used, limit: Number.isFinite(limit) ? String(limit) : "∞" })}
          />
          <Table>
            <THead>
              <tr>
                <th>{t("name")}</th>
                <th>{t("role")}</th>
                <th>{t("joined")}</th>
                {isAdmin && <th className="text-right">{t("actions")}</th>}
              </tr>
            </THead>
            <TBody>
              {list.map((m) => (
                <TR key={m.user_id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={m.full_name ?? "?"} />
                      <div>
                        <div className="font-medium text-slate-900">{m.full_name ?? "—"}</div>
                        {m.user_id === ctx.user.id && <div className="text-xs text-slate-500">{t("you")}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge tone={m.role === "owner" ? "brand" : m.role === "driver" ? "amber" : "slate"}>{tn(`role.${m.role}`)}</Badge>
                  </td>
                  <td className="text-slate-500">{date(m.created_at, locale)}</td>
                  {isAdmin && (
                    <td className="text-right">
                      {m.user_id !== ctx.user.id && (
                        <MemberActions userId={m.user_id} role={m.role} viewerIsOwner={ctx.membership.role === "owner"} />
                      )}
                    </td>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader title={t("pending")} />
            {pending.length === 0 ? (
              <EmptyState icon={<Users className="h-6 w-6" />} title={t("noPending")} />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <th>{t("email")}</th>
                    <th>{t("role")}</th>
                    <th>{t("expires")}</th>
                    <th className="text-right">{t("actions")}</th>
                  </tr>
                </THead>
                <TBody>
                  {pending.map((i) => (
                    <TR key={i.id}>
                      <td className="font-medium">{i.email}</td>
                      <td>
                        <Badge>{tn(`role.${i.role}`)}</Badge>
                      </td>
                      <td className="text-slate-500">{date(i.expires_at, locale)}</td>
                      <td className="text-right">
                        <InvitationActions id={i.id} link={`${APP_URL}/invite/${i.token}`} email={i.email} orgName={ctx.org.name} />
                      </td>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        )}
      </div>

      {isAdmin && (
        <InviteForm
          appUrl={APP_URL}
          orgName={ctx.org.name}
          atLimit={used >= limit}
          canInviteOwner={ctx.membership.role === "owner"}
        />
      )}
    </div>
  );
}
