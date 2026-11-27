import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PackageSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Logo, PoweredBy } from "@/components/app/logo";
import { TrackingView, type TrackingData } from "./tracking-view";

export const metadata: Metadata = { title: "Track your delivery", robots: { index: false, follow: false } };

export default async function PublicTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("tracking.public");
  const supabase = await createClient();
  const { data } = await supabase.rpc("hl_get_tracking", { p_token: token.slice(0, 64) });
  const tracking = data as TrackingData | null;

  if (!tracking) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-500">
            <PackageSearch className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{t("notFoundTitle")}</h1>
          <p className="mt-2 text-sm text-slate-500">{t("notFound")}</p>
          <div className="mt-10 flex flex-col items-center gap-2">
            <Logo size={24} />
            <PoweredBy />
          </div>
        </div>
      </div>
    );
  }
  return <TrackingView data={tracking} />;
}
