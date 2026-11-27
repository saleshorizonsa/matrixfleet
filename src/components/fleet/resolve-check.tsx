"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { resolveCheck } from "@/app/app/fleet/actions";
import { Button } from "@/components/ui";

export function ResolveCheckButton({ checkId, vehicleId }: { checkId: string; vehicleId: string }) {
  const t = useTranslations("fleet");
  const [pending, start] = React.useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await resolveCheck(checkId, vehicleId);
          toast.success(t("checks.resolved"));
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
      {t("checks.markResolved")}
    </Button>
  );
}
