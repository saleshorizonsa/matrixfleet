"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { MapPin, MapPinOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ store */
const KEY = "hl_gps_enabled";
type GpsState = { enabled: boolean; error: string | null; lastSent: number | null };
let state: GpsState = { enabled: false, error: null, lastSent: null };
let hydrated = false;
const listeners = new Set<() => void>();

function emit(patch: Partial<GpsState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    state = { ...state, enabled: window.localStorage.getItem(KEY) === "1" };
  }
  listeners.add(l);
  return () => listeners.delete(l);
}
const SERVER: GpsState = { enabled: false, error: null, lastSent: null };

export function useGps() {
  return React.useSyncExternalStore(subscribe, () => state, () => SERVER);
}

export function setGpsEnabled(enabled: boolean) {
  window.localStorage.setItem(KEY, enabled ? "1" : "0");
  emit({ enabled, error: null });
}

/** One-shot position, resolves null on failure/timeout. */
export function getCurrentPosition(timeout = 8000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 },
    );
  });
}

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const MIN_INTERVAL_MS = 30_000;
const MIN_MOVE_M = 100;

/** Mounted once in the driver layout. Streams GPS fixes to hl_driver_ping while enabled. */
export function GpsTracker() {
  const { enabled } = useGps();
  React.useEffect(() => {
    if (!enabled) return;
    if (!navigator.geolocation) {
      emit({ error: "unsupported" });
      return;
    }
    const supabase = createClient();
    let last: { lat: number; lng: number; t: number } | null = null;
    let sending = false;
    const id = navigator.geolocation.watchPosition(
      async (p) => {
        const fix = { lat: p.coords.latitude, lng: p.coords.longitude, t: Date.now() };
        const due = !last || fix.t - last.t >= MIN_INTERVAL_MS || metres(last, fix) >= MIN_MOVE_M;
        if (!due || sending) return;
        // rate limit: never more than one ping every 10s even when moving fast
        if (last && fix.t - last.t < 10_000) return;
        sending = true;
        const { error } = await supabase.rpc("hl_driver_ping", {
          p_lat: fix.lat,
          p_lng: fix.lng,
          p_speed: p.coords.speed,
          p_heading: p.coords.heading,
          p_accuracy: p.coords.accuracy,
        });
        sending = false;
        if (!error) {
          last = fix;
          emit({ lastSent: fix.t, error: null });
        } else emit({ error: "send" });
      },
      (err) => emit({ error: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);
  return null;
}

/** Small pill in the header. */
export function GpsIndicator() {
  const t = useTranslations("driver.gps");
  const { enabled, error } = useGps();
  if (!enabled) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        error ? "bg-rose-500/20 text-rose-200" : "bg-lime-signal/15 text-lime-signal",
      )}
    >
      <span className={cn("relative h-2 w-2 rounded-full", error ? "bg-rose-400" : "pulse-ring bg-lime-signal text-lime-signal")} />
      {error ? t("problem") : t("live")}
    </span>
  );
}

/** Big toggle card on the jobs screen. */
export function GpsToggle() {
  const t = useTranslations("driver.gps");
  const { enabled, error, lastSent } = useGps();
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    const i = setInterval(force, 15000);
    return () => clearInterval(i);
  }, []);
  // eslint-disable-next-line react-hooks/purity
  const ago = lastSent ? Math.max(0, Math.round((Date.now() - lastSent) / 1000)) : null;

  return (
    <div className={cn("rounded-2xl p-4 ring-1", enabled ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-slate-200")}>
      <div className="flex items-center gap-3">
        <div className={cn("grid h-11 w-11 place-items-center rounded-xl", enabled ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500")}>
          {enabled ? <MapPin className="h-5 w-5" /> : <MapPinOff className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">{enabled ? t("onTitle") : t("offTitle")}</div>
          <div className="text-xs text-slate-500">
            {error ? t(`error.${error}`) : enabled ? (ago !== null ? t("lastSent", { seconds: ago }) : t("waiting")) : t("offHint")}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setGpsEnabled(!enabled)}
          className={cn("relative h-8 w-14 shrink-0 rounded-full transition", enabled ? "bg-emerald-500" : "bg-slate-300")}
        >
          <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all", enabled ? "left-7" : "left-1")} />
          <span className="sr-only">{t("toggle")}</span>
        </button>
      </div>
      {enabled && <p className="mt-3 text-xs leading-relaxed text-slate-500">{t("keepOpen")}</p>}
    </div>
  );
}

/** Keeps the screen awake while mounted (job detail), where supported. */
export function WakeLock() {
  React.useEffect(() => {
    type Sentinel = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } };
    if (!nav.wakeLock) return;
    let lock: Sentinel | null = null;
    const acquire = async () => {
      try {
        if (document.visibilityState === "visible") lock = await nav.wakeLock!.request("screen");
      } catch {
        /* battery saver etc. */
      }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
    };
  }, []);
  return null;
}
