import { requireOffice } from "@/lib/auth";
import { Sidebar } from "@/components/app/sidebar";
import { trialDaysLeft, isSubscriptionActive } from "@/lib/plans";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOffice();
  const t = await getTranslations("nav");
  const { data: driver } = await ctx.supabase.from("hl_drivers").select("id").eq("user_id", ctx.user.id).maybeSingle();
  const active = isSubscriptionActive(ctx.org);

  return (
    <div className="min-h-screen">
      <Sidebar
        orgName={ctx.org.name}
        userName={ctx.membership.full_name || ctx.user.email}
        role={ctx.membership.role}
        isTrial={ctx.org.plan === "trial"}
        trialDaysLeft={trialDaysLeft(ctx.org)}
        hasDriverProfile={!!driver}
      />
      <div className="lg:pl-64">
        {!active && (
          <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            {t("subscriptionInactive")}{" "}
            <Link href="/app/settings/billing" className="font-semibold underline">
              {t("upgradeCta")}
            </Link>
          </div>
        )}
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
