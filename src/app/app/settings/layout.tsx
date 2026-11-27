import { getTranslations } from "next-intl/server";
import { requireOffice, ADMIN_ROLES } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "@/components/settings/settings-tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOffice();
  const t = await getTranslations("settings");
  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SettingsTabs isAdmin={ADMIN_ROLES.includes(ctx.membership.role)} />
      {children}
    </div>
  );
}
