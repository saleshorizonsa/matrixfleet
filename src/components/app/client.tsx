"use client";
// Small client-side helpers shared across modules.
import * as React from "react";
import { useFormStatus } from "react-dom";
import { useLocale } from "next-intl";
import { Globe, Loader2, X } from "lucide-react";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { setLocale } from "./locale-actions";
import { buttonClass, type ButtonProps } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Submit button that shows a spinner while its parent <form> action is pending. */
export function SubmitButton({ children, variant = "primary", size = "md", className, pendingText, ...rest }: ButtonProps & { pendingText?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || rest.disabled} className={buttonClass(variant, size, className)} {...rest}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function LanguageSwitcher({ dark = false, className }: { dark?: boolean; className?: string }) {
  const locale = useLocale();
  const [pending, start] = React.useTransition();
  return (
    <label className={cn("relative inline-flex items-center gap-1.5 text-sm", dark ? "text-white/70" : "text-slate-600", className)}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
      <select
        aria-label="Language"
        value={locale}
        onChange={(e) => start(() => setLocale(e.target.value))}
        className={cn("cursor-pointer appearance-none bg-transparent pr-1 font-medium outline-none", dark && "[&>option]:text-slate-900")}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Accessible modal dialog. Control with `open` / `onClose`. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("animate-fade-up relative max-h-[92vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl", width)}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Confirm before running a server action (e.g. delete). */
export function ConfirmButton({
  action,
  children,
  message,
  className,
  variant = "ghost",
  size = "sm",
}: {
  action: () => Promise<unknown>;
  children: React.ReactNode;
  message: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const [pending, start] = React.useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass(variant, size, className)}
      onClick={() => {
        if (window.confirm(message)) start(async () => void (await action()));
      }}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
