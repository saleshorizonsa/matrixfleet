"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard, Package, KanbanSquare, MapPinned, Users, Truck, IdCard, ShieldCheck,
  Receipt, Settings, Menu, X, LogOut, Smartphone, Sparkles,
} from "lucide-react";
import { Logo, PoweredBy } from "./logo";
import { LanguageSwitcher } from "./client";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

type NavItem = { href: string; key: string; icon: React.ComponentType<{ className?: string }>; roles?: Role[] };

const SECTIONS: { key: string; items: NavItem[] }[] = [
  {
    key: "operations",
    items: [
      { href: "/app", key: "dashboard", icon: LayoutDashboard },
      { href: "/app/jobs", key: "jobs", icon: Package },
      { href: "/app/dispatch", key: "dispatch", icon: KanbanSquare, roles: ["owner", "admin", "dispatcher"] },
      { href: "/app/tracking", key: "tracking", icon: MapPinned },
    ],
  },
  {
    key: "business",
    items: [
      { href: "/app/customers", key: "customers", icon: Users },
      { href: "/app/invoices", key: "invoices", icon: Receipt, roles: ["owner", "admin", "accountant", "dispatcher"] },
    ],
  },
  {
    key: "fleet",
    items: [
      { href: "/app/fleet/vehicles", key: "vehicles", icon: Truck },
      { href: "/app/fleet/drivers", key: "drivers", icon: IdCard },
      { href: "/app/fleet/compliance", key: "compliance", icon: ShieldCheck },
    ],
  },
];

export function Sidebar({
  orgName,
  userName,
  role,
  trialDaysLeft,
  isTrial,
  hasDriverProfile,
}: {
  orgName: string;
  userName: string;
  role: Role;
  trialDaysLeft: number;
  isTrial: boolean;
  hasDriverProfile: boolean;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  // close the mobile drawer whenever the route changes
  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/app">
          <Logo dark size={30} />
        </Link>
        <button className="rounded-lg p-1 text-white/60 hover:text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-4 mb-4 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
        <div className="text-[11px] uppercase tracking-wider text-white/40">{t("workspace")}</div>
        <div className="truncate text-sm font-semibold text-white">{orgName}</div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3">
        {SECTIONS.map((section) => {
          const items = section.items.filter((i) => !i.roles || i.roles.includes(role));
          if (!items.length) return null;
          return (
            <div key={section.key}>
              <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/35">{t(`section.${section.key}`)}</div>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                          active ? "bg-brand-500 text-white shadow-lg shadow-brand-500/25" : "text-white/65 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <Icon className={cn("h-[18px] w-[18px]", active ? "text-white" : "text-white/45 group-hover:text-white/80")} />
                        {t(item.key)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="space-y-3 p-4">
        {isTrial && (
          <Link
            href="/app/settings/billing"
            className="block rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-3.5 text-white ring-1 ring-white/10 transition hover:brightness-110"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-lime-signal" /> {t("trialLeft", { days: trialDaysLeft })}
            </div>
            <div className="mt-0.5 text-xs text-white/70">{t("upgradeCta")}</div>
          </Link>
        )}
        {hasDriverProfile && (
          <Link href="/driver" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/65 hover:bg-white/5 hover:text-white">
            <Smartphone className="h-4 w-4" /> {t("driverApp")}
          </Link>
        )}
        <Link
          href="/app/settings"
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
            pathname.startsWith("/app/settings") ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
          )}
        >
          <Settings className="h-4 w-4" /> {t("settings")}
        </Link>
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5 ring-1 ring-white/10">
          <Avatar name={userName} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{userName}</div>
            <div className="text-xs capitalize text-white/45">{t(`role.${role}`)}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white" title={t("signOut")} aria-label={t("signOut")}>
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
        <div className="flex items-center justify-between px-1">
          <LanguageSwitcher dark />
          <PoweredBy dark className="text-[10px]" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/app">
          <Logo size={26} />
        </Link>
        <span className="w-8" />
      </div>

      {/* desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-ink-900 lg:block">{content}</aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/60" onClick={() => setOpen(false)} />
          <aside className="animate-fade-up absolute inset-y-0 left-0 w-72 bg-ink-900">{content}</aside>
        </div>
      )}
    </>
  );
}
