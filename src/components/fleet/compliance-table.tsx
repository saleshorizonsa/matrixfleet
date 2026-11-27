"use client";
import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpDown, Download, IdCard, Truck } from "lucide-react";
import { Badge, Button, Card, Input, Select, TBody, THead, TR, Table } from "@/components/ui";
import { URGENCY_TONE, type ComplianceItem, type Urgency } from "./compliance";
import { date, intlLocale } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "days" | "subject" | "doc";
const URGENCIES: (Urgency | "all")[] = ["all", "expired", "week", "month", "ok", "missing"];

export function ComplianceTable({ items }: { items: ComplianceItem[] }) {
  const t = useTranslations("fleet");
  const loc = intlLocale(useLocale());
  const [urgency, setUrgency] = React.useState<Urgency | "all">("all");
  const [type, setType] = React.useState<"all" | "vehicle" | "driver">("all");
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "days", dir: 1 });

  const rows = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((i) => urgency === "all" || i.urgency === urgency)
      .filter((i) => type === "all" || i.subjectType === type)
      .filter((i) => !needle || i.subjectLabel.toLowerCase().includes(needle))
      .sort((a, b) => {
        const d = sort.dir;
        if (sort.key === "days") return ((a.days ?? 1e9) - (b.days ?? 1e9)) * d;
        if (sort.key === "subject") return a.subjectLabel.localeCompare(b.subjectLabel) * d;
        return a.doc.localeCompare(b.doc) * d;
      });
  }, [items, urgency, type, q, sort]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) c[i.urgency] = (c[i.urgency] ?? 0) + 1;
    return c;
  }, [items]);

  const toggle = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }));

  const exportCsv = () => {
    const header = ["type", "subject", "document", "expiry_date", "days_left", "status"];
    const lines = rows.map((r) =>
      [r.subjectType, r.subjectLabel, t(`docs.${r.doc}`), r.date ?? "", r.days ?? "", t(`urgency.${r.urgency}`)]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `compliance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };


  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {URGENCIES.map((u) => (
            <button
              key={u}
              onClick={() => setUrgency(u)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium ring-1 transition",
                urgency === u ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300",
              )}
            >
              {u === "all" ? t("compliance.all") : t(`urgency.${u}`)} <span className="opacity-60">{counts[u] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder={t("compliance.search")} value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-44" />
          <Select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="h-9 w-36">
            <option value="all">{t("compliance.allTypes")}</option>
            <option value="vehicle">{t("compliance.vehicles")}</option>
            <option value="driver">{t("compliance.drivers")}</option>
          </Select>
          <Button variant="secondary" size="sm" className="h-9" onClick={exportCsv}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-slate-500">{t("compliance.nothing")}</div>
      ) : (
        <Table>
          <THead>
            <tr>
              <SortTh active={sort.key} onSort={toggle} k="subject">{t("compliance.subject")}</SortTh>
              <SortTh active={sort.key} onSort={toggle} k="doc">{t("compliance.document")}</SortTh>
              <th>{t("compliance.expiry")}</th>
              <SortTh active={sort.key} onSort={toggle} k="days">{t("compliance.status")}</SortTh>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <td>
                  <Link
                    href={`/app/fleet/${r.subjectType === "vehicle" ? "vehicles" : "drivers"}/${r.subjectId}`}
                    className="inline-flex items-center gap-2 font-medium text-slate-900 hover:text-brand-600"
                  >
                    {r.subjectType === "vehicle" ? <Truck className="h-4 w-4 text-slate-400" /> : <IdCard className="h-4 w-4 text-slate-400" />}
                    <span className={r.subjectType === "vehicle" ? "font-mono" : ""}>{r.subjectLabel}</span>
                  </Link>
                </td>
                <td className="text-slate-600">{t(`docs.${r.doc}`)}</td>
                <td className="text-slate-600">{r.date ? date(r.date, loc) : "—"}</td>
                <td>
                  <Badge tone={URGENCY_TONE[r.urgency]}>
                    {r.urgency === "missing"
                      ? t("urgency.missing")
                      : r.urgency === "expired"
                        ? t("urgency.expiredAgo", { days: Math.abs(r.days!) })
                        : t("urgency.inDays", { days: r.days! })}
                  </Badge>
                </td>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

function SortTh({ k, active, onSort, children }: { k: SortKey; active: SortKey; onSort: (k: SortKey) => void; children: React.ReactNode }) {
  return (
    <th>
      <button onClick={() => onSort(k)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
        {children} <ArrowUpDown className={cn("h-3 w-3", active === k ? "text-brand-500" : "opacity-40")} />
      </button>
    </th>
  );
}
