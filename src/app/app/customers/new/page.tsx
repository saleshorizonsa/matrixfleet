import { getTranslations } from "next-intl/server";
import { requireOffice } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "@/components/customers/customer-form";

export const metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  const ctx = await requireOffice(["owner", "admin", "dispatcher", "accountant"]);
  const t = await getTranslations("customers");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("add")} />
      <CustomerForm defaultCountry={ctx.org.country} currency={ctx.org.currency} unit={ctx.org.distance_unit} />
    </div>
  );
}
