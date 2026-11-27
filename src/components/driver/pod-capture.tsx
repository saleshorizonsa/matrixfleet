"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import SignaturePad from "signature_pad";
import { Camera, Eraser, Loader2, MapPin, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitPod } from "@/app/driver/actions";
import { compressImage, randomId } from "./image";
import { getCurrentPosition } from "./gps";
import { Field, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 4;

export function PodCapture({ open, onClose, jobId, orgId }: { open: boolean; onClose: () => void; jobId: string; orgId: string }) {
  const t = useTranslations("driver.pod");
  const router = useRouter();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const padRef = React.useRef<SignaturePad | null>(null);
  const [signed, setSigned] = React.useState(false);
  const [name, setName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [photos, setPhotos] = React.useState<{ blob: Blob; url: string }[]>([]);
  const [pos, setPos] = React.useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = React.useState<false | "compress" | "upload">(false);

  // set up signature pad when the sheet opens; keep canvas pixel-perfect on resize/rotation
  React.useEffect(() => {
    if (!open || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const pad = new SignaturePad(canvas, { penColor: "#0a1430", minWidth: 1, maxWidth: 2.8 });
    padRef.current = pad;
    const resize = () => {
      const data = pad.toData();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")!.scale(ratio, ratio);
      pad.clear();
      pad.fromData(data);
    };
    resize();
    const onEnd = () => setSigned(!pad.isEmpty());
    pad.addEventListener("endStroke", onEnd);
    window.addEventListener("resize", resize);
    getCurrentPosition(8000).then(setPos);
    return () => {
      pad.removeEventListener("endStroke", onEnd);
      window.removeEventListener("resize", resize);
      pad.off();
      padRef.current = null;
    };
  }, [open]);

  // revoke object URLs only when the sheet unmounts
  const photosRef = React.useRef(photos);
  React.useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  React.useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  if (!open) return null;

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy("compress");
    const room = MAX_PHOTOS - photos.length;
    const next: { blob: Blob; url: string }[] = [];
    for (const f of Array.from(files).slice(0, room)) {
      const blob = await compressImage(f);
      next.push({ blob, url: URL.createObjectURL(blob) });
    }
    setPhotos((p) => [...p, ...next]);
    setBusy(false);
  };

  const submit = async () => {
    if (!name.trim()) return toast.error(t("nameRequired"));
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return toast.error(t("signatureRequired"));
    setBusy("upload");
    try {
      const supabase = createClient();
      const base = `${orgId}/${jobId}`;
      const sigBlob = await (await fetch(pad.toDataURL("image/png"))).blob();
      const sigPath = `${base}/signature-${randomId()}.png`;
      const up = await supabase.storage.from("hl-pod").upload(sigPath, sigBlob, { contentType: "image/png", upsert: false });
      if (up.error) throw up.error;
      const photoPaths: string[] = [];
      for (const p of photos) {
        const path = `${base}/photo-${randomId()}.jpg`;
        const r = await supabase.storage.from("hl-pod").upload(path, p.blob, { contentType: "image/jpeg", upsert: false });
        if (r.error) throw r.error;
        photoPaths.push(path);
      }
      const res = await submitPod(jobId, {
        signedBy: name,
        signaturePath: sigPath,
        photoPaths,
        notes: notes.trim() || null,
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
      });
      if (!res.ok) throw new Error(res.error);
      if ("vibrate" in navigator) navigator.vibrate?.([40, 60, 40]);
      toast.success(t("success"));
      onClose();
      router.refresh();
    } catch (e) {
      toast.error(t("uploadFailed"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-white" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between bg-ink-900 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] text-white">
        <h2 className="font-display text-lg font-bold">{t("title")}</h2>
        <button type="button" onClick={onClose} disabled={!!busy} className="rounded-lg p-1.5 text-white/70" aria-label={t("close")}>
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <Field label={t("recipient")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("recipientPlaceholder")} className="h-12 text-base" autoComplete="off" />
        </Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">{t("signature")}</span>
            <button
              type="button"
              onClick={() => {
                padRef.current?.clear();
                setSigned(false);
              }}
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-500"
            >
              <Eraser className="h-4 w-4" /> {t("clear")}
            </button>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200">
            <canvas ref={canvasRef} className="signature block h-48 w-full" />
            {!signed && (
              <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-400">{t("signHere")}</span>
            )}
            <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-slate-300" />
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-sm font-medium text-slate-700">
            {t("photos")} <span className="text-slate-400">({photos.length}/{MAX_PHOTOS})</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((p, i) => (
              <div key={p.url} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(p.url);
                    setPhotos((ps) => ps.filter((_, j) => j !== i));
                  }}
                  className="absolute right-1 top-1 rounded-full bg-ink-900/70 p-0.5 text-white"
                  aria-label={t("removePhoto")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className={cn("grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 text-slate-500 active:bg-slate-50", busy === "compress" && "opacity-50")}>
                {busy === "compress" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
                <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
              </label>
            )}
          </div>
        </div>

        <Field label={t("notes")}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPlaceholder")} rows={3} />
        </Field>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5" />
          {pos ? t("gpsCaptured", { lat: pos.lat.toFixed(5), lng: pos.lng.toFixed(5) }) : t("gpsMissing")}
        </div>
      </div>

      <div className="border-t border-slate-200 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <button
          type="button"
          onClick={submit}
          disabled={!!busy}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-lg font-bold text-white shadow-lg shadow-emerald-500/30 disabled:opacity-60"
        >
          {busy === "upload" && <Loader2 className="h-5 w-5 animate-spin" />}
          {busy === "upload" ? t("uploading") : t("confirm")}
        </button>
      </div>
    </div>
  );
}
