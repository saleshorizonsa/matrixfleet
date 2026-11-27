import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Logo, PoweredBy } from "@/components/app/logo";

const PAGES = [
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/cookies", label: "Cookie Policy" },
  { href: "/legal/dpa", label: "Data Processing Agreement" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-ink-900">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link href="/">
            <Logo dark size={28} />
          </Link>
          <Link href="/signup" className="text-sm font-medium text-white/80 hover:text-white">
            Start free trial →
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-12 md:grid-cols-[200px_1fr]">
        <nav className="space-y-1 text-sm md:sticky md:top-8 md:h-fit">
          {PAGES.map((p) => (
            <Link key={p.href} href={p.href} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              {p.label}
            </Link>
          ))}
        </nav>
        <article className="max-w-none text-[15px] leading-relaxed text-slate-700 [&_a]:text-brand-600 [&_a]:underline [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-slate-900 [&_li]:mt-1.5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-3 [&_table]:mt-4 [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-2 [&_th]:text-left [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
          <div className="mb-8 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Template — have this reviewed by a qualified lawyer before launch.</strong> This document is a starting point
              and is not legal advice.
            </span>
          </div>
          {children}
        </article>
      </div>
      <footer className="border-t border-slate-200 py-8 text-center">
        <PoweredBy />
      </footer>
    </div>
  );
}
