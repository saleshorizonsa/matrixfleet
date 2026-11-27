"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, MapPin, PenLine, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Interactive product preview: a stylised live map of UK & EU routes with trucks
 * moving along them (pure SVG animateMotion — no map library), plus a mini
 * dispatch feed whose jobs progress through statuses.
 */

const CITIES = [
  { id: "gla", name: "Glasgow", x: 150, y: 70 },
  { id: "man", name: "Manchester", x: 190, y: 150 },
  { id: "bhm", name: "Birmingham", x: 205, y: 195 },
  { id: "lon", name: "London", x: 250, y: 235 },
  { id: "dub", name: "Dublin", x: 85, y: 150 },
  { id: "par", name: "Paris", x: 300, y: 320 },
  { id: "rtm", name: "Rotterdam", x: 365, y: 220 },
  { id: "fra", name: "Frankfurt", x: 450, y: 285 },
  { id: "waw", name: "Warsaw", x: 610, y: 205 },
  { id: "mad", name: "Madrid", x: 175, y: 470 },
  { id: "lyo", name: "Lyon", x: 345, y: 395 },
];

const ROUTES = [
  { id: "r1", d: "M250 235 C 235 205, 215 200, 205 195 S 195 165, 190 150 S 165 95, 150 70", colour: "#C6F432", dur: "11s" },
  { id: "r2", d: "M250 235 C 270 270, 290 290, 300 320 S 330 370, 345 395", colour: "#7F7BFB", dur: "9s" },
  { id: "r3", d: "M365 220 C 400 240, 430 260, 450 285 S 560 215, 610 205", colour: "#38BDF8", dur: "13s" },
  { id: "r4", d: "M300 320 C 260 380, 220 420, 175 470", colour: "#F59E0B", dur: "10s" },
  { id: "r5", d: "M190 150 C 150 150, 120 150, 85 150", colour: "#C6F432", dur: "7s" },
  { id: "r6", d: "M250 235 C 290 225, 330 215, 365 220", colour: "#7F7BFB", dur: "6s" },
];

const FEED = [
  { ref: "JOB-001284", from: "London", to: "Glasgow", driver: "Sam K." },
  { ref: "JOB-001285", from: "Rotterdam", to: "Warsaw", driver: "Marta W." },
  { ref: "JOB-001286", from: "Paris", to: "Madrid", driver: "Luis G." },
  { ref: "JOB-001287", from: "Manchester", to: "Dublin", driver: "Aoife B." },
];
const STEPS = ["assigned", "in_transit", "delivered"] as const;
const STEP_STYLE: Record<(typeof STEPS)[number], string> = {
  assigned: "bg-violet-400/15 text-violet-200 ring-violet-300/30",
  in_transit: "bg-amber-400/15 text-amber-200 ring-amber-300/30",
  delivered: "bg-emerald-400/15 text-emerald-200 ring-emerald-300/30",
};

export function HeroPreview() {
  const t = useTranslations("landing.preview");
  const ts = useTranslations("common.status");
  const [tick, setTick] = React.useState(0);
  const [selected, setSelected] = React.useState<string | null>(null);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setTick((x) => x + 1), 2200);
    return () => window.clearInterval(id);
  }, []);

  const delivered = 37 + Math.floor(tick / 2);

  return (
    <div className="glow relative overflow-hidden rounded-3xl bg-ink-900/80 ring-1 ring-white/10 backdrop-blur">
      {/* window chrome */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span className="relative inline-flex h-2 w-2 text-lime-signal">
            <span className="pulse-ring relative inline-flex h-2 w-2 rounded-full bg-lime-signal" />
          </span>
          {t("live")}
        </div>
        <div className="hidden text-xs text-white/40 sm:block">app.haulora.com/tracking</div>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px]">
        {/* map */}
        <div className="relative min-h-[300px] sm:min-h-[380px]">
          <svg viewBox="0 0 700 520" className="absolute inset-0 h-full w-full" role="img" aria-label={t("mapLabel")}>
            <defs>
              <radialGradient id="hp-land" cx="40%" cy="40%" r="70%">
                <stop offset="0%" stopColor="#1B2A5A" />
                <stop offset="100%" stopColor="#0A1430" />
              </radialGradient>
              <pattern id="hp-dots" width="14" height="14" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="1.1" fill="#ffffff" opacity="0.07" />
              </pattern>
            </defs>
            <rect width="700" height="520" fill="url(#hp-land)" />
            <rect width="700" height="520" fill="url(#hp-dots)" />
            {/* stylised coastlines */}
            <path d="M120 40 C 170 30, 205 70, 215 120 S 270 200, 275 245 S 220 265, 190 250 S 160 200, 150 160 S 110 80, 120 40Z" fill="#ffffff" opacity="0.05" />
            <path d="M60 120 C 95 110, 115 140, 105 175 S 60 190, 50 160Z" fill="#ffffff" opacity="0.05" />
            <path d="M280 300 C 340 250, 420 200, 520 170 S 680 160, 690 230 S 640 360, 560 400 S 420 470, 330 500 S 130 520, 120 450 S 220 350, 280 300Z" fill="#ffffff" opacity="0.045" />

            {ROUTES.map((r) => (
              <g key={r.id}>
                <path d={r.d} stroke={r.colour} strokeOpacity="0.18" strokeWidth="6" fill="none" strokeLinecap="round" />
                <path d={r.d} stroke={r.colour} strokeOpacity="0.7" strokeWidth="1.6" strokeDasharray="4 7" fill="none" strokeLinecap="round" />
                <g>
                  <circle r="9" fill={r.colour} opacity="0.25">
                    <animateMotion dur={r.dur} repeatCount="indefinite" path={r.d} />
                  </circle>
                  <circle r="4.5" fill={r.colour} stroke="#0A1430" strokeWidth="2">
                    <animateMotion dur={r.dur} repeatCount="indefinite" path={r.d} />
                  </circle>
                </g>
              </g>
            ))}

            {CITIES.map((c) => (
              <g
                key={c.id}
                className="cursor-pointer"
                onMouseEnter={() => setSelected(c.id)}
                onMouseLeave={() => setSelected(null)}
                onClick={() => setSelected((s) => (s === c.id ? null : c.id))}
              >
                <circle cx={c.x} cy={c.y} r={selected === c.id ? 7 : 4} fill="#fff" opacity={selected === c.id ? 1 : 0.85} style={{ transition: "r .2s" }} />
                <text x={c.x + 9} y={c.y + 4} fill="#fff" fontSize="12" opacity={selected === c.id ? 1 : 0.55} fontFamily="inherit">
                  {c.name}
                </text>
              </g>
            ))}
          </svg>

          {/* floating KPI chips */}
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            <div className="rounded-xl bg-ink-950/70 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
              <div className="text-[10px] uppercase tracking-wider text-white/40">{t("onRoad")}</div>
              <div className="font-display text-lg font-bold text-white">
                6 <span className="text-xs font-medium text-lime-signal">{t("vehicles")}</span>
              </div>
            </div>
            <div className="rounded-xl bg-ink-950/70 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
              <div className="text-[10px] uppercase tracking-wider text-white/40">{t("deliveredToday")}</div>
              <div className="font-display text-lg font-bold tabular-nums text-white">{delivered}</div>
            </div>
          </div>

          {/* POD toast */}
          <div
            key={tick % FEED.length}
            className="animate-fade-up absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-xl sm:right-auto sm:w-72"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-600">
              <PenLine className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-sm">
              <div className="font-semibold text-slate-900">{t("podReceived")}</div>
              <div className="truncate text-slate-500">
                {FEED[tick % FEED.length].ref} · {t("signedBy", { name: FEED[tick % FEED.length].driver })}
              </div>
            </div>
            <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-emerald-500" />
          </div>
        </div>

        {/* dispatch feed */}
        <div className="hidden border-l border-white/10 p-4 lg:block">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/40">{t("todaysJobs")}</div>
            <Truck className="h-4 w-4 text-white/30" />
          </div>
          <ul className="space-y-2.5">
            {FEED.map((job, i) => {
              const step = STEPS[(i + tick) % STEPS.length];
              return (
                <li key={job.ref} className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10 transition hover:bg-white/[0.07]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-white/45">{job.ref}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 transition-colors duration-500", STEP_STYLE[step])}>
                      {ts(step)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-white">
                    <MapPin className="h-3.5 w-3.5 text-white/40" />
                    {job.from} → {job.to}
                  </div>
                  <div className="mt-1 text-xs text-white/45">{job.driver}</div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-lime-signal transition-all duration-700"
                      style={{ width: step === "assigned" ? "12%" : step === "in_transit" ? "58%" : "100%" }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
