"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatDistanceToNowStrict } from "date-fns";
import { Gauge, MapPinOff, Package, Phone, Radio, Search, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MapView, type MapMarker } from "@/components/maps";
import { Avatar, Card, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/types";

export interface LiveDriver {
  id: string;
  full_name: string;
  colour: string;
  phone: string | null;
  status: string;
  last_lat: number | null;
  last_lng: number | null;
  last_speed: number | null;
  last_seen_at: string | null;
  vehicle: string | null;
}
export interface LiveJob {
  id: string;
  reference: string;
  status: JobStatus;
  driver_id: string | null;
  delivery_city: string | null;
  delivery_postcode: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_to: string | null;
  scheduled_date: string | null;
}

const ONLINE_MS = 10 * 60_000;

export function LiveMap({ orgId, drivers: initial, jobs, unit }: { orgId: string; drivers: LiveDriver[]; jobs: LiveJob[]; unit: "km" | "mi" }) {
  const t = useTranslations("tracking");
  const [drivers, setDrivers] = React.useState(initial);
  const [focus, setFocus] = React.useState<[number, number] | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [showDrops, setShowDrops] = React.useState(true);
  const [now, setNow] = React.useState(() => Date.now());

  // re-sync when the server sends a fresh list (prop change), without an effect
  const [prevInitial, setPrevInitial] = React.useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setDrivers(initial);
  }

  // realtime GPS updates
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live-${orgId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "hl_drivers", filter: `org_id=eq.${orgId}` }, (payload: { new: unknown }) => {
        const row = payload.new as Partial<LiveDriver> & { id: string };
        setDrivers((ds) => ds.map((d) => (d.id === row.id ? { ...d, ...row, vehicle: d.vehicle } : d)));
      })
      .subscribe();
    const timer = setInterval(() => setNow(Date.now()), 30_000); // refresh "online" / "x min ago"
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  const isOnline = (d: LiveDriver) => !!d.last_seen_at && now - new Date(d.last_seen_at).getTime() < ONLINE_MS;
  const currentJob = (d: LiveDriver) => jobs.find((j) => j.driver_id === d.id && j.status === "in_transit");
  const filtered = drivers.filter((d) => !q || d.full_name.toLowerCase().includes(q.toLowerCase()) || d.vehicle?.toLowerCase().includes(q.toLowerCase()));
  const onlineCount = drivers.filter(isOnline).length;
  const inTransit = jobs.filter((j) => j.status === "in_transit").length;
  const delivered = jobs.filter((j) => j.status === "delivered").length;

  const markers: MapMarker[] = [];
  for (const d of drivers) {
    if (d.last_lat == null || d.last_lng == null) continue;
    const job = currentJob(d);
    markers.push({
      id: d.id,
      kind: "driver",
      lat: d.last_lat,
      lng: d.last_lng,
      label: d.full_name,
      color: d.colour,
      live: isOnline(d),
      popup: (
        <div className="min-w-[160px] text-sm">
          <div className="font-semibold">{d.full_name}</div>
          <div className="text-xs text-slate-500">{d.vehicle ?? ""}</div>
          {job && (
            <div className="mt-1 text-xs">
              {job.reference} → {job.delivery_city}
            </div>
          )}
          {d.last_seen_at && <div className="mt-1 text-xs text-slate-400">{formatDistanceToNowStrict(new Date(d.last_seen_at), { addSuffix: true })}</div>}
        </div>
      ),
    });
  }
  if (showDrops) {
    for (const j of jobs) {
      if (j.delivery_lat == null || j.delivery_lng == null) continue;
      const d = drivers.find((x) => x.id === j.driver_id);
      markers.push({
        id: `job-${j.id}`,
        kind: "delivery",
        lat: j.delivery_lat,
        lng: j.delivery_lng,
        label: `${j.reference} · ${j.delivery_city ?? j.delivery_postcode ?? ""}`,
        color: j.status === "delivered" ? "#10b981" : d?.colour ?? "#94a3b8",
      });
    }
  }

  const select = (d: LiveDriver) => {
    setSelected(d.id);
    if (d.last_lat != null && d.last_lng != null) setFocus([d.last_lat, d.last_lng]);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <div className="order-2 space-y-4 lg:order-1">
        <div className="grid grid-cols-3 gap-2">
          <Mini label={t("online")} value={`${onlineCount}/${drivers.length}`} tone="text-emerald-600" />
          <Mini label={t("inTransit")} value={inTransit} tone="text-amber-600" />
          <Mini label={t("deliveredToday")} value={delivered} tone="text-brand-600" />
        </div>
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchDrivers")} className="pl-9" />
            </div>
          </div>
          <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
            {filtered.length === 0 && <li className="p-6 text-center text-sm text-slate-400">{t("noDrivers")}</li>}
            {filtered.map((d) => {
              const online = isOnline(d);
              const job = currentJob(d);
              const hasPos = d.last_lat != null;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => select(d)}
                    className={cn("flex w-full items-start gap-3 p-3 text-left transition hover:bg-slate-50", selected === d.id && "bg-brand-50/60")}
                  >
                    <span className="relative mt-0.5">
                      <Avatar name={d.full_name} colour={d.colour} size={38} />
                      <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white", online ? "bg-emerald-500" : "bg-slate-300")} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-slate-900">{d.full_name}</span>
                        {d.last_speed != null && online && (
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-500">
                            <Gauge className="h-3 w-3" />
                            {Math.round(unit === "mi" ? d.last_speed * 2.23694 : d.last_speed * 3.6)} {unit === "mi" ? "mph" : "km/h"}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Truck className="h-3 w-3" /> {d.vehicle ?? "—"}
                        <span className="mx-1">·</span>
                        {hasPos && d.last_seen_at ? (
                          formatDistanceToNowStrict(new Date(d.last_seen_at), { addSuffix: true })
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <MapPinOff className="h-3 w-3" /> {t("noPosition")}
                          </span>
                        )}
                      </span>
                      {job && (
                        <Link href={`/app/jobs/${job.id}`} className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 hover:underline">
                          <Package className="h-3 w-3" /> {job.reference} → {job.delivery_city ?? job.delivery_postcode}
                        </Link>
                      )}
                    </span>
                    {d.phone && (
                      <a href={`tel:${d.phone}`} onClick={(e) => e.stopPropagation()} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Call">
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card className="relative order-1 overflow-hidden lg:order-2">
        <MapView markers={markers} fitOnce focus={focus} className="h-[55vh] w-full lg:h-[calc(100vh-190px)]" onMarkerClick={(id) => setSelected(id)} />
        <div className="pointer-events-none absolute left-3 top-3 z-[500] flex gap-2">
          <span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow ring-1 ring-slate-200">
            <Radio className="h-3.5 w-3.5" /> {t("liveUpdates")}
          </span>
          <label className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow ring-1 ring-slate-200">
            <input type="checkbox" checked={showDrops} onChange={(e) => setShowDrops(e.target.checked)} className="accent-brand-500" />
            {t("showDeliveries")}
          </label>
        </div>
      </Card>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) {
  return (
    <Card className="p-3">
      <div className={cn("font-display text-xl font-bold", tone)}>{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </Card>
  );
}
