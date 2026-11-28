import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { IdCard, LayoutDashboard, LogOut, Mail, Phone } from "lucide-react";
import { requireDriver } from "@/lib/auth";
import { date, daysUntil, intlLocale } from "@/lib/format";
import { Avatar } from "@/components/ui";
import { LanguageSwitcher } from "@/components/app/client";
import { PoweredBy } from "@/components/app/logo";
import { cn } from "@/lib/utils";
import { DeleteDriverAccount } from "@/components/driver/delete-account";

export const metadata = { title: "Profile" };

export default async function DriverProfilePage() {
  const { driver, org, membership, user } = await requireDriver();
  const t = await getTranslations("driver.profile");
  const loc = intlLocale(await getLocale());

  const docs = [
    { key: "licence", value: driver.licence_expiry, extra: driver.licence_categories },
    { key: "cpc", value: driver.cpc_expiry },
    { key: "tacho", value: driver.tacho_card_expiry },
  ];

  return (
    <div className="space-y-5">
      <section className="flex items-center gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <Avatar name={driver.full_name} colour={driver.colour} size={56} />
        <div className="min-w-0">
          <div className="font-display text-xl font-bold text-slate-900">{driver.full_name}</div>
          <div className="text-sm text-slate-500">{org.name}</div>
        </div>
      </section>

      <section className="space-y-2 rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-2 text-slate-700">
          <Mail className="h-4 w-4 text-slate-400" /> {driver.email ?? user.email}
        </div>
        {driver.phone && (
          <div className="flex items-center gap-2 text-slate-700">
            <Phone className="h-4 w-4 text-slate-400" /> {driver.phone}
          </div>
        )}
        {driver.licence_number && (
          <div className="flex items-center gap-2 text-slate-700">
            <IdCard className="h-4 w-4 text-slate-400" /> {driver.licence_number}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{t("documents")}</h2>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          {docs.map((d) => {
            const days = daysUntil(d.value);
            const tone =
              days === null ? "bg-slate-100 text-slate-500" : days < 0 ? "bg-rose-50 text-rose-700" : days <= 30 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700";
            return (
              <li key={d.key} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <div className="font-medium text-slate-900">{t(`doc.${d.key}`)}</div>
                  <div className="text-xs text-slate-500">
                    {d.value ? t("expires", { date: date(d.value, loc) }) : t("notRecorded")}
                    {d.extra ? ` · ${d.extra}` : ""}
                  </div>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", tone)}>
                  {days === null ? "—" : days < 0 ? t("expired") : t("daysLeft", { days })}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 px-1 text-xs text-slate-500">{t("documentsHint")}</p>
      </section>

      <section className="flex items-center justify-between rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <span className="font-medium text-slate-900">{t("language")}</span>
        <LanguageSwitcher className="text-base" />
      </section>

      {membership.role !== "driver" && (
        <Link href="/app" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white font-semibold text-slate-800 ring-1 ring-slate-200">
          <LayoutDashboard className="h-5 w-5" /> {t("officeApp")}
        </Link>
      )}

      <form action="/auth/signout" method="post">
        <button className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 font-semibold text-rose-700 ring-1 ring-rose-200">
          <LogOut className="h-5 w-5" /> {t("signOut")}
        </button>
      </form>

      {membership.role === "driver" && <DeleteDriverAccount />}

      <div className="text-center">
        <PoweredBy />
      </div>
    </div>
  );
}
