"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { ImageUp } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { SubmitButton, ConfirmButton } from "@/components/app/client";
import { ActionForm } from "./action-form";
import { uploadLogo, removeLogo } from "@/app/app/settings/actions";

export function LogoUploader({ logoUrl, canEdit }: { logoUrl: string | null; canEdit: boolean }) {
  const t = useTranslations("settings.company");
  const [preview, setPreview] = React.useState<string | null>(null);
  const shown = preview ?? logoUrl;

  return (
    <Card>
      <CardHeader title={t("logo")} description={t("logoHint")} />
      <CardBody>
        <ActionForm action={uploadLogo} onSuccess={() => setPreview(null)} className="space-y-4">
          <label className="flex aspect-[3/2] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 transition hover:border-brand-300 hover:bg-brand-50/40">
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt="" className="max-h-28 max-w-[80%] object-contain" />
            ) : (
              <>
                <ImageUp className="h-7 w-7 text-slate-400" />
                {t("chooseLogo")}
              </>
            )}
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="sr-only"
              disabled={!canEdit}
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPreview(f ? URL.createObjectURL(f) : null);
              }}
            />
          </label>
          {canEdit && (
            <div className="flex gap-2">
              <SubmitButton size="sm" disabled={!preview}>
                {t("uploadLogo")}
              </SubmitButton>
              {logoUrl && (
                <ConfirmButton action={removeLogo} message={t("removeLogoConfirm")}>
                  {t("removeLogo")}
                </ConfirmButton>
              )}
            </div>
          )}
        </ActionForm>
      </CardBody>
    </Card>
  );
}
