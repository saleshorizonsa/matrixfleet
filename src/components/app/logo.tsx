import { cn } from "@/lib/utils";

/** Haulora mark: a stylised "H" formed by two lanes and a route arc. */
export function LogoMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <rect width="40" height="40" rx="11" fill="url(#hl-g)" />
      <path d="M12 10v20M28 10v20" stroke="white" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M12 21c4.5-6 11.5-6 16 0" stroke="#C6F432" strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="28" cy="21" r="2.4" fill="#C6F432" />
      <defs>
        <linearGradient id="hl-g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5B5BF7" />
          <stop offset="1" stopColor="#2A1FA8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({ className, dark = false, size = 32 }: { className?: string; dark?: boolean; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className={cn("font-display text-xl font-bold tracking-tight", dark ? "text-white" : "text-ink-900")}>
        Haulora
      </span>
    </span>
  );
}

export function PoweredBy({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn("text-xs", dark ? "text-white/50" : "text-slate-400", className)}>
      Powered by <span className={cn("font-semibold", dark ? "text-white/80" : "text-slate-600")}>Matrix Infotech Ltd</span>
    </span>
  );
}
