import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireOffice } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "@/components/customers/customer-form";
import type { Customer } from "@/lib/types";

export const metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOffice(["owner", "admin", "dispatcher", "accountant"]);
  const t = await getTranslations("customers");
  const { data: customer } = await ctx.supabase.from("hl_customers").select("*").eq("id", id).eq("org_id", ctx.org.id).maybeSingle<Customer>();
  if (!customer) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("edit", { name: customer.name })} />
      <CustomerForm customer={customer} defaultCountry={ctx.org.country} currency={ctx.org.currency} unit={ctx.org.distance_unit} />
    </div>
  );
}
