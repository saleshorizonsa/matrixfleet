"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { saveDriver } from "@/app/app/fleet/actions";
import { Avatar, Card, CardBody, CardHeader, Field, Input, Select, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/app/client";
import type { Driver } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLOURS = ["#5B5BF7", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6", "#14B8A6", "#F97316", "#0A1430"];

export function DriverForm({ driver }: { driver?: Driver }) {
  const t = useTranslations("fleet");
  const tc = useTranslations("common");
  const [state, action] = React.useActionState(saveDriver, undefined);
  const [name, setName] = React.useState(driver?.full_name ?? "");
  const [colour, setColour] = React.useState(driver?.colour ?? COLOURS[0]);

  return (
    <form action={action} className="space-y-6">
      {driver && <input type="hidden" name="id" value={driver.id} />}
      <input type="hidden" name="colour" value={colour} />
      {state?.error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : state.error}</p>
      )}
      <Card>
        <CardHeader title={t("drivers.details")} action={<Avatar name={name || "?"} colour={colour} size={40} />} />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("drivers.fullName")}>
            <Input name="full_name" required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={tc("email")} hint={t("drivers.emailHint")}>
            <Input name="email" type="email" defaultValue={driver?.email ?? ""} />
          </Field>
          <Field label={tc("phone")}>
            <Input name="phone" type="tel" defaultValue={driver?.phone ?? ""} />
          </Field>
          <Field label={t("drivers.status")}>
            <Select name="status" defaultValue={driver?.status ?? "active"}>
              {(["active", "off", "inactive"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`driverStatus.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">{t("drivers.colour")}</span>
            <div className="flex flex-wrap gap-2">
              {COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColour(c)}
                  aria-label={c}
                  className={cn("h-8 w-8 rounded-full ring-2 ring-offset-2 transition", colour === c ? "ring-slate-900" : "ring-transparent hover:ring-slate-300")}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("drivers.licences")} description={t("drivers.licencesHint")} />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("drivers.licenceNumber")}>
            <Input name="licence_number" defaultValue={driver?.licence_number ?? ""} className="font-mono" />
          </Field>
          <Field label={t("drivers.licenceCategories")} hint="B, C1, C, C+E">
            <Input name="licence_categories" defaultValue={driver?.licence_categories ?? ""} />
          </Field>
          {(["licence_expiry", "cpc_expiry", "tacho_card_expiry"] as const).map((k) => (
            <Field key={k} label={t(`docs.${k}`)}>
              <Input name={k} type="date" defaultValue={driver?.[k] ?? ""} />
            </Field>
          ))}
        </CardBody>
      </Card>
      <div className="flex justify-end gap-2">
        <Link href={driver ? `/app/fleet/drivers/${driver.id}` : "/app/fleet/drivers"} className={buttonClass("secondary")}>
          {tc("cancel")}
        </Link>
        <SubmitButton>{tc("save")}</SubmitButton>
      </div>
    </form>
  );
}
