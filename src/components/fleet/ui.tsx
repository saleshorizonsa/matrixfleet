import { useTranslations } from "next-intl";
import { Truck, Car, Container, Bus, Package } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { URGENCY_TONE, urgencyOf, daysLeft } from "./compliance";
import type { Vehicle } from "@/lib/types";

/** Registration styled like a UK / EU number plate. */
export function Plate({ reg, country = "GB", size = "md" }: { reg: string; country?: string; size?: "sm" | "md" | "lg" }) {
  const uk = country === "GB";
  const sizes = { sm: "h-6 text-xs", md: "h-8 text-sm", lg: "h-11 text-lg" }[size];
  return (
    <span className={cn("inline-flex items-stretch overflow-hidden rounded-md font-mono font-bold tracking-wider ring-1 ring-slate-900/30 shadow-sm", sizes)}>
      <span className="flex w-5 flex-col items-center justify-center bg-[#003399] text-[8px] leading-none text-white">
        <span className="text-[#FFCC00]">★</span>
        {uk ? "UK" : country}
      </span>
      <span className={cn("flex items-center px-2 text-slate-900", uk ? "bg-[#FFD500]" : "bg-white")}>{reg.toUpperCase()}</span>
    </span>
  );
}

export function VehicleIcon({ kind, className }: { kind: Vehicle["kind"]; className?: string }) {
  const Icon = { van: Truck, luton: Truck, rigid: Truck, artic: Container, trailer: Container, car: Car, other: Package }[kind] ?? Bus;
  return <Icon className={className} />;
}

export function ExpiryBadge({ date, compact = false }: { date: string | null; compact?: boolean }) {
  const t = useTranslations("fleet");
  const days = daysLeft(date);
  const u = urgencyOf(days);
  if (u === "missing") return <span className="text-xs text-slate-400">—</span>;
  const label =
    u === "expired" ? t("urgency.expiredAgo", { days: Math.abs(days!) }) : t("urgency.inDays", { days: days! });
  return (
    <Badge tone={URGENCY_TONE[u]} title={date ?? undefined}>
      {compact ? label : `${new Date(date!).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · ${label}`}
    </Badge>
  );
}

export function OnlineDot({ online }: { online: boolean }) {
  return (
    <span className={cn("relative inline-block h-2.5 w-2.5 rounded-full", online ? "pulse-ring bg-emerald-500 text-emerald-500" : "bg-slate-300")} />
  );
}
