import { cn } from "@/lib/utils";

/** MatrixFleet mark: an "M" — two white lanes joined by a lime route, with a stop at its centre. */
export function LogoMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <rect width="40" height="40" rx="11" fill="url(#mf-g)" />
      <path d="M11 29V12M29 12v17" stroke="white" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M11 12l9 10 9-10" stroke="#C6F432" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="22" r="2.6" fill="white" />
      <defs>
        <linearGradient id="mf-g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
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
        Matrix<span className={dark ? "text-lime-signal" : "text-brand-500"}>Fleet</span>
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
