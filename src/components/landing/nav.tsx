"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { LanguageSwitcher } from "@/components/app/client";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

const LINKS = ["features", "how", "pricing", "faq"] as const;

export function LandingNav() {
  const t = useTranslations("landing.nav");
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all",
        scrolled || open ? "bg-ink-950/85 shadow-lg shadow-black/20 backdrop-blur-xl" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" aria-label="MatrixFleet home">
          <Logo dark size={30} />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a key={l} href={`#${l}`} className="text-sm font-medium text-white/70 transition hover:text-white">
              {t(l)}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher dark />
          <Link href="/login" className="text-sm font-medium text-white/80 hover:text-white">
            {t("signIn")}
          </Link>
          <Link href="/signup" className={buttonClass("lime", "sm", "px-4")}>
            {t("trial")}
          </Link>
        </div>
        <button className="rounded-lg p-2 text-white md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-white/10 px-5 pb-6 md:hidden">
          <nav className="flex flex-col py-3">
            {LINKS.map((l) => (
              <a key={l} href={`#${l}`} onClick={() => setOpen(false)} className="py-2.5 text-base font-medium text-white/80">
                {t(l)}
              </a>
            ))}
          </nav>
          <div className="flex flex-col gap-3">
            <Link href="/signup" className={buttonClass("lime", "lg", "w-full")}>
              {t("trial")}
            </Link>
            <Link href="/login" className={buttonClass("dark", "lg", "w-full ring-1 ring-white/15")}>
              {t("signIn")}
            </Link>
            <LanguageSwitcher dark className="justify-center pt-2" />
          </div>
        </div>
      )}
    </header>
  );
}
