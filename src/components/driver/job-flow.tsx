"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MapPinned, PackageCheck, Play, Truck, TriangleAlert } from "lucide-react";
import { driverStep, reportProblem, type DriverStep } from "@/app/driver/actions";
import { getCurrentPosition } from "./gps";
import { PodCapture } from "./pod-capture";
import { Modal } from "@/components/app/client";
import { Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

const STEP_ICON = {
  start: Play,
  arrived_pickup: MapPinned,
  collected: PackageCheck,
  arrived_delivery: Truck,
  deliver: CheckCircle2,
} as const;

const ORDER = ["start", "arrived_pickup", "collected", "arrived_delivery", "deliver"] as const;

export function JobFlow({ jobId, orgId, next }: { jobId: string; orgId: string; next: DriverStep | "deliver" }) {
  const t = useTranslations("driver.flow");
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [podOpen, setPodOpen] = React.useState(false);
  const [problemOpen, setProblemOpen] = React.useState(false);
  const [problem, setProblem] = React.useState("");
  const Icon = STEP_ICON[next];
  const idx = ORDER.indexOf(next);

  const run = () => {
    if (next === "deliver") return setPodOpen(true);
    start(async () => {
      const pos = await getCurrentPosition(4000);
      const res = await driverStep(jobId, next, pos?.lat, pos?.lng);
      if (!res.ok) toast.error(t.has(`errors.${res.error}`) ? t(`errors.${res.error}`) : res.error);
      else {
        if ("vibrate" in navigator) navigator.vibrate?.(40);
        toast.success(t(`done.${next}`));
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      {/* progress */}
      <ol className="flex items-center gap-1.5 px-1">
        {ORDER.map((s, i) => (
          <li key={s} className={cn("h-1.5 flex-1 rounded-full", i < idx ? "bg-emerald-500" : i === idx ? "bg-brand-500" : "bg-slate-200")} />
        ))}
      </ol>
      <p className="px-1 text-xs text-slate-500">{t("stepOf", { step: idx + 1, total: ORDER.length })}</p>

      <div className="sticky bottom-20 z-30 space-y-2">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className={cn(
            "flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-lg font-bold shadow-xl transition active:scale-[0.98] disabled:opacity-60",
            next === "deliver" ? "bg-emerald-500 text-white shadow-emerald-500/30" : "bg-ink-900 text-white shadow-ink-900/30",
          )}
        >
          {pending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
          {t(`action.${next}`)}
        </button>
        <button
          type="button"
          onClick={() => setProblemOpen(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-rose-600 ring-1 ring-rose-200 active:bg-rose-50"
        >
          <TriangleAlert className="h-4 w-4" /> {t("reportProblem")}
        </button>
      </div>

      <PodCapture open={podOpen} onClose={() => setPodOpen(false)} jobId={jobId} orgId={orgId} />

      <Modal
        open={problemOpen}
        onClose={() => setProblemOpen(false)}
        title={t("reportProblem")}
        footer={
          <button
            type="button"
            disabled={pending || !problem.trim()}
            onClick={() =>
              start(async () => {
                const pos = await getCurrentPosition(4000);
                const res = await reportProblem(jobId, problem, pos?.lat, pos?.lng);
                if (!res.ok) toast.error(res.error);
                else {
                  toast.success(t("problemSent"));
                  setProblem("");
                  setProblemOpen(false);
                  router.refresh();
                }
              })
            }
            className="flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-5 font-semibold text-white disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} {t("send")}
          </button>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {(["delay", "access", "damaged", "refused", "closed"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setProblem((p) => (p ? p + " " : "") + t(`quick.${k}`))}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-200"
            >
              {t(`quick.${k}`)}
            </button>
          ))}
        </div>
        <Textarea value={problem} onChange={(e) => setProblem(e.target.value)} placeholder={t("problemPlaceholder")} rows={4} />
      </Modal>
    </div>
  );
}
