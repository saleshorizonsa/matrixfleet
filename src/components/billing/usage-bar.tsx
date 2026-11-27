import { cn } from "@/lib/utils";

export function UsageBar({ label, used, limit, unlimited }: { label: string; used: number; limit: number; unlimited: string }) {
  const finite = Number.isFinite(limit);
  const pct = finite ? Math.min(100, Math.round((used / Math.max(1, limit)) * 100)) : 8;
  const tone = !finite ? "bg-brand-500" : pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-brand-500";
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-500">
          {used} / {finite ? limit : unlimited}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
