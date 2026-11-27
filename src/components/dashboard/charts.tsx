"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Area, AreaChart, Bar, CartesianGrid, Cell, ComposedChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { JobStatus } from "@/lib/types";

export interface DayPoint {
  day: string; // ISO date
  label: string;
  revenue: number;
  jobs: number;
}

const STATUS_HEX: Record<JobStatus, string> = {
  quote: "#94A3B8",
  booked: "#0EA5E9",
  assigned: "#8B5CF6",
  in_transit: "#F59E0B",
  delivered: "#10B981",
  invoiced: "#14B8A6",
  cancelled: "#F43F5E",
};

export function RevenueChart({ data, currency, locale }: { data: DayPoint[]; currency: string; locale: string }) {
  const t = useTranslations("dashboard");
  const fmt = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const empty = data.every((d) => d.revenue === 0 && d.jobs === 0);
  if (empty) {
    return <div className="grid h-64 place-items-center text-sm text-slate-400">{t("charts.noData")}</div>;
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5B5BF7" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#5B5BF7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#EEF0F6" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} tickLine={false} axisLine={false} interval={4} />
          <YAxis yAxisId="r" tick={{ fontSize: 11, fill: "#94A3B8" }} tickLine={false} axisLine={false} width={64} tickFormatter={fmt} />
          <YAxis yAxisId="j" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: "#94A3B8" }} tickLine={false} axisLine={false} width={28} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 10px 30px -10px rgba(0,0,0,.15)", fontSize: 12 }}
            formatter={(v, name) => (name === "revenue" ? [fmt(Number(v)), t("charts.revenue")] : [v, t("charts.jobs")])}
          />
          <Bar yAxisId="j" dataKey="jobs" fill="#C6F432" radius={[4, 4, 0, 0]} barSize={8} />
          <Area yAxisId="r" type="monotone" dataKey="revenue" stroke="#5B5BF7" strokeWidth={2.5} fill="url(#rev)" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDonut({ data }: { data: { status: JobStatus; count: number }[] }) {
  const tc = useTranslations("common.status");
  const t = useTranslations("dashboard");
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) return <div className="grid h-56 place-items-center text-sm text-slate-400">{t("charts.noData")}</div>;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="status" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
              {data.map((d) => (
                <Cell key={d.status} fill={STATUS_HEX[d.status]} />
              ))}
            </Pie>
            <Tooltip formatter={(v, n) => [v, tc(String(n))]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-display text-2xl font-bold">{total}</div>
            <div className="text-[11px] text-slate-400">{t("charts.jobs")}</div>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.status} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_HEX[d.status] }} />
              {tc(d.status)}
            </span>
            <span className="font-medium tabular-nums">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <Area type="monotone" dataKey="v" stroke="#5B5BF7" fill="#5B5BF7" fillOpacity={0.15} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
