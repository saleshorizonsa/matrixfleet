"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Coffee, Info, Loader2, Play, Square, TriangleAlert } from "lucide-react";
import { endShift, startShift, toggleBreak } from "@/app/driver/actions";
import { intlLocale } from "@/lib/format";
import { Select } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ShiftRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  break_minutes: number;
  on_break_since: string | null;
  last_break_end_at: string | null;
  registration: string | null;
}

// EU Regulation 561/2006 headline limits (guidance only)
const CONTINUOUS_LIMIT = 270; // 4h30 → 45 min break
const DAILY_LIMIT = 540; // 9h (10h twice a week)
const WEEKLY_LIMIT = 3360; // 56h

const min = (a: number, b: number) => Math.max(0, Math.round((b - a) / 60000));

function useNow(initial: number, intervalMs = 1000) {
  const [now, setNow] = React.useState(initial);
  React.useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return now;
}

function workMinutes(s: ShiftRow, now: number) {
  const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
  const currentBreak = s.on_break_since && !s.ended_at ? min(new Date(s.on_break_since).getTime(), now) : 0;
  return Math.max(0, min(new Date(s.started_at).getTime(), end) - s.break_minutes - currentBreak);
}

function hm(m: number) {
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

export function ShiftPanel({
  shifts,
  weekStart,
  vehicles,
  ukDomestic,
  serverNow,
}: {
  shifts: ShiftRow[];
  weekStart: string;
  vehicles: { id: string; registration: string }[];
  ukDomestic: boolean;
  serverNow: number;
}) {
  const t = useTranslations("driver.shift");
  const loc = intlLocale(useLocale());
  const router = useRouter();
  const now = useNow(serverNow);
  const [pending, start] = React.useTransition();
  const [vehicleId, setVehicleId] = React.useState(vehicles[0]?.id ?? "");

  const open = shifts.find((s) => !s.ended_at) ?? null;
  const todayKey = new Date(now).toDateString();
  const today = shifts.filter((s) => new Date(s.started_at).toDateString() === todayKey);
  const week = shifts.filter((s) => new Date(s.started_at) >= new Date(weekStart));
  const todayWork = today.reduce((a, s) => a + workMinutes(s, now), 0);
  const weekWork = week.reduce((a, s) => a + workMinutes(s, now), 0);
  const onBreak = !!open?.on_break_since;
  const sinceBreak =
    open && !onBreak ? min(new Date(open.last_break_end_at ?? open.started_at).getTime(), now) : 0;
  const breakElapsed = open?.on_break_since ? min(new Date(open.on_break_since).getTime(), now) : 0;

  const warnings: string[] = [];
  if (open && !onBreak && sinceBreak >= CONTINUOUS_LIMIT) warnings.push(t("warn.continuous"));
  else if (open && !onBreak && sinceBreak >= CONTINUOUS_LIMIT - 30) warnings.push(t("warn.continuousSoon", { minutes: CONTINUOUS_LIMIT - sinceBreak }));
  if (todayWork >= DAILY_LIMIT) warnings.push(t("warn.daily"));
  if (weekWork >= WEEKLY_LIMIT) warnings.push(t("warn.weekly"));

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(t.has(`errors.${r.error}`) ? t(`errors.${r.error}`) : (r.error ?? ""));
      else {
        toast.success(success);
        router.refresh();
      }
    });

  const elapsed = open ? Math.floor((now - new Date(open.started_at).getTime()) / 1000) : 0;
  const clock = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <section className={cn("overflow-hidden rounded-3xl p-5 text-white shadow-xl", onBreak ? "bg-amber-500" : open ? "bg-ink-900" : "bg-slate-700")}>
        <div className="text-xs font-semibold uppercase tracking-wider text-white/60">
          {open ? (onBreak ? t("onBreak") : t("onShift")) : t("offShift")}
        </div>
        <div className="mt-1 font-mono text-5xl font-bold tabular-nums">{open ? clock : "--:--:--"}</div>
        {open && (
          <div className="mt-1 text-sm text-white/70">
            {t("startedAt", {
              time: new Intl.DateTimeFormat(loc, { hour: "2-digit", minute: "2-digit" }).format(new Date(open.started_at)),
            })}
            {open.registration ? ` · ${open.registration}` : ""}
            {onBreak ? ` · ${t("breakFor", { minutes: breakElapsed })}` : ""}
          </div>
        )}

        <div className="mt-5 grid gap-2">
          {!open ? (
            <>
              {vehicles.length > 0 && (
                <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="h-12 text-base text-slate-900">
                  <option value="">{t("noVehicle")}</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registration}
                    </option>
                  ))}
                </Select>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => act(() => startShift(vehicleId || null), t("started"))}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-lime-signal text-lg font-bold text-ink-900 disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />} {t("start")}
              </button>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => act(() => toggleBreak(open.id), onBreak ? t("breakEnded") : t("breakStarted"))}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white/15 font-bold text-white ring-1 ring-white/25 disabled:opacity-60"
              >
                <Coffee className="h-5 w-5" /> {onBreak ? t("endBreak") : t("startBreak")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(t("confirmEnd"))) act(() => endShift(open.id, null), t("ended"));
                }}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white font-bold text-ink-900 disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="h-5 w-5" />} {t("end")}
              </button>
            </div>
          )}
        </div>
      </section>

      {warnings.map((w) => (
        <div key={w} className="flex gap-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900 ring-1 ring-rose-200">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" /> {w}
        </div>
      ))}

      <section className="grid grid-cols-2 gap-3">
        {[
          { label: t("today"), value: todayWork, limit: DAILY_LIMIT },
          { label: t("thisWeek"), value: weekWork, limit: WEEKLY_LIMIT },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className="mt-1 font-display text-2xl font-bold text-slate-900">{hm(c.value)}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full", c.value >= c.limit ? "bg-rose-500" : c.value >= c.limit * 0.85 ? "bg-amber-500" : "bg-brand-500")}
                style={{ width: `${Math.min(100, (c.value / c.limit) * 100)}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-slate-500">{t("ofLimit", { limit: hm(c.limit) })}</div>
          </div>
        ))}
      </section>

      {open && !onBreak && (
        <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">{t("sinceBreak")}</span>
            <span className={cn("font-semibold", sinceBreak >= CONTINUOUS_LIMIT ? "text-rose-600" : "text-slate-900")}>
              {hm(sinceBreak)} / {hm(CONTINUOUS_LIMIT)}
            </span>
          </div>
        </div>
      )}

      {week.filter((s) => s.ended_at).length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{t("history")}</h2>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {week
              .filter((s) => s.ended_at)
              .map((s) => (
                <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium text-slate-900">
                      {new Intl.DateTimeFormat(loc, { weekday: "short", day: "numeric", month: "short" }).format(new Date(s.started_at))}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Intl.DateTimeFormat(loc, { hour: "2-digit", minute: "2-digit" }).format(new Date(s.started_at))}–
                      {new Intl.DateTimeFormat(loc, { hour: "2-digit", minute: "2-digit" }).format(new Date(s.ended_at!))}
                      {s.registration ? ` · ${s.registration}` : ""} · {t("breakShort", { minutes: s.break_minutes })}
                    </div>
                  </div>
                  <span className="font-semibold text-slate-900">{hm(workMinutes(s, now))}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <div className="flex gap-2 rounded-2xl bg-slate-100 p-4 text-xs leading-relaxed text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {t("disclaimer")} {ukDomestic && t("ukDomestic")}
        </p>
      </div>
    </div>
  );
}
