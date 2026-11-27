import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { Logo, PoweredBy } from "@/components/app/logo";
import { LanguageSwitcher } from "@/components/app/client";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth");
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-900 lg:block">
        <div className="bg-grid absolute inset-0" />
        <div className="absolute -left-32 top-1/3 h-[480px] w-[480px] rounded-full bg-brand-500/30 blur-[120px]" />
        <div className="absolute -right-20 bottom-0 h-[320px] w-[320px] rounded-full bg-lime-signal/10 blur-[100px]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/">
            <Logo dark />
          </Link>
          <div className="max-w-md">
            <h2 className="font-display text-4xl font-bold leading-tight text-white">{t("panelTitle")}</h2>
            <ul className="mt-8 space-y-4">
              {(["p1", "p2", "p3", "p4"] as const).map((k) => (
                <li key={k} className="flex items-start gap-3 text-white/75">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-signal" />
                  {t(`panel.${k}`)}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center justify-between">
            <PoweredBy dark />
            <span className="text-xs text-white/40">{t("dataResidency")}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-6">
          <Link href="/" className="lg:invisible">
            <Logo size={28} />
          </Link>
          <LanguageSwitcher />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
