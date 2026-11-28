"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Download, Eye, Loader2, Mail, MessageCircle, Printer, Send, Share2 } from "lucide-react";
import { emailDocument, shareDocumentLink } from "@/app/app/documents/actions";
import { Button, Field, Input, Textarea, buttonClass } from "@/components/ui";
import { Modal } from "@/components/app/client";

export interface DocumentToolbarProps {
  kind: "invoice" | "cmr";
  id: string;
  filename: string;
  /** issued (not a draft / quote / void): email and WhatsApp allowed */
  shareable: boolean;
  email: { to: string; subject: string; message: string };
  whatsapp: { phone: string; message: string };
  /** show Email / WhatsApp at all (office users) */
  canSend?: boolean;
}

const pdfUrl = (kind: string, id: string, download = false) => `/api/pdf/${kind}/${id}${download ? "?download=1" : ""}`;

/** Narrow screens and iOS show only the first page of a PDF inside a frame → open it instead. */
const preferNewTab = () => typeof window !== "undefined" && (window.innerWidth < 768 || /iPhone|iPad|iPod/i.test(navigator.userAgent));

/**
 * Preview, print, download, email (PDF attached, sent by MatrixFleet) and WhatsApp (the PDF file on
 * phones, or a signed 30-day link) for one document. Used for invoices, credit notes and CMR notes.
 */
export function DocumentToolbar({ kind, id, filename, shareable, email, whatsapp, canSend = true }: DocumentToolbarProps) {
  const t = useTranslations("common.docs");
  const tc = useTranslations("common");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [mailOpen, setMailOpen] = React.useState(false);
  const [waOpen, setWaOpen] = React.useState(false);
  const blobRef = React.useRef<Blob | null>(null);

  React.useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const loadBlob = async () => {
    if (blobRef.current) return blobRef.current;
    const res = await fetch(pdfUrl(kind, id), { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    blobRef.current = await res.blob();
    return blobRef.current;
  };

  const onPreview = async () => {
    if (preferNewTab()) {
      window.open(pdfUrl(kind, id), "_blank", "noopener");
      return;
    }
    setBusy("preview");
    try {
      setPreview(URL.createObjectURL(await loadBlob()));
    } catch {
      toast.error(tc("errorGeneric"));
    } finally {
      setBusy(null);
    }
  };

  const onPrint = async () => {
    if (preferNewTab()) {
      window.open(pdfUrl(kind, id), "_blank", "noopener");
      toast.info(t("printHint"));
      return;
    }
    setBusy("print");
    try {
      const url = URL.createObjectURL(await loadBlob());
      const frame = document.createElement("iframe");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
      frame.src = url;
      frame.onload = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          window.open(url, "_blank", "noopener");
        }
        setTimeout(() => {
          frame.remove();
          URL.revokeObjectURL(url);
        }, 60_000);
      };
      document.body.appendChild(frame);
    } catch {
      toast.error(tc("errorGeneric"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button variant="secondary" disabled={!!busy} onClick={onPreview}>
        {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} {t("preview")}
      </Button>
      <Button variant="ghost" disabled={!!busy} onClick={onPrint} title={t("print")}>
        {busy === "print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} {t("print")}
      </Button>
      <a href={pdfUrl(kind, id, true)} className={buttonClass("ghost", "md")} title={t("download")}>
        <Download className="h-4 w-4" /> {t("download")}
      </a>
      {canSend && shareable && (
        <>
          <Button variant="ghost" onClick={() => setMailOpen(true)}>
            <Mail className="h-4 w-4" /> {t("email")}
          </Button>
          <Button variant="ghost" onClick={() => setWaOpen(true)} className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
        </>
      )}

      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={filename}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              {tc("close")}
            </Button>
            <Button variant="secondary" onClick={onPrint}>
              <Printer className="h-4 w-4" /> {t("print")}
            </Button>
            <a href={pdfUrl(kind, id, true)} className={buttonClass("primary", "md")}>
              <Download className="h-4 w-4" /> {t("download")}
            </a>
          </>
        }
      >
        {preview && <iframe src={preview} title={filename} className="h-[70vh] w-full rounded-lg border border-slate-200 bg-slate-50" />}
      </Modal>

      {mailOpen && <EmailDialog kind={kind} id={id} filename={filename} defaults={email} onClose={() => setMailOpen(false)} />}
      {waOpen && <WhatsAppDialog kind={kind} id={id} filename={filename} defaults={whatsapp} loadBlob={loadBlob} onClose={() => setWaOpen(false)} />}
    </>
  );
}

function EmailDialog({
  kind,
  id,
  filename,
  defaults,
  onClose,
}: {
  kind: "invoice" | "cmr";
  id: string;
  filename: string;
  defaults: DocumentToolbarProps["email"];
  onClose: () => void;
}) {
  const t = useTranslations("common.docs");
  const tc = useTranslations("common");
  const [to, setTo] = React.useState(defaults.to);
  const [cc, setCc] = React.useState("");
  const [subject, setSubject] = React.useState(defaults.subject);
  const [message, setMessage] = React.useState(defaults.message);
  const [copyMe, setCopyMe] = React.useState(true);
  const [pending, start] = React.useTransition();

  const send = () =>
    start(async () => {
      const r = await emailDocument({ kind, id, to, cc, subject, message, copyMe });
      if (r.ok) {
        toast.success(t("emailSent"));
        onClose();
      } else toast.error(t.has(`errors.${r.error}`) ? t(`errors.${r.error}`) : tc("errorGeneric"));
    });

  return (
    <Modal
      open
      onClose={onClose}
      title={t("emailTitle")}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button disabled={pending || !to.trim() || !subject.trim()} onClick={send}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t("send")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("to")} hint={t("toHint")}>
          <Input type="text" inputMode="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="accounts@customer.com" />
        </Field>
        <Field label={t("cc")}>
          <Input type="text" inputMode="email" value={cc} onChange={(e) => setCc(e.target.value)} />
        </Field>
        <Field label={t("subject")}>
          <Input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label={t("message")}>
          <Textarea rows={7} value={message} maxLength={5000} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2 text-slate-700">
            <input type="checkbox" checked={copyMe} onChange={(e) => setCopyMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            {t("copyMe")}
          </label>
          <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200">📎 {filename}</span>
        </div>
        <p className="text-xs text-slate-500">{t("emailNote")}</p>
      </div>
    </Modal>
  );
}

function WhatsAppDialog({
  kind,
  id,
  filename,
  defaults,
  loadBlob,
  onClose,
}: {
  kind: "invoice" | "cmr";
  id: string;
  filename: string;
  defaults: DocumentToolbarProps["whatsapp"];
  loadBlob: () => Promise<Blob>;
  onClose: () => void;
}) {
  const t = useTranslations("common.docs");
  const tc = useTranslations("common");
  const [phone, setPhone] = React.useState(defaults.phone);
  const [link, setLink] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState(defaults.message);
  const [error, setError] = React.useState<string | null>(null);
  // phones that can hand the PDF file itself to WhatsApp (Android / iOS share sheet)
  const [canShareFile] = React.useState(() => {
    try {
      const probe = new File([new Blob(["x"], { type: "application/pdf" })], "x.pdf", { type: "application/pdf" });
      return !!navigator.canShare?.({ files: [probe] }) && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    let alive = true;
    shareDocumentLink(kind, id).then((r) => {
      if (!alive) return;
      if (r.ok && r.url) {
        setLink(r.url);
        setMessage((m) => `${m}\n${r.url}`);
      } else setError(r.ok ? "invalid" : r.error);
    });
    return () => {
      alive = false;
    };
  }, [kind, id]);

  const digits = phone.replace(/[^\d]/g, "").replace(/^00/, "");
  const waHref = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  const shareFile = async () => {
    try {
      const blob = await loadBlob();
      const file = new File([blob], filename, { type: "application/pdf" });
      await navigator.share({ files: [file], text: defaults.message });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error(tc("errorGeneric"));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("whatsappTitle")}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc("close")}
          </Button>
          {link && (
            <a href={waHref} target="_blank" rel="noreferrer" className={buttonClass("primary", "md", "bg-emerald-600 hover:bg-emerald-700")}>
              <MessageCircle className="h-4 w-4" /> {t("openWhatsapp")}
            </a>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {canShareFile && (
          <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
            <p className="mb-2 text-sm text-emerald-900">{t("shareFileHint")}</p>
            <Button variant="secondary" onClick={shareFile}>
              <Share2 className="h-4 w-4" /> {t("shareFile")}
            </Button>
          </div>
        )}
        <Field label={t("whatsappNumber")} hint={t("whatsappNumberHint")}>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966 5x xxx xxxx" />
        </Field>
        <Field label={t("message")}>
          <Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        {!link && !error && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("creatingLink")}
          </p>
        )}
        {error && <p className="text-sm text-rose-600">{t.has(`errors.${error}`) ? t(`errors.${error}`) : tc("errorGeneric")}</p>}
        {link && (
          <div className="flex items-center gap-2">
            <Input readOnly value={link} className="font-mono text-xs" />
            <Button
              variant="secondary"
              onClick={() => navigator.clipboard.writeText(link).then(() => toast.success(tc("copied")))}
              title={tc("copy")}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}
        <p className="text-xs text-slate-500">{t("linkNote")}</p>
      </div>
    </Modal>
  );
}
