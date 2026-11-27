"use client";
import { DB_SCHEMA } from "@/lib/supabase/schema";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock, Flame, GripVertical, Inbox, Loader2, Map as MapIcon, Radio, Route, Snowflake, Truck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, Badge, Button, Card, Input } from "@/components/ui";
import { MapView, type MapMarker } from "@/components/maps";
import { STATUS_COLORS, intlLocale, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/types";
import { moveJob } from "./actions";

export interface BoardJob {
  id: string;
  reference: string;
  status: JobStatus;
  driver_id: string | null;
  sort_order: number;
  scheduled_date: string | null;
  pickup_city: string | null;
  pickup_postcode: string | null;
  delivery_city: string | null;
  delivery_postcode: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  distance_km: number | null;
  pallets: number | null;
  weight_kg: number | null;
  adr: boolean;
  temperature_controlled: boolean;
  pickup_from: string | null;
  delivery_to: string | null;
  price_net: number | null;
  currency: string;
  customer: { name: string } | null;
}
export interface BoardDriver {
  id: string;
  full_name: string;
  colour: string;
  vehicle: string | null;
  last_seen_at: string | null;
}

const UNASSIGNED = "unassigned";
type Columns = Record<string, string[]>;

function buildColumns(jobs: BoardJob[], drivers: BoardDriver[]): Columns {
  const cols: Columns = { [UNASSIGNED]: [] };
  for (const d of drivers) cols[d.id] = [];
  const sorted = [...jobs].sort((a, b) => a.sort_order - b.sort_order);
  for (const j of sorted) {
    const key = j.driver_id && cols[j.driver_id] ? j.driver_id : UNASSIGNED;
    cols[key].push(j.id);
  }
  return cols;
}

const draggable = (s: JobStatus) => s === "booked" || s === "assigned";

export function DispatchBoard({
  day,
  orgId,
  unit,
  drivers,
  jobs,
}: {
  day: string;
  orgId: string;
  unit: "km" | "mi";
  drivers: BoardDriver[];
  jobs: BoardJob[];
}) {
  const t = useTranslations("dispatch");
  const locale = intlLocale(useLocale());
  const router = useRouter();
  const [columns, setColumns] = React.useState<Columns>(() => buildColumns(jobs, drivers));
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [showMap, setShowMap] = React.useState(false);
  const originCol = React.useRef<string | null>(null);
  const jobById = React.useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  // resync from server data (realtime refreshes, navigation) when not dragging
  const sig = jobs.map((j) => `${j.id}:${j.driver_id}:${j.sort_order}:${j.status}`).join("|") + drivers.map((d) => d.id).join(",");
  const [prevSig, setPrevSig] = React.useState(sig);
  if (sig !== prevSig && !activeId) {
    setPrevSig(sig);
    setColumns(buildColumns(jobs, drivers));
  }
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // live updates
  React.useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`dispatch-${orgId}`)
      .on("postgres_changes", { event: "*", schema: DB_SCHEMA, table: "hl_jobs", filter: `org_id=eq.${orgId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 600);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [orgId, router]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findCol = (id: string) => (id in columns ? id : Object.keys(columns).find((k) => columns[k].includes(id)));

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    originCol.current = findCol(String(e.active.id)) ?? null;
  };

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const from = findCol(String(active.id));
    const to = findCol(String(over.id));
    if (!from || !to || from === to) return;
    setColumns((cols) => {
      const fromItems = cols[from].filter((x) => x !== active.id);
      const toItems = [...cols[to]];
      const overIndex = toItems.indexOf(String(over.id));
      const index = overIndex >= 0 ? overIndex : toItems.length;
      toItems.splice(index, 0, String(active.id));
      return { ...cols, [from]: fromItems, [to]: toItems };
    });
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    const id = String(active.id);
    setActiveId(null);
    if (!over) return;
    const col = findCol(id);
    if (!col) return;
    let ordered = columns[col];
    const overIndex = ordered.indexOf(String(over.id));
    const activeIndex = ordered.indexOf(id);
    if (overIndex >= 0 && activeIndex !== overIndex) {
      ordered = arrayMove(ordered, activeIndex, overIndex);
      setColumns((c) => ({ ...c, [col]: ordered }));
    }
    const changedCol = originCol.current !== col;
    if (!changedCol && activeIndex === overIndex) return;
    setSaving(true);
    const res = await moveJob({ jobId: id, driverId: col === UNASSIGNED ? null : col, orderedIds: ordered, day });
    setSaving(false);
    if (res && "error" in res && res.error) {
      toast.error(res.error === "locked" ? t("locked") : res.error);
      setColumns(buildColumns(jobs, drivers));
    } else if (changedCol) {
      const d = drivers.find((x) => x.id === col);
      toast.success(d ? t("assignedTo", { name: d.full_name }) : t("unassignedToast"));
    }
  };

  const go = (delta: number) => {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    router.push(`/app/dispatch?date=${d.toISOString().slice(0, 10)}`);
  };

  const dayJobs = jobs.filter((j) => j.scheduled_date === day);
  const unassignedCount = columns[UNASSIGNED].length;
  const revenue = dayJobs.reduce((s, j) => s + (Number(j.price_net) || 0), 0);
  const currency = jobs[0]?.currency ?? "GBP";
  const prettyDay = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00Z`));
  const activeJob = activeId ? jobById.get(activeId) : null;

  const markers: MapMarker[] = dayJobs
    .filter((j) => j.delivery_lat != null && j.delivery_lng != null)
    .map((j) => ({
      id: j.id,
      kind: "delivery",
      lat: j.delivery_lat!,
      lng: j.delivery_lng!,
      label: `${j.reference} · ${j.delivery_city ?? ""}`,
      color: drivers.find((d) => d.id === j.driver_id)?.colour ?? "#94a3b8",
    }));

  return (
    <div>
      {/* toolbar */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => go(-1)} aria-label={t("prevDay")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input type="date" value={day} onChange={(e) => e.target.value && router.push(`/app/dispatch?date=${e.target.value}`)} className="h-9 w-44 pl-9" />
          </div>
          <Button variant="secondary" size="sm" onClick={() => go(1)} aria-label={t("nextDay")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push("/app/dispatch")}>
            {t("today")}
          </Button>
          <span className="ml-2 hidden font-display font-semibold capitalize text-slate-900 sm:inline">{prettyDay}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="brand">{t("statJobs", { n: dayJobs.length })}</Badge>
          <Badge tone={unassignedCount ? "amber" : "green"}>{t("statUnassigned", { n: unassignedCount })}</Badge>
          <Badge tone="slate">{money(revenue, currency, locale)}</Badge>
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
            <Radio className="h-3.5 w-3.5" /> {t("live")}
          </span>
          {saving && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          <Button variant={showMap ? "dark" : "secondary"} size="sm" onClick={() => setShowMap((s) => !s)}>
            <MapIcon className="h-4 w-4" /> {showMap ? t("hideMap") : t("showMap")}
          </Button>
        </div>
      </div>

      {showMap && (
        <Card className="mb-4 overflow-hidden">
          <MapView markers={markers} className="h-72 w-full" />
        </Card>
      )}

      {drivers.length === 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          {t("noDrivers")}{" "}
          <Link href="/app/fleet/drivers" className="font-semibold underline">
            {t("addDriver")}
          </Link>
        </div>
      )}

      <DndContext id="dispatch-board" sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <Column id={UNASSIGNED} ids={columns[UNASSIGNED]} jobById={jobById} unit={unit} day={day} header={
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-slate-600">
                <Inbox className="h-4 w-4" />
              </span>
              <div>
                <div className="font-semibold text-slate-900">{t("unassigned")}</div>
                <div className="text-xs text-slate-500">{t("dragHint")}</div>
              </div>
            </div>
          } emptyText={t("allAssigned")} tone="unassigned" />
          {drivers.map((d) => {
            const ids = columns[d.id] ?? [];
            const km = ids.reduce((s, id) => s + (Number(jobById.get(id)?.distance_km) || 0), 0);
            const online = d.last_seen_at && now - new Date(d.last_seen_at).getTime() < 10 * 60_000;
            return (
              <Column
                key={d.id}
                id={d.id}
                ids={ids}
                jobById={jobById}
                unit={unit}
                day={day}
                accent={d.colour}
                emptyText={t("dropHere")}
                header={
                  <div className="flex items-center gap-3">
                    <span className="relative">
                      <Avatar name={d.full_name} colour={d.colour} size={36} />
                      <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white", online ? "bg-emerald-500" : "bg-slate-300")} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-slate-900">{d.full_name}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Truck className="h-3 w-3" /> {d.vehicle ?? "—"}
                        </span>
                        <span>·</span>
                        <span>{t("jobsCount", { n: ids.length })}</span>
                        <span>·</span>
                        <span>
                          {Math.round(unit === "mi" ? km * 0.621371 : km)} {unit}
                        </span>
                      </div>
                    </div>
                  </div>
                }
              />
            );
          })}
        </div>
        <DragOverlay>{activeJob ? <JobCard job={activeJob} unit={unit} day={day} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  id,
  ids,
  jobById,
  header,
  emptyText,
  unit,
  day,
  accent,
  tone,
}: {
  id: string;
  ids: string[];
  jobById: Map<string, BoardJob>;
  header: React.ReactNode;
  emptyText: string;
  unit: "km" | "mi";
  day: string;
  accent?: string;
  tone?: "unassigned";
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      className={cn(
        "flex w-[300px] shrink-0 flex-col rounded-2xl p-3 ring-1 transition",
        tone === "unassigned" ? "bg-slate-100/80 ring-slate-200" : "bg-white/70 ring-slate-200/70",
        isOver && "bg-brand-50 ring-2 ring-brand-300",
      )}
      style={accent ? { borderTop: `3px solid ${accent}` } : undefined}
    >
      <div className="mb-3 px-1">{header}</div>
      <SortableContext id={id} items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-[120px] flex-1 flex-col gap-2">
          {ids.map((jid) => {
            const job = jobById.get(jid);
            return job ? <SortableJob key={jid} job={job} unit={unit} day={day} /> : null;
          })}
          {ids.length === 0 && (
            <div className="grid flex-1 place-items-center rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">{emptyText}</div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableJob({ job, unit, day }: { job: BoardJob; unit: "km" | "mi"; day: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id, disabled: !draggable(job.status) });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <JobCard job={job} unit={unit} day={day} />
    </div>
  );
}

function JobCard({ job, unit, day, overlay }: { job: BoardJob; unit: "km" | "mi"; day: string; overlay?: boolean }) {
  const t = useTranslations("dispatch");
  const ts = useTranslations("common.status");
  const locked = !draggable(job.status);
  const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null);
  const from = time(job.pickup_from);
  const to = time(job.delivery_to);
  return (
    <div
      className={cn(
        "group rounded-xl bg-white p-3 text-sm shadow-sm ring-1 ring-slate-200 transition",
        locked ? "cursor-default opacity-80" : "cursor-grab hover:shadow-md hover:ring-brand-200 active:cursor-grabbing",
        overlay && "rotate-2 shadow-2xl ring-brand-300",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {!locked && <GripVertical className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />}
          <Link href={`/app/jobs/${job.id}`} onPointerDown={(e) => e.stopPropagation()} className="font-mono text-xs font-semibold text-brand-600 hover:underline">
            {job.reference}
          </Link>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset", STATUS_COLORS[job.status])}>{ts(job.status)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1 font-medium text-slate-900">
        <span className="truncate">{job.pickup_city || job.pickup_postcode || "—"}</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate">{job.delivery_city || job.delivery_postcode || "—"}</span>
      </div>
      {job.customer && <div className="truncate text-xs text-slate-500">{job.customer.name}</div>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {job.distance_km != null && (
          <span className="inline-flex items-center gap-1">
            <Route className="h-3 w-3" />
            {Math.round(unit === "mi" ? job.distance_km * 0.621371 : job.distance_km)} {unit}
          </span>
        )}
        {(from || to) && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {from ?? "…"}–{to ?? "…"}
          </span>
        )}
        {job.pallets ? <span>{job.pallets} plt</span> : null}
        {job.adr && <Flame className="h-3.5 w-3.5 text-orange-500" />}
        {job.temperature_controlled && <Snowflake className="h-3.5 w-3.5 text-sky-500" />}
        {job.scheduled_date !== day && <Badge tone="amber" className="px-1.5 py-0 text-[10px]">{t("noDate")}</Badge>}
      </div>
    </div>
  );
}
