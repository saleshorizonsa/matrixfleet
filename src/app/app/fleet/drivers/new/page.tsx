import { getTranslations } from "next-intl/server";
import { requireOffice } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { DriverForm } from "@/components/fleet/driver-form";

export const metadata = { title: "Add driver" };

export default async function NewDriverPage() {
  await requireOffice(["owner", "admin", "dispatcher"]);
  const t = await getTranslations("fleet");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("drivers.add")} />
      <DriverForm />
    </div>
  );
}
