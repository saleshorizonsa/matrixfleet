"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, ChevronRight, Circle, Rocket, X } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ChecklistStep {
  key: string;
  done: boolean;
  href: string;
}

const subscribeNoop = () => () => {};

export function GettingStarted({ steps }: { steps: ChecklistStep[] }) {
  const t = useTranslations("dashboard");
  const [dismissed, setDismissed] = React.useState(false);
  const stored = React.useSyncExternalStore(
    subscribeNoop,
    () => localStorage.getItem("hl_checklist_hidden") === "1",
    () => false,
  );
  const hidden = dismissed || stored;
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  if (hidden || done === steps.length) return null;

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-brand-50 to-transparent md:block" />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink-900 text-lime-signal">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-slate-900">{t("checklist.title")}</h3>
              <p className="text-sm text-slate-500">{t("checklist.progress", { done, total: steps.length })}</p>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.setItem("hl_checklist_hidden", "1");
              setDismissed(true);
            }}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={t("checklist.hide")}
            title={t("checklist.hide")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-lime-signal transition-all" style={{ width: `${pct}%` }} />
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.key}>
              <Link
                href={s.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm ring-1 transition",
                  s.done ? "bg-emerald-50/50 text-slate-400 ring-emerald-100" : "bg-white text-slate-700 ring-slate-200 hover:ring-brand-300",
                )}
              >
                {s.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 shrink-0 text-slate-300" />}
                <span className={cn("flex-1", s.done && "line-through")}>{t(`checklist.steps.${s.key}`)}</span>
                {!s.done && <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
