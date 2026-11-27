"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { reverifyCustomerVat } from "@/app/app/customers/actions";
import { Button } from "@/components/ui";

export function ReverifyVatButton({ customerId }: { customerId: string }) {
  const t = useTranslations("customers");
  const [pending, start] = React.useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      className="w-full"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await reverifyCustomerVat(customerId);
          if (!res) return;
          if (res.verified) toast.success(t("vat.verified"));
          else if (res.offline) toast.warning(t("vat.offline"));
          else toast.error(res.formatValid ? t("vat.notFound") : t("vat.badFormat"));
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      {t("vat.recheck")}
    </Button>
  );
}
