"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ClipboardCheck, Clock, Package, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/driver", key: "jobs", icon: Package },
  { href: "/driver/check", key: "check", icon: ClipboardCheck },
  { href: "/driver/shift", key: "shift", icon: Clock },
  { href: "/driver/profile", key: "profile", icon: UserRound },
] as const;

export function TabBar() {
  const t = useTranslations("driver.tabs");
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {TABS.map(({ href, key, icon: Icon }) => {
          const active = href === "/driver" ? pathname === "/driver" || pathname.startsWith("/driver/jobs") : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition",
                  active ? "text-brand-600" : "text-slate-500 active:text-slate-900",
                )}
              >
                <span className={cn("grid h-8 w-12 place-items-center rounded-full transition", active && "bg-brand-50")}>
                  <Icon className="h-5 w-5" />
                </span>
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
