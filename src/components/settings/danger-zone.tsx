"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Card, CardBody, CardHeader, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/app/client";
import { ActionForm } from "./action-form";
import { deleteOrganization, deleteMyAccount } from "@/app/app/settings/actions";

export function DangerZone({ orgName, isOwner }: { orgName: string; isOwner: boolean }) {
  const t = useTranslations("settings.privacy");
  const [orgConfirm, setOrgConfirm] = React.useState("");
  const [meConfirm, setMeConfirm] = React.useState("");

  return (
    <Card className="ring-rose-200">
      <CardHeader
        title={
          <span className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="h-4 w-4" /> {t("dangerTitle")}
          </span>
        }
        description={t("dangerHint")}
      />
      <CardBody className="grid gap-6 md:grid-cols-2">
        <ActionForm action={deleteMyAccount} className="space-y-3 rounded-xl bg-slate-50 p-4">
          <div className="font-semibold text-slate-900">{t("deleteMeTitle")}</div>
          <p className="text-sm text-slate-500">{t("deleteMeBody")}</p>
          <Field label={t("typeDelete")}>
            <Input name="confirm" value={meConfirm} onChange={(e) => setMeConfirm(e.target.value)} autoComplete="off" />
          </Field>
          <SubmitButton variant="danger" disabled={meConfirm !== "DELETE"}>
            {t("deleteMeButton")}
          </SubmitButton>
        </ActionForm>

        {isOwner && (
          <ActionForm action={deleteOrganization} className="space-y-3 rounded-xl bg-rose-50/60 p-4 ring-1 ring-rose-100">
            <div className="font-semibold text-rose-800">{t("deleteOrgTitle")}</div>
            <p className="text-sm text-rose-700/80">{t("deleteOrgBody")}</p>
            <Field label={t("typeName", { name: orgName })}>
              <Input name="confirm" value={orgConfirm} onChange={(e) => setOrgConfirm(e.target.value)} autoComplete="off" />
            </Field>
            <SubmitButton variant="danger" disabled={orgConfirm !== orgName}>
              {t("deleteOrgButton")}
            </SubmitButton>
          </ActionForm>
        )}
      </CardBody>
    </Card>
  );
}
