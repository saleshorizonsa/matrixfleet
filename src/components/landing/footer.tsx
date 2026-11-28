import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/app/logo";
import { LanguageSwitcher } from "@/components/app/client";

export function LandingFooter() {
  const t = useTranslations("landing.footer");
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink-950 text-white/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="sm:col-span-2 lg:col-span-1">
          <Logo dark size={30} />
          <p className="mt-4 max-w-xs text-sm">{t("tagline")}</p>
          <p className="mt-4 text-xs text-white/40">{t("product")}</p>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{t("productTitle")}</div>
          <ul className="mt-4 space-y-2 text-sm">
            <li><a href="#features" className="hover:text-white">{t("features")}</a></li>
            <li><a href="#pricing" className="hover:text-white">{t("pricing")}</a></li>
            <li><a href="#faq" className="hover:text-white">{t("faq")}</a></li>
            <li><Link href="/signup" className="hover:text-white">{t("trial")}</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{t("legalTitle")}</div>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/legal/terms" className="hover:text-white">{t("terms")}</Link></li>
            <li><Link href="/legal/privacy" className="hover:text-white">{t("privacy")}</Link></li>
            <li><Link href="/legal/cookies" className="hover:text-white">{t("cookies")}</Link></li>
            <li><Link href="/legal/dpa" className="hover:text-white">{t("dpa")}</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{t("trustTitle")}</div>
          <ul className="mt-4 space-y-2 text-sm">
            <li>{t("trust1")}</li>
            <li>{t("trust2")}</li>
            <li>{t("trust3")}</li>
          </ul>
          <LanguageSwitcher dark className="mt-6" />
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-white/40 sm:flex-row lg:px-8">
          <span>© {year} Matrix Infotech Ltd. {t("rights")}</span>
          <span>
            Powered by <span className="font-semibold text-white/70">Matrix Infotech Ltd</span>
          </span>
        </div>
        {/* Company details required on business websites (Companies (Trading Disclosures) Regulations 2008) */}
        <p className="mx-auto max-w-7xl px-5 pb-6 text-center text-[11px] leading-relaxed text-white/35 sm:text-left lg:px-8">
          {t("registered", { number: "15056659", address: "167–169 Great Portland Street, Fifth Floor, London W1W 5PF" })}
        </p>
      </div>
    </footer>
  );
}
