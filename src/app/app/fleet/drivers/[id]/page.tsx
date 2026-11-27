import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Clock, Mail, MapPin, Pencil, Phone, Smartphone, Trash2 } from "lucide-react";
import { requireOffice, canManage } from "@/lib/auth";
import { Avatar, Badge, Card, CardBody, CardHeader, LinkButton, PageHeader, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/app/client";
import { StatusBadge } from "@/components/app/status-badge";
import { ExpiryBadge, OnlineDot } from "@/components/fleet/ui";
import { InviteDriverButton } from "@/components/fleet/invite-driver";
import { DRIVER_DOCS, isOnline } from "@/components/fleet/compliance";
import { deleteDriver } from "../../actions";
import { date, dateTime, intlLocale } from "@/lib/format";
import type { Driver, DriverShift, Job } from "@/lib/types";

function minutesBetween(a: string, b: string | null) {
  return Math.max(0, Math.round(((b ? new Date(b) : new Date()).getTime() - new Date(a).getTime()) / 60000));
}
function daysAgoIso(days: number) {
  return new Date(new Date().getTime() - days * 86_400_000).toISOString();
}
function hm(min: number) {
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOffice();
  const t = await getTranslations("fleet");
  const tc = await getTranslations("common");
  const loc = intlLocale(await getLocale());

  const { data: driver } = await ctx.supabase.from("hl_drivers").select("*").eq("id", id).eq("org_id", ctx.org.id).maybeSingle<Driver>();
  if (!driver) notFound();

  const weekAgo = daysAgoIso(7);
  const [{ data: shifts }, { data: jobs }, { count: deliveredCount }] = await Promise.all([
    ctx.supabase.from("hl_driver_shifts").select("*").eq("driver_id", id).order("started_at", { ascending: false }).limit(14),
    ctx.supabase
      .from("hl_jobs")
      .select("id, reference, status, scheduled_date, pickup_city, delivery_city")
      .eq("driver_id", id)
      .order("scheduled_date", { ascending: false })
      .limit(10),
    ctx.supabase.from("hl_jobs").select("id", { count: "exact", head: true }).eq("driver_id", id).gte("delivered_at", weekAgo),
  ]);
  const shiftList = (shifts ?? []) as DriverShift[];
  const weekMinutes = shiftList
    .filter((s) => s.started_at >= weekAgo)
    .reduce((sum, s) => sum + minutesBetween(s.started_at, s.ended_at) - (s.break_minutes ?? 0), 0);
  const online = isOnline(driver.last_seen_at);

  return (
    <>
      <Link href="/app/fleet/drivers" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> {t("drivers.title")}
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={driver.full_name} colour={driver.colour} size={44} />
            {driver.full_name}
          </span>
        }
        description={
          <span className="flex items-center gap-2">
            <OnlineDot online={online} />
            {online ? t("drivers.onlineNow") : driver.last_seen_at ? t("drivers.lastSeen", { when: dateTime(driver.last_seen_at, loc) }) : t("drivers.neverSeen")}
          </span>
        }
        actions={
          <>
            {canManage(ctx.membership.role) && (
              <ConfirmButton action={deleteDriver.bind(null, driver.id)} message={tc("confirmDelete")} variant="ghost" size="md">
                <Trash2 className="h-4 w-4" /> {tc("delete")}
              </ConfirmButton>
            )}
            {!driver.user_id && <InviteDriverButton driverId={driver.id} email={driver.email} name={driver.full_name} orgName={ctx.org.name} />}
            <LinkButton href={`/app/fleet/drivers/${driver.id}/edit`} variant="secondary">
              <Pencil className="h-4 w-4" /> {tc("edit")}
            </LinkButton>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("drivers.hoursWeek")} value={hm(weekMinutes)} icon={<Clock className="h-5 w-5" />} />
        <Stat label={t("drivers.deliveredWeek")} value={deliveredCount ?? 0} icon={<MapPin className="h-5 w-5" />} tone="green" />
        <Stat
          label={t("drivers.app")}
          value={driver.user_id ? t("drivers.linked") : t("drivers.notLinked")}
          icon={<Smartphone className="h-5 w-5" />}
          tone={driver.user_id ? "brand" : "amber"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader title={t("drivers.contact")} />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="h-4 w-4 text-slate-400" /> {driver.phone ? <a href={`tel:${driver.phone}`} className="hover:text-brand-600">{driver.phone}</a> : "—"}
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="h-4 w-4 text-slate-400" /> {driver.email ? <a href={`mailto:${driver.email}`} className="hover:text-brand-600">{driver.email}</a> : "—"}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t("drivers.licenceNumber")}</span>
                <span className="font-mono">{driver.licence_number ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t("drivers.licenceCategories")}</span>
                <span>{driver.licence_categories ?? "—"}</span>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("drivers.licences")} />
            <CardBody className="space-y-3">
              {DRIVER_DOCS.map((doc) => (
                <div key={doc} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-600">{t(`docs.${doc}`)}</span>
                  <ExpiryBadge date={driver[doc]} />
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t("drivers.shifts")} />
            {shiftList.length === 0 ? (
              <CardBody className="text-sm text-slate-500">{t("drivers.noShifts")}</CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {shiftList.map((s) => {
                  const worked = minutesBetween(s.started_at, s.ended_at) - (s.break_minutes ?? 0);
                  return (
                    <li key={s.id} className="flex items-center justify-between px-5 py-3 text-sm">
                      <span>
                        <span className="font-medium text-slate-900">{date(s.started_at, loc)}</span>
                        <span className="ml-2 text-slate-500">
                          {new Date(s.started_at).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })} –{" "}
                          {s.ended_at ? new Date(s.ended_at).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" }) : t("drivers.ongoing")}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{t("drivers.breakMin", { min: s.break_minutes ?? 0 })}</span>
                        <Badge tone={!s.ended_at ? "green" : worked > 13 * 60 ? "red" : "slate"}>{hm(worked)}</Badge>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title={t("drivers.recentJobs")} />
            {(jobs ?? []).length === 0 ? (
              <CardBody className="text-sm text-slate-500">{t("vehicles.noJobs")}</CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {((jobs ?? []) as Pick<Job, "id" | "reference" | "status" | "scheduled_date" | "pickup_city" | "delivery_city">[]).map((j) => (
                  <li key={j.id}>
                    <Link href={`/app/jobs/${j.id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50">
                      <span>
                        <span className="font-mono font-medium text-slate-900">{j.reference}</span>
                        <span className="ml-2 text-slate-500">
                          {j.pickup_city ?? "?"} → {j.delivery_city ?? "?"}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{date(j.scheduled_date, loc)}</span>
                        <StatusBadge status={j.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
