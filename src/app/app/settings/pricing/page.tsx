import { requireOffice, ADMIN_ROLES } from "@/lib/auth";
import { PricingForm } from "@/components/settings/pricing-form";

export const metadata = { title: "Pricing settings" };

export default async function PricingSettingsPage() {
  const ctx = await requireOffice();
  return (
    <PricingForm
      pricing={ctx.org.pricing}
      currency={ctx.org.currency}
      unit={ctx.org.distance_unit}
      canEdit={ADMIN_ROLES.includes(ctx.membership.role)}
    />
  );
}
