"use client";
import * as React from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface GeoHit {
  label: string;
  lat: number;
  lng: number;
  name: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
}

/** Type-ahead address search backed by /api/geo/search (OpenStreetMap Nominatim). */
export function AddressSearch({ onSelect, placeholder }: { onSelect: (hit: GeoHit) => void; placeholder?: string }) {
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<GeoHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (q.trim().length < 3) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const json = await res.json();
        setHits(json.results ?? []);
        setActive(0);
        setOpen(true);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (h: GeoHit) => {
    onSelect(h);
    setQ("");
    setHits([]);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          if (e.target.value.trim().length < 3) setHits([]);
        }}
        onFocus={() => hits.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || !hits.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(hits[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        className="pl-9 pr-9"
        autoComplete="off"
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      {open && hits.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-200">
          {hits.map((h, i) => (
            <li key={`${h.lat},${h.lng},${i}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(h)}
                className={cn("flex w-full items-start gap-2 px-3 py-2 text-left text-sm", i === active ? "bg-brand-50" : "hover:bg-slate-50")}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <span className="line-clamp-2 text-slate-700">{h.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
