"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, CheckCircle2, Copy, CopyPlus, ExternalLink, Loader2, PackageCheck, Send, Trash2, Truck, XCircle } from "lucide-react";
import { Button, Field, Select, Textarea, buttonClass } from "@/components/ui";
import { addJobNote, assignJob, deleteJob, duplicateJob, setJobStatus } from "../actions";
import { JOB_STATUSES } from "@/lib/format";
import type { JobStatus } from "@/lib/types";

function useAction() {
  const [pending, start] = React.useTransition();
  const tc = useTranslations("common");
  const run = (fn: () => Promise<{ error?: string } | { ok: boolean } | undefined | void>, success?: string) =>
    start(async () => {
      const res = (await fn()) as { error?: string } | undefined;
      if (res && "error" in res && res.error) toast.error(res.error === "invoiced" ? tc("errorGeneric") : res.error);
      else if (success) toast.success(success);
    });
  return { pending, run };
}

export function StatusControls({ jobId, status }: { jobId: string; status: JobStatus }) {
  const t = useTranslations("jobs");
  const tc = useTranslations("common.status");
  const { pending, run } = useAction();
  const next: { to: JobStatus; label: string; icon: React.ReactNode } | null =
    status === "quote"
      ? { to: "booked", label: t("actions.acceptQuote"), icon: <CheckCircle2 className="h-4 w-4" /> }
      : status === "booked" || status === "assigned"
        ? { to: "in_transit", label: t("actions.markPickedUp"), icon: <Truck className="h-4 w-4" /> }
        : status === "in_transit"
          ? { to: "delivered", label: t("actions.markDelivered"), icon: <PackageCheck className="h-4 w-4" /> }
          : null;

  return (
    <div className="space-y-3">
      {next && (
        <Button className="w-full" size="lg" disabled={pending} onClick={() => run(() => setJobStatus(jobId, next.to), t("statusUpdated"))}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : next.icon} {next.label}
        </Button>
      )}
      <Field label={t("actions.setStatus")}>
        <Select
          value={status}
          disabled={pending}
          onChange={(e) => run(() => setJobStatus(jobId, e.target.value as JobStatus), t("statusUpdated"))}
        >
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {tc(s)}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

export function AssignForm({
  jobId,
  driverId,
  vehicleId,
  drivers,
  vehicles,
}: {
  jobId: string;
  driverId: string | null;
  vehicleId: string | null;
  drivers: { id: string; full_name: string }[];
  vehicles: { id: string; registration: string; default_driver_id: string | null }[];
}) {
  const t = useTranslations("jobs");
  const tc = useTranslations("common");
  const { pending, run } = useAction();
  const [d, setD] = React.useState(driverId ?? "");
  const [v, setV] = React.useState(vehicleId ?? "");
  const dirty = d !== (driverId ?? "") || v !== (vehicleId ?? "");
  return (
    <div className="space-y-3">
      <Field label={t("driver")}>
        <Select
          value={d}
          onChange={(e) => {
            setD(e.target.value);
            const veh = vehicles.find((x) => x.default_driver_id === e.target.value);
            if (veh) setV(veh.id);
          }}
        >
          <option value="">{tc("unassigned")}</option>
          {drivers.map((x) => (
            <option key={x.id} value={x.id}>
              {x.full_name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("vehicle")}>
        <Select value={v} onChange={(e) => setV(e.target.value)}>
          <option value="">—</option>
          {vehicles.map((x) => (
            <option key={x.id} value={x.id}>
              {x.registration}
            </option>
          ))}
        </Select>
      </Field>
      <Button className="w-full" variant={dirty ? "primary" : "secondary"} disabled={!dirty || pending} onClick={() => run(() => assignJob(jobId, d || null, v || null), t("assigned"))}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t("actions.saveAssignment")}
      </Button>
    </div>
  );
}

export function CopyLink({ url }: { url: string }) {
  const t = useTranslations("jobs");
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className={buttonClass("secondary", "md", "flex-1")}
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          toast.success(t("linkCopied"));
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {t("actions.copyTracking")}
      </button>
      <a href={url} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md")} aria-label={t("actions.openTracking")}>
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}

export function NoteForm({ jobId }: { jobId: string }) {
  const t = useTranslations("jobs");
  const { pending, run } = useAction();
  const [text, setText] = React.useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        run(async () => {
          const r = await addJobNote(jobId, text);
          if (!("error" in r)) setText("");
          return r;
        });
      }}
    >
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("timeline.addNote")} className="min-h-[44px] flex-1" rows={1} />
      <Button type="submit" disabled={pending || !text.trim()} aria-label={t("timeline.addNote")}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </form>
  );
}

export function DuplicateButton({ jobId }: { jobId: string }) {
  const t = useTranslations("jobs");
  const { pending, run } = useAction();
  return (
    <Button variant="secondary" disabled={pending} onClick={() => run(() => duplicateJob(jobId))}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CopyPlus className="h-4 w-4" />} {t("actions.duplicate")}
    </Button>
  );
}

export function DangerActions({ jobId, canCancel, canDelete }: { jobId: string; canCancel: boolean; canDelete: boolean }) {
  const t = useTranslations("jobs");
  const tc = useTranslations("common");
  const { pending, run } = useAction();
  return (
    <div className="flex flex-wrap gap-2">
      {canCancel && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          onClick={() => window.confirm(t("confirmCancel")) && run(() => setJobStatus(jobId, "cancelled"), t("statusUpdated"))}
        >
          <XCircle className="h-4 w-4" /> {t("actions.cancelJob")}
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          onClick={() => window.confirm(tc("confirmDelete")) && run(() => deleteJob(jobId))}
        >
          <Trash2 className="h-4 w-4" /> {tc("delete")}
        </Button>
      )}
    </div>
  );
}
