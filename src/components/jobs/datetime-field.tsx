"use client";
import * as React from "react";
import { Input } from "@/components/ui";

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const noopSubscribe = () => () => {};

/** datetime-local input that submits a timezone-correct ISO string under `name`. */
export function DateTimeField({ name, defaultValue }: { name: string; defaultValue?: string | null }) {
  // Only format in the browser's time zone after hydration (server TZ may differ).
  const mounted = React.useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [local, setLocal] = React.useState<string | null>(null); // null = untouched
  const shown = local ?? (mounted ? toLocalInput(defaultValue) : "");
  const iso = local === null ? defaultValue ?? "" : local ? new Date(local).toISOString() : "";
  return (
    <>
      <Input type="datetime-local" value={shown} onChange={(e) => setLocal(e.target.value)} />
      <input type="hidden" name={name} value={iso} />
    </>
  );
}
