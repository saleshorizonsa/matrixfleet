import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/lib/types";

const STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  sent: "bg-sky-50 text-sky-700 ring-sky-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  overdue: "bg-rose-50 text-rose-700 ring-rose-200",
  void: "bg-slate-50 text-slate-400 ring-slate-200 line-through",
};

export function InvoiceStatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  const t = useTranslations("invoices.status");
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", STYLES[status], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {t(status)}
    </span>
  );
}

/** Sum amounts grouped by currency: { GBP: 120, EUR: 80 } */
export function sumByCurrency<T extends { currency: string; total: number }>(rows: T[]) {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.currency] = (out[r.currency] ?? 0) + Number(r.total);
  return out;
}
