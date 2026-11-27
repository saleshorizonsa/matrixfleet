import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ClipboardX, FileText, KanbanSquare, MapPinned, Package,
  PartyPopper, Plus, Receipt, Timer, Truck, Wallet, Wifi,
} from "lucide-react";
import { requireOffice } from "@/lib/auth";
import { Avatar, Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, Stat } from "@/components/ui";
import { StatusBadge } from "@/components/app/status-badge";
import { RevenueChart, StatusDonut, type DayPoint } from "@/components/dashboard/charts";
import { GettingStarted, type ChecklistStep } from "@/components/dashboard/checklist";
import { URGENCY_TONE, complianceItems, isOnline } from "@/components/fleet/compliance";
import { JOB_STATUSES, intlLocale, money } from "@/lib/format";
import type { Driver, Job, JobStatus, Vehicle, VehicleCheck } from "@/lib/types";

export const metadata = { title: "Dashboard" };

function isoDay(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

type JobLite = Pick<
  Job,
  "id" | "reference" | "status" | "scheduled_date" | "pickup_city" | "delivery_city" | "pickup_from" | "delivery_to" | "delivered_at" | "price_net" | "driver_id" | "customer_id" | "created_at"
>;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string; denied?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireOffice();
  const t = await getTranslations("dashboard");
  const tf = await getTranslations("fleet");
  const locale = await getLocale();
  const loc = intlLocale(locale);
  const { supabase, org } = ctx;

  const now = new Date();
  const today = isoDay(now);
  const since30 = new Date(now.getTime() - 29 * 86_400_000);
  since30.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const jobCols = "id, reference, status, scheduled_date, pickup_city, delivery_city, pickup_from, delivery_to, delivered_at, price_net, driver_id, customer_id, created_at";

  const [
    { data: todayJobs },
    { data: deliveredRecent },
    { data: recentJobs },
    { count: inTransit },
    { data: invoices },
    { data: drivers },
    { data: vehicles },
    { data: checks },
    { count: customerCount },
    { count: jobCount },
    { count: memberCount },
    { count: inviteCount },
  ] = await Promise.all([
    supabase.from("hl_jobs").select(jobCols).eq("org_id", org.id).eq("scheduled_date", today).not("status", "in", "(quote,cancelled)").order("sort_order").order("pickup_from"),
    supabase.from("hl_jobs").select(jobCols).eq("org_id", org.id).gte("delivered_at", since30.toISOString()).in("status", ["delivered", "invoiced"]),
    supabase.from("hl_jobs").select("status").eq("org_id", org.id).gte("created_at", since30.toISOString()),
    supabase.from("hl_jobs").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("status", "in_transit"),
    supabase.from("hl_invoices").select("total, status, due_date").eq("org_id", org.id).in("status", ["sent", "overdue"]),
    supabase.from("hl_drivers").select("*").eq("org_id", org.id).neq("status", "inactive"),
    supabase.from("hl_vehicles").select("*").eq("org_id", org.id),
    supabase.from("hl_vehicle_checks").select("id, vehicle_id, created_at, passed, resolved_at").eq("org_id", org.id).eq("passed", false).is("resolved_at", null).limit(20),
    supabase.from("hl_customers").select("id", { count: "exact", head: true }).eq("org_id", org.id),
    supabase.from("hl_jobs").select("id", { count: "exact", head: true }).eq("org_id", org.id),
    supabase.from("hl_memberships").select("user_id", { count: "exact", head: true }).eq("org_id", org.id),
    supabase.from("hl_invitations").select("id", { count: "exact", head: true }).eq("org_id", org.id),
  ]);

  const todays = (todayJobs ?? []) as JobLite[];
  const delivered = (deliveredRecent ?? []) as JobLite[];
  const driverList = (drivers ?? []) as Driver[];
  const vehicleList = (vehicles ?? []) as Vehicle[];
  const openDefects = (checks ?? []) as Pick<VehicleCheck, "id" | "vehicle_id" | "created_at" | "passed" | "resolved_at">[];
  const driverById = new Map(driverList.map((d) => [d.id, d]));
  const regById = new Map(vehicleList.map((v) => [v.id, v.registration]));

  // KPIs
  const deliveredWeek = delivered.filter((j) => j.delivered_at && j.delivered_at >= weekAgo).length;
  const revenueMonth = delivered.filter((j) => j.delivered_at && j.delivered_at >= monthStart).reduce((s, j) => s + Number(j.price_net ?? 0), 0);
  const invList = (invoices ?? []) as { total: number; status: string; due_date: string }[];
  const outstanding = invList.reduce((s, i) => s + Number(i.total), 0);
  const overdue = invList.filter((i) => i.status === "overdue" || i.due_date < today).length;
  const withWindow = delivered.filter((j) => j.delivery_to && j.delivered_at);
  const onTime = withWindow.length ? Math.round((withWindow.filter((j) => j.delivered_at! <= j.delivery_to!).length / withWindow.length) * 100) : null;

  // Chart series (last 30 days)
  const series: DayPoint[] = [];
  const byDay = new Map<string, DayPoint>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(since30.getTime() + i * 86_400_000);
    const key = isoDay(d);
    const p = { day: key, label: new Intl.DateTimeFormat(loc, { day: "numeric", month: "short" }).format(d), revenue: 0, jobs: 0 };
    series.push(p);
    byDay.set(key, p);
  }
  for (const j of delivered) {
    const p = byDay.get(isoDay(new Date(j.delivered_at!)));
    if (p) {
      p.revenue += Number(j.price_net ?? 0);
      p.jobs += 1;
    }
  }
  const statusCounts = new Map<JobStatus, number>();
  for (const r of (recentJobs ?? []) as { status: JobStatus }[]) statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);
  const donut = JOB_STATUSES.filter((s) => statusCounts.get(s)).map((s) => ({ status: s, count: statusCounts.get(s)! }));

  // Compliance alerts
  const alerts = complianceItems(vehicleList, driverList).filter((i) => i.days !== null && i.days <= 30).slice(0, 8);
  const online = driverList.filter((d) => isOnline(d.last_seen_at));

  const steps: ChecklistStep[] = [
    { key: "company", done: !!(org.address_line1 && (org.vat_number || org.company_number)), href: "/app/settings" },
    { key: "customer", done: (customerCount ?? 0) > 0, href: "/app/customers/new" },
    { key: "vehicle", done: vehicleList.length > 0, href: "/app/fleet/vehicles/new" },
    { key: "driver", done: driverList.length > 0, href: "/app/fleet/drivers/new" },
    { key: "job", done: (jobCount ?? 0) > 0, href: "/app/jobs/new" },
    { key: "team", done: (memberCount ?? 0) > 1 || (inviteCount ?? 0) > 0, href: "/app/settings/team" },
    { key: "plan", done: org.plan !== "trial", href: "/app/settings/billing" },
  ];

  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(now));
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const firstName = (ctx.membership.full_name || ctx.user.email).split(/[\s@]/)[0];

  return (
    <div className="space-y-6">
      {sp.welcome && (
        <div className="animate-fade-up relative overflow-hidden rounded-2xl bg-ink-900 p-6 text-white">
          <div className="bg-grid absolute inset-0 opacity-60" />
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand-500/40 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-lime-signal text-ink-900">
              <PartyPopper className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">{t("welcome.title", { org: org.name })}</h2>
              <p className="mt-1 max-w-2xl text-sm text-white/70">{t("welcome.text")}</p>
            </div>
          </div>
        </div>
      )}
      {sp.denied && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          <AlertTriangle className="h-4 w-4" /> {t("denied")}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm text-slate-500">{new Intl.DateTimeFormat(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now)}</div>
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-[28px]">{t(`greeting.${greeting}`, { name: firstName })}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/app/jobs/new">
            <Plus className="h-4 w-4" /> {t("quick.newJob")}
          </LinkButton>
          <LinkButton href="/app/jobs/new?quote=1" variant="secondary">
            <FileText className="h-4 w-4" /> {t("quick.newQuote")}
          </LinkButton>
          <LinkButton href="/app/dispatch" variant="secondary">
            <KanbanSquare className="h-4 w-4" /> {t("quick.dispatch")}
          </LinkButton>
          <LinkButton href="/app/tracking" variant="dark">
            <MapPinned className="h-4 w-4" /> {t("quick.liveMap")}
          </LinkButton>
        </div>
      </div>

      <GettingStarted steps={steps} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label={t("kpi.today")} value={todays.length} icon={<CalendarDays className="h-5 w-5" />} delta={t("kpi.todayHint")} />
        <Stat label={t("kpi.inTransit")} value={inTransit ?? 0} icon={<Truck className="h-5 w-5" />} tone="amber" delta={t("kpi.onlineDrivers", { count: online.length })} />
        <Stat label={t("kpi.deliveredWeek")} value={deliveredWeek} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" delta={onTime !== null ? t("kpi.onTime", { pct: onTime }) : t("kpi.onTimeNa")} />
        <Stat label={t("kpi.revenueMonth")} value={money(revenueMonth, org.currency, loc)} icon={<Wallet className="h-5 w-5" />} tone="brand" delta={t("kpi.revenueHint")} />
        <Stat
          label={t("kpi.outstanding")}
          value={money(outstanding, org.currency, loc)}
          icon={<Receipt className="h-5 w-5" />}
          tone={overdue ? "red" : "sky"}
          delta={overdue ? t("kpi.overdue", { count: overdue }) : t("kpi.invoicesOpen", { count: invList.length })}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={t("charts.revenueTitle")}
            description={t("charts.revenueSubtitle")}
            action={
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand-500" /> {t("charts.revenue")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-lime-signal" /> {t("charts.jobs")}
                </span>
              </div>
            }
          />
          <CardBody>
            <RevenueChart data={series} currency={org.currency} locale={loc} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("charts.statusTitle")} description={t("charts.statusSubtitle")} />
          <CardBody>
            <StatusDonut data={donut} />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={t("schedule.title")}
            description={t("schedule.subtitle", { count: todays.length })}
            action={
              <Link href="/app/dispatch" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
                {t("schedule.openBoard")} <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
          {todays.length === 0 ? (
            <EmptyState
              icon={<Package className="h-7 w-7" />}
              title={t("schedule.emptyTitle")}
              description={t("schedule.emptyText")}
              action={
                <LinkButton href="/app/jobs/new" size="sm">
                  <Plus className="h-4 w-4" /> {t("quick.newJob")}
                </LinkButton>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {todays.slice(0, 10).map((j) => {
                const d = j.driver_id ? driverById.get(j.driver_id) : undefined;
                return (
                  <li key={j.id}>
                    <Link href={`/app/jobs/${j.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                      <div className="w-14 shrink-0 text-center">
                        <div className="text-sm font-semibold text-slate-900">
                          {j.pickup_from ? new Date(j.pickup_from).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">{t("schedule.pickup")}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-sm font-medium text-slate-900">{j.reference}</div>
                        <div className="truncate text-sm text-slate-500">
                          {j.pickup_city ?? "?"} <ArrowRight className="inline h-3 w-3" /> {j.delivery_city ?? "?"}
                        </div>
                      </div>
                      <div className="hidden items-center gap-2 sm:flex">
                        {d ? (
                          <>
                            <Avatar name={d.full_name} colour={d.colour} size={26} />
                            <span className="text-sm text-slate-600">{d.full_name.split(" ")[0]}</span>
                          </>
                        ) : (
                          <Badge tone="amber">{t("schedule.unassigned")}</Badge>
                        )}
                      </div>
                      <StatusBadge status={j.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title={t("alerts.title")}
              action={
                <Link href="/app/fleet/compliance" className="text-sm font-medium text-brand-600 hover:underline">
                  {t("alerts.all")}
                </Link>
              }
            />
            {alerts.length === 0 && openDefects.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-6 text-sm text-slate-500">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" /> {t("alerts.allGood")}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {openDefects.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <Link href={`/app/fleet/vehicles/${c.vehicle_id}`} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm hover:bg-slate-50">
                      <span className="flex items-center gap-2">
                        <ClipboardX className="h-4 w-4 text-rose-500" />
                        <span className="font-mono font-medium">{regById.get(c.vehicle_id) ?? "—"}</span>
                        <span className="text-slate-500">{t("alerts.defect")}</span>
                      </span>
                      <Badge tone="red">{t("alerts.open")}</Badge>
                    </Link>
                  </li>
                ))}
                {alerts.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/app/fleet/${a.subjectType === "vehicle" ? "vehicles" : "drivers"}/${a.subjectId}`}
                      className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm hover:bg-slate-50"
                    >
                      <span className="min-w-0 truncate">
                        <span className={a.subjectType === "vehicle" ? "font-mono font-medium" : "font-medium"}>{a.subjectLabel}</span>
                        <span className="ml-1.5 text-slate-500">{tf(`docs.${a.doc}`)}</span>
                      </span>
                      <Badge tone={URGENCY_TONE[a.urgency]}>
                        {a.urgency === "expired" ? tf("urgency.expired") : tf("urgency.inDays", { days: a.days! })}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title={t("online.title")}
              action={
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
                  <Wifi className="h-3.5 w-3.5" /> {online.length}/{driverList.length}
                </span>
              }
            />
            {online.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-6 text-sm text-slate-500">
                <Timer className="h-5 w-5 text-slate-300" /> {t("online.none")}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {online.map((d) => (
                  <li key={d.id}>
                    <Link href={`/app/tracking?driver=${d.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-slate-50">
                      <Avatar name={d.full_name} colour={d.colour} size={28} />
                      <span className="flex-1 font-medium text-slate-800">{d.full_name}</span>
                      <span className="text-xs text-slate-400">
                        {d.last_speed != null ? `${Math.round(d.last_speed * 3.6 * (org.distance_unit === "mi" ? 0.621371 : 1))} ${org.distance_unit === "mi" ? "mph" : "km/h"}` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
