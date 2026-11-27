"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardBody, CardHeader, Checkbox, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/app/client";
import { ActionForm } from "./action-form";
import { updatePricing } from "@/app/app/settings/actions";
import { money, intlLocale } from "@/lib/format";
import type { PricingSettings } from "@/lib/types";
import { calculateQuote } from "@/lib/pricing";

const FIELDS: (keyof PricingSettings)[] = ["base_fee", "rate_per_distance", "fuel_surcharge_pct", "adr_surcharge", "per_pallet"];

export function PricingForm({
  pricing,
  currency,
  unit,
  canEdit,
}: {
  pricing: PricingSettings;
  currency: string;
  unit: "km" | "mi";
  canEdit: boolean;
}) {
  const t = useTranslations("settings.pricing");
  const ts = useTranslations("settings");
  const locale = intlLocale(useLocale());
  const [p, setP] = React.useState<PricingSettings>({ ...pricing });
  const [distance, setDistance] = React.useState(unit === "mi" ? 120 : 200);
  const [pallets, setPallets] = React.useState(4);
  const [adr, setAdr] = React.useState(false);

  // same engine as the job form, so the example always matches real quotes
  const q = calculateQuote({ distanceKm: unit === "mi" ? distance / 0.621371 : distance, unit, pallets, adr, pricing: p });
  const linehaul = q.distanceCharge;
  const palletFee = q.palletCharge;
  const fuel = q.fuelCharge;
  const total = q.total;
  const m = (v: number) => money(v, currency, locale);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <ActionForm action={updatePricing}>
        <Card>
          <CardHeader title={t("title")} description={t("subtitle")} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <Field key={f} label={t(`fields.${f}`, { unit, currency })} hint={t(`hints.${f}`)}>
                <Input
                  name={f}
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={!canEdit}
                  value={Number.isFinite(p[f]) ? p[f] : 0}
                  onChange={(e) => setP({ ...p, [f]: e.target.value === "" ? 0 : Number(e.target.value) })}
                />
              </Field>
            ))}
          </CardBody>
          {canEdit && (
            <div className="flex justify-end border-t border-slate-100 px-5 py-4">
              <SubmitButton>{ts("saveChanges")}</SubmitButton>
            </div>
          )}
        </Card>
      </ActionForm>

      <Card className="h-fit overflow-hidden">
        <div className="bg-ink-900 px-5 py-4 text-white">
          <div className="text-xs font-semibold uppercase tracking-wider text-lime-signal">{t("exampleTitle")}</div>
          <div className="mt-1 font-display text-3xl font-bold">{m(total)}</div>
          <div className="text-xs text-white/50">{t("exclVat")}</div>
        </div>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("exampleDistance", { unit })}>
              <Input type="number" min="0" value={distance} onChange={(e) => setDistance(Number(e.target.value) || 0)} />
            </Field>
            <Field label={t("examplePallets")}>
              <Input type="number" min="0" value={pallets} onChange={(e) => setPallets(Number(e.target.value) || 0)} />
            </Field>
          </div>
          <Checkbox label={t("exampleAdr")} checked={adr} onChange={(e) => setAdr(e.target.checked)} />
          <dl className="space-y-1.5 text-sm">
            {[
              [t("lineBase"), p.base_fee || 0],
              [t("lineDistance", { distance, unit }), linehaul],
              [t("linePallets", { pallets }), palletFee],
              ...(adr ? [[t("lineAdr"), p.adr_surcharge || 0] as [string, number]] : []),
              [t("lineFuel", { pct: p.fuel_surcharge_pct || 0 }), fuel],
            ].map(([label, v]) => (
              <div key={String(label)} className="flex justify-between text-slate-600">
                <dt>{label}</dt>
                <dd className="tabular-nums">{m(Number(v))}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
              <dt>{t("lineTotal")}</dt>
              <dd className="tabular-nums">{m(total)}</dd>
            </div>
          </dl>
          <p className="text-xs text-slate-500">{t("fuelNote")}</p>
        </CardBody>
      </Card>
    </div>
  );
}
