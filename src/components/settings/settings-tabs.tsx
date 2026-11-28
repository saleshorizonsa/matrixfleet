"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, Calculator, Users, CreditCard, ShieldCheck, ScrollText, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/app/settings", key: "company", icon: Building2 },
  { href: "/app/settings/pricing", key: "pricing", icon: Calculator },
  { href: "/app/settings/einvoicing", key: "einvoicing", icon: FileCheck2, einvoicing: true },
  { href: "/app/settings/team", key: "team", icon: Users },
  { href: "/app/settings/billing", key: "billing", icon: CreditCard },
  { href: "/app/settings/privacy", key: "privacy", icon: ShieldCheck },
  { href: "/app/settings/audit", key: "audit", icon: ScrollText, adminOnly: true },
];

export function SettingsTabs({ isAdmin, einvoicing = false }: { isAdmin: boolean; einvoicing?: boolean }) {
  const t = useTranslations("settings.tabs");
  const pathname = usePathname();
  return (
    <nav className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 px-1">
      {TABS.filter((tab) => (!tab.adminOnly || isAdmin) && (!("einvoicing" in tab) || einvoicing)).map((tab) => {
        const active = tab.href === "/app/settings" ? pathname === tab.href : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition",
              active ? "border-brand-500 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            <Icon className="h-4 w-4" />
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
