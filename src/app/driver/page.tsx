import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowDown, CheckCircle2, ChevronRight, Clock, Package, PartyPopper, TriangleAlert } from "lucide-react";
import { requireDriver } from "@/lib/auth";
import type { Job } from "@/lib/types";
import { intlLocale } from "@/lib/format";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui";
import { GpsToggle } from "@/components/driver/gps";
import { InstallPrompt } from "@/components/driver/pwa";
import { cn } from "@/lib/utils";

export const metadata = { title: "My jobs" };

function isoDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function timeRange(from: string | null, to: string | null, loc: string) {
  const f = (s: string) => new Intl.DateTimeFormat(loc, { hour: "2-digit", minute: "2-digit" }).format(new Date(s));
  if (from && to) return `${f(from)}–${f(to)}`;
  if (from) return `${f(from)}+`;
  if (to) return `≤ ${f(to)}`;
  return null;
}

export default async function DriverJobsPage() {
  const { supabase, driver } = await requireDriver();
  const t = await getTranslations("driver");
  const loc = intlLocale(await getLocale());

  const today = isoDay(0);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [{ data: dated }, { data: undated }, { data: delivered }] = await Promise.all([
    // open jobs up to a week ahead (older dates show as overdue)
    supabase
      .from("hl_jobs")
      .select("*")
      .eq("driver_id", driver.id)
      .in("status", ["booked", "assigned", "in_transit"])
      .lte("scheduled_date", isoDay(7))
      .order("scheduled_date", { ascending: true })
      .order("sort_order", { ascending: true })
      .limit(100),
    supabase
      .from("hl_jobs")
      .select("*")
      .eq("driver_id", driver.id)
      .in("status", ["booked", "assigned", "in_transit"])
      .is("scheduled_date", null)
      .order("sort_order")
      .limit(20),
    // finished today, shown greyed out
    supabase
      .from("hl_jobs")
      .select("*")
      .eq("driver_id", driver.id)
      .eq("status", "delivered")
      .gte("delivered_at", startOfToday.toISOString())
      .order("delivered_at")
      .limit(50),
  ]);
  const doneJobs = ((delivered ?? []) as Job[]).map((j) => ({ ...j, scheduled_date: today }));
  const all = [...((undated ?? []) as Job[]), ...((dated ?? []) as Job[]), ...doneJobs];

  const groups = new Map<string, Job[]>();
  for (const j of all) {
    const key = !j.scheduled_date ? "anytime" : j.scheduled_date < today && j.status !== "delivered" ? "overdue" : j.scheduled_date;
    groups.set(key, [...(groups.get(key) ?? []), j]);
  }
  const order = [...groups.keys()].sort((a, b) => {
    const rank = (k: string) => (k === "overdue" ? "0" : k === "anytime" ? "9" : "1" + k);
    return rank(a).localeCompare(rank(b));
  });

  const label = (key: string) => {
    if (key === "overdue") return t("jobs.overdue");
    if (key === "anytime") return t("jobs.unscheduled");
    if (key === today) return t("jobs.today");
    if (key === isoDay(1)) return t("jobs.tomorrow");
    return new Intl.DateTimeFormat(loc, { weekday: "long", day: "numeric", month: "short" }).format(new Date(key));
  };

  const openToday = all.filter((j) => j.status !== "delivered" && (j.scheduled_date ?? today) <= today).length;
  const doneToday = all.filter((j) => j.status === "delivered").length;
  const firstName = driver.full_name.split(" ")[0];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">{t("jobs.hello", { name: firstName })}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{t("jobs.summary", { open: openToday, done: doneToday })}</p>
      </div>

      <InstallPrompt />
      <GpsToggle />

      {all.length === 0 && (
        <div className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-slate-200">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">
            <PartyPopper className="h-7 w-7" />
          </div>
          <div className="font-display text-lg font-semibold">{t("jobs.emptyTitle")}</div>
          <p className="mt-1 text-sm text-slate-500">{t("jobs.emptyBody")}</p>
        </div>
      )}

      {order.map((key) => (
        <section key={key}>
          <h2
            className={cn(
              "mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider",
              key === "overdue" ? "text-rose-600" : "text-slate-500",
            )}
          >
            {key === "overdue" && <TriangleAlert className="h-3.5 w-3.5" />}
            {label(key)}
            <span className="rounded-full bg-slate-200 px-1.5 text-[10px] text-slate-600">{groups.get(key)!.length}</span>
          </h2>
          <ul className="space-y-3">
            {groups.get(key)!.map((job) => {
              const done = job.status === "delivered";
              const pickupWin = timeRange(job.pickup_from, job.pickup_to, loc);
              const dropWin = timeRange(job.delivery_from, job.delivery_to, loc);
              return (
                <li key={job.id}>
                  <Link
                    href={`/driver/jobs/${job.id}`}
                    className={cn(
                      "block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition active:scale-[0.99]",
                      job.status === "in_transit" && "ring-2 ring-amber-300",
                      done && "opacity-60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-500">{job.reference}</span>
                      <div className="flex items-center gap-1.5">
                        {job.adr && <Badge tone="red">ADR</Badge>}
                        {job.temperature_controlled && <Badge tone="sky">{t("jobs.chilled")}</Badge>}
                        <StatusBadge status={job.status} />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-3">
                      <div className="flex flex-col items-center pt-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                        <span className="my-1 w-px flex-1 bg-slate-200" />
                        <ArrowDown className="h-3 w-3 text-slate-300" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div>
                          <div className="truncate font-semibold text-slate-900">{job.pickup_name || job.pickup_city || "—"}</div>
                          <div className="truncate text-sm text-slate-500">
                            {[job.pickup_city, job.pickup_postcode].filter(Boolean).join(" · ")}
                            {pickupWin && (
                              <span className="ml-1.5 inline-flex items-center gap-1 text-slate-700">
                                <Clock className="h-3 w-3" /> {pickupWin}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="truncate font-semibold text-slate-900">{job.delivery_name || job.delivery_city || "—"}</div>
                          <div className="truncate text-sm text-slate-500">
                            {[job.delivery_city, job.delivery_postcode].filter(Boolean).join(" · ")}
                            {dropWin && (
                              <span className="ml-1.5 inline-flex items-center gap-1 text-slate-700">
                                <Clock className="h-3 w-3" /> {dropWin}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 self-center text-slate-300" />
                    </div>
                    {(job.goods_description || job.pallets || job.weight_kg) && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Package className="h-3.5 w-3.5" />}
                        <span className="truncate">
                          {[
                            job.goods_description,
                            job.pallets ? t("jobs.pallets", { count: job.pallets }) : null,
                            job.weight_kg ? `${Number(job.weight_kg).toLocaleString(loc)} kg` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
