import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Clock, FileSignature, Info, Package, Phone, Snowflake, TriangleAlert, User } from "lucide-react";
import { requireDriver } from "@/lib/auth";
import type { Job, JobEvent } from "@/lib/types";
import { intlLocale } from "@/lib/format";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui";
import { JobFlow } from "@/components/driver/job-flow";
import { NavigateButtons } from "@/components/driver/navigate";
import { WakeLock } from "@/components/driver/gps";
import type { DriverStep } from "../../actions";

export default async function DriverJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, driver, org } = await requireDriver();
  const t = await getTranslations("driver");
  const loc = intlLocale(await getLocale());

  const { data: job } = await supabase.from("hl_jobs").select("*").eq("id", id).eq("driver_id", driver.id).maybeSingle<Job>();
  if (!job) notFound();

  const [{ data: eventsData }, { data: customer }] = await Promise.all([
    supabase.from("hl_job_events").select("*").eq("job_id", job.id).order("created_at", { ascending: true }),
    job.customer_id
      ? supabase.from("hl_customers").select("name").eq("id", job.customer_id).maybeSingle<{ name: string }>()
      : Promise.resolve({ data: null }),
  ]);
  const events = (eventsData ?? []) as JobEvent[];
  const kinds = new Set(events.map((e) => e.kind));

  // which step comes next
  let next: DriverStep | "deliver" | "done";
  if (["delivered", "invoiced"].includes(job.status)) next = "done";
  else if (job.status === "in_transit") next = kinds.has("arrived_delivery") ? "deliver" : "arrived_delivery";
  else if (kinds.has("arrived_pickup")) next = "collected";
  else if (kinds.has("start")) next = "arrived_pickup";
  else next = "start";

  const fmtTime = (s: string) => new Intl.DateTimeFormat(loc, { hour: "2-digit", minute: "2-digit" }).format(new Date(s));
  const fmtWin = (from: string | null, to: string | null) => {
    if (!from && !to) return null;
    const day = new Intl.DateTimeFormat(loc, { weekday: "short", day: "numeric", month: "short" }).format(new Date((from ?? to)!));
    return `${day} · ${from ? fmtTime(from) : ""}${from && to ? "–" : ""}${to ? fmtTime(to) : ""}`;
  };

  const stops = [
    {
      key: "pickup",
      title: t("job.pickup"),
      dot: "bg-brand-500",
      name: job.pickup_name,
      address: job.pickup_address,
      city: [job.pickup_postcode, job.pickup_city, job.pickup_country].filter(Boolean).join(", "),
      lat: job.pickup_lat,
      lng: job.pickup_lng,
      contact: job.pickup_contact,
      phone: job.pickup_phone,
      window: fmtWin(job.pickup_from, job.pickup_to),
      active: next === "start" || next === "arrived_pickup" || next === "collected",
    },
    {
      key: "delivery",
      title: t("job.delivery"),
      dot: "bg-emerald-500",
      name: job.delivery_name,
      address: job.delivery_address,
      city: [job.delivery_postcode, job.delivery_city, job.delivery_country].filter(Boolean).join(", "),
      lat: job.delivery_lat,
      lng: job.delivery_lng,
      contact: job.delivery_contact,
      phone: job.delivery_phone,
      window: fmtWin(job.delivery_from, job.delivery_to),
      active: next === "arrived_delivery" || next === "deliver",
    },
  ];

  const problems = events.filter((e) => e.kind === "problem");

  return (
    <div className="space-y-4">
      {next !== "done" && <WakeLock />}
      <div className="flex items-center justify-between">
        <Link href="/driver" className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium text-slate-600 active:bg-slate-100">
          <ArrowLeft className="h-4 w-4" /> {t("job.back")}
        </Link>
        <StatusBadge status={job.status} />
      </div>

      <div>
        <div className="font-mono text-xs font-semibold text-slate-500">{job.reference}</div>
        <h1 className="font-display text-xl font-bold text-slate-900">
          {job.pickup_city || "—"} → {job.delivery_city || "—"}
        </h1>
        {customer?.name && <div className="text-sm text-slate-500">{customer.name}</div>}
      </div>

      {stops.map((s) => (
        <section key={s.key} className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${s.active ? "ring-2 ring-brand-300" : "ring-slate-200"}`}>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} /> {s.title}
          </div>
          <div className="text-lg font-semibold leading-snug text-slate-900">{s.name || "—"}</div>
          {s.address && <div className="text-sm text-slate-600">{s.address}</div>}
          {s.city && <div className="text-sm text-slate-600">{s.city}</div>}
          {s.window && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-sm font-medium text-slate-700">
              <Clock className="h-4 w-4" /> {s.window}
            </div>
          )}
          {(s.contact || s.phone) && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
              <User className="h-4 w-4" /> {s.contact}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <NavigateButtons lat={s.lat} lng={s.lng} address={[s.address, s.city].filter(Boolean).join(", ")} />
            {s.phone && (
              <a
                href={`tel:${s.phone.replace(/\s+/g, "")}`}
                className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 font-semibold text-slate-800 active:bg-slate-200"
              >
                <Phone className="h-5 w-5" /> {t("job.call", { name: s.contact || s.phone })}
              </a>
            )}
          </div>
        </section>
      ))}

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Package className="h-4 w-4" /> {t("job.goods")}
        </div>
        <div className="font-medium text-slate-900">{job.goods_description || "—"}</div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            [t("job.pallets"), job.pallets ?? "—"],
            [t("job.weight"), job.weight_kg ? `${Number(job.weight_kg).toLocaleString(loc)} kg` : "—"],
            [t("job.volume"), job.volume_m3 ? `${job.volume_m3} m³` : "—"],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-xl bg-slate-50 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">{k}</dt>
              <dd className="font-semibold text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          {job.adr && (
            <Badge tone="red">
              <TriangleAlert className="h-3 w-3" /> ADR {job.adr_un_number ? `· UN ${job.adr_un_number}` : ""}
            </Badge>
          )}
          {job.temperature_controlled && (
            <Badge tone="sky">
              <Snowflake className="h-3 w-3" /> {t("jobs.chilled")}
            </Badge>
          )}
          {job.customer_ref && <Badge>{t("job.customerRef", { ref: job.customer_ref })}</Badge>}
        </div>
        {job.notes && (
          <div className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" /> <p className="whitespace-pre-line">{job.notes}</p>
          </div>
        )}
      </section>

      {problems.length > 0 && (
        <section className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-rose-700">{t("job.problemsReported")}</div>
          <ul className="space-y-1.5 text-sm text-rose-900">
            {problems.map((p) => (
              <li key={p.id}>
                <span className="font-mono text-xs text-rose-600">{fmtTime(p.created_at)}</span> {p.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {next === "done" ? (
        <section className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <div className="flex items-center gap-2 font-semibold text-emerald-800">
            <FileSignature className="h-5 w-5" /> {t("job.deliveredTitle")}
          </div>
          <p className="mt-1 text-sm text-emerald-800">
            {t("job.deliveredBody", { name: job.pod_signed_by ?? "—", time: job.delivered_at ? fmtTime(job.delivered_at) : "—" })}
          </p>
        </section>
      ) : (
        <JobFlow jobId={job.id} orgId={org.id} next={next} />
      )}
    </div>
  );
}
