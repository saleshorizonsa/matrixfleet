"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Camera, Check, Loader2, Minus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitVehicleCheck } from "@/app/driver/actions";
import { compressImage, randomId } from "./image";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

export const CHECK_ITEMS = [
  "tyres",
  "lights",
  "mirrors",
  "brakes",
  "fluids",
  "bodywork",
  "load",
  "horn",
  "dashboard",
  "safety",
] as const;
type Result = "ok" | "defect" | "na";

export function CheckForm({
  orgId,
  vehicles,
  defaultVehicleId,
}: {
  orgId: string;
  vehicles: { id: string; registration: string; make: string | null; model: string | null; odometer: number | null }[];
  defaultVehicleId: string | null;
}) {
  const t = useTranslations("driver.check");
  const router = useRouter();
  const [vehicleId, setVehicleId] = React.useState(defaultVehicleId ?? vehicles[0]?.id ?? "");
  const [items, setItems] = React.useState<Record<string, Result>>({});
  const [odometer, setOdometer] = React.useState("");
  const [defects, setDefects] = React.useState("");
  const [photos, setPhotos] = React.useState<Blob[]>([]);
  const [busy, setBusy] = React.useState(false);

  const answered = CHECK_ITEMS.filter((k) => items[k]).length;
  const hasDefect = Object.values(items).includes("defect");
  const complete = answered === CHECK_ITEMS.length;

  if (!vehicles.length) {
    return <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">{t("noVehicles")}</div>;
  }

  const submit = async () => {
    if (!complete) return toast.error(t("answerAll"));
    if (hasDefect && !defects.trim()) return toast.error(t("describeDefect"));
    setBusy(true);
    try {
      const supabase = createClient();
      const photoPaths: string[] = [];
      for (const blob of photos) {
        const path = `${orgId}/checks/${randomId()}.jpg`;
        const r = await supabase.storage.from("hl-pod").upload(path, blob, { contentType: "image/jpeg" });
        if (r.error) throw r.error;
        photoPaths.push(path);
      }
      const res = await submitVehicleCheck({
        vehicleId,
        odometer: odometer ? Number(odometer) : null,
        items,
        defects: defects.trim() || null,
        photoPaths,
      });
      if (!res.ok) throw new Error(t.has(`errors.${res.error}`) ? t(`errors.${res.error}`) : res.error);
      toast.success(hasDefect ? t("savedDefect") : t("savedOk"));
      setItems({});
      setOdometer("");
      setDefects("");
      setPhotos([]);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const opts: { v: Result; icon: typeof Check; on: string }[] = [
    { v: "ok", icon: Check, on: "bg-emerald-500 text-white ring-emerald-500" },
    { v: "defect", icon: X, on: "bg-rose-500 text-white ring-rose-500" },
    { v: "na", icon: Minus, on: "bg-slate-500 text-white ring-slate-500" },
  ];

  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("vehicle")}>
          <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="h-12 text-base">
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registration}
                {v.make ? ` · ${v.make}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("odometer")}>
          <Input
            inputMode="numeric"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value.replace(/\D/g, ""))}
            placeholder={vehicles.find((v) => v.id === vehicleId)?.odometer?.toString() ?? ""}
            className="h-12 text-base"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{t("checklist")}</span>
        <button
          type="button"
          onClick={() => setItems(Object.fromEntries(CHECK_ITEMS.map((k) => [k, items[k] ?? "ok"])))}
          className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 active:bg-emerald-100"
        >
          {t("allOk")}
        </button>
      </div>

      <ul className="divide-y divide-slate-100">
        {CHECK_ITEMS.map((k) => (
          <li key={k} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-[15px] font-medium text-slate-800">{t(`items.${k}`)}</span>
            <div className="flex shrink-0 gap-1.5">
              {opts.map(({ v, icon: Icon, on }) => (
                <button
                  key={v}
                  type="button"
                  aria-label={t(`result.${v}`)}
                  aria-pressed={items[k] === v}
                  onClick={() => setItems((s) => ({ ...s, [k]: v }))}
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-xl ring-1 transition active:scale-95",
                    items[k] === v ? on : "bg-white text-slate-400 ring-slate-200",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {hasDefect && (
        <div className="space-y-3 rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200">
          <Field label={t("defectDetails")}>
            <Textarea value={defects} onChange={(e) => setDefects(e.target.value)} placeholder={t("defectPlaceholder")} rows={3} />
          </Field>
          <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
            <Camera className="h-4 w-4" /> {t("addPhoto")} {photos.length > 0 && `(${photos.length})`}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f && photos.length < 4) setPhotos([...photos, await compressImage(f)]);
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-xs text-rose-800">{t("defectWarning")}</p>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className={cn(
          "flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white shadow-lg disabled:opacity-60",
          hasDefect ? "bg-rose-600 shadow-rose-600/25" : "bg-ink-900 shadow-ink-900/25",
        )}
      >
        {busy && <Loader2 className="h-5 w-5 animate-spin" />}
        {t("submit")} ({answered}/{CHECK_ITEMS.length})
      </button>
    </div>
  );
}
