import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { requireDriver } from "@/lib/auth";
import { LogoMark } from "@/components/app/logo";
import { Avatar } from "@/components/ui";
import { TabBar } from "@/components/driver/tab-bar";
import { GpsIndicator, GpsTracker } from "@/components/driver/gps";
import { ServiceWorkerRegister } from "@/components/driver/pwa";

export const metadata: Metadata = { title: "Driver", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { themeColor: "#0a1430", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const { driver, org } = await requireDriver();
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 bg-ink-900 pt-[env(safe-area-inset-top)] text-white shadow-lg shadow-ink-900/20">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between gap-3 px-4">
          <Link href="/driver" className="flex min-w-0 items-center gap-2.5">
            <LogoMark size={28} />
            <div className="min-w-0 leading-tight">
              <div className="font-display text-[15px] font-bold">MatrixFleet</div>
              <div className="truncate text-[11px] text-white/50">{org.name}</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <GpsIndicator />
            <Link href="/driver/profile" aria-label={driver.full_name}>
              <Avatar name={driver.full_name} colour={driver.colour} size={32} />
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-28 pt-4">{children}</main>
      <TabBar />
      <GpsTracker />
      <ServiceWorkerRegister />
    </div>
  );
}
