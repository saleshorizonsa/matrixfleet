"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { saveVehicle } from "@/app/app/fleet/actions";
import { Card, CardBody, CardHeader, Field, Input, Select, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/app/client";
import type { Driver, Vehicle } from "@/lib/types";
import { Plate } from "./ui";

const KINDS: Vehicle["kind"][] = ["van", "luton", "rigid", "artic", "trailer", "car", "other"];
const STATUSES: Vehicle["status"][] = ["available", "in_use", "maintenance", "off_road"];

export function VehicleForm({
  vehicle,
  drivers,
  country,
}: {
  vehicle?: Vehicle;
  drivers: Pick<Driver, "id" | "full_name">[];
  country: string;
}) {
  const t = useTranslations("fleet");
  const tc = useTranslations("common");
  const [state, action] = React.useActionState(saveVehicle, undefined);
  const [reg, setReg] = React.useState(vehicle?.registration ?? "");

  return (
    <form action={action} className="space-y-6">
      {vehicle && <input type="hidden" name="id" value={vehicle.id} />}
      {state?.error === "planLimit" && (
        <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-700 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-lime-signal" />
            <div>
              <div className="font-semibold">{t("vehicles.limitTitle")}</div>
              <div className="text-sm text-white/75">{tc("planLimit")}</div>
            </div>
          </div>
          <Link href="/app/settings/billing" className={buttonClass("lime")}>
            {t("vehicles.upgrade")}
          </Link>
        </div>
      )}
      {state?.error && state.error !== "planLimit" && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : state.error}</p>
      )}

      <Card>
        <CardHeader title={t("vehicles.details")} action={reg ? <Plate reg={reg} country={country} /> : null} />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("vehicles.registration")}>
            <Input name="registration" required value={reg} onChange={(e) => setReg(e.target.value.toUpperCase())} placeholder="AB12 CDE" className="font-mono uppercase" />
          </Field>
          <Field label={t("vehicles.make")}>
            <Input name="make" defaultValue={vehicle?.make ?? ""} placeholder="Mercedes-Benz" />
          </Field>
          <Field label={t("vehicles.model")}>
            <Input name="model" defaultValue={vehicle?.model ?? ""} placeholder="Sprinter 316" />
          </Field>
          <Field label={t("vehicles.kind")}>
            <Select name="kind" defaultValue={vehicle?.kind ?? "van"}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`kinds.${k}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("vehicles.capacityKg")}>
            <Input name="capacity_kg" type="number" min={0} defaultValue={vehicle?.capacity_kg ?? ""} />
          </Field>
          <Field label={t("vehicles.pallets")}>
            <Input name="pallets" type="number" min={0} defaultValue={vehicle?.pallets ?? ""} />
          </Field>
          <Field label={t("vehicles.odometer")}>
            <Input name="odometer" type="number" min={0} defaultValue={vehicle?.odometer ?? ""} />
          </Field>
          <Field label={t("vehicles.status")}>
            <Select name="status" defaultValue={vehicle?.status ?? "available"}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`vehicleStatus.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("vehicles.defaultDriver")}>
            <Select name="default_driver_id" defaultValue={vehicle?.default_driver_id ?? ""}>
              <option value="">{tc("none")}</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("vehicles.documents")} description={t("vehicles.documentsHint")} />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(["mot_expiry", "insurance_expiry", "tax_expiry", "tacho_calibration_expiry", "next_service_date"] as const).map((k) => (
            <Field key={k} label={t(`docs.${k}`)}>
              <Input name={k} type="date" defaultValue={vehicle?.[k] ?? ""} />
            </Field>
          ))}
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href={vehicle ? `/app/fleet/vehicles/${vehicle.id}` : "/app/fleet/vehicles"} className={buttonClass("secondary")}>
          {tc("cancel")}
        </Link>
        <SubmitButton>{tc("save")}</SubmitButton>
      </div>
    </form>
  );
}
