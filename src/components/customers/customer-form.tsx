"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BadgeCheck, Building2, Loader2, ShieldAlert, ShieldQuestion, User } from "lucide-react";
import { saveCustomer, checkVat } from "@/app/app/customers/actions";
import { Button, Card, CardBody, CardHeader, Field, Input, Select, Textarea, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/app/client";
import { COUNTRIES, isGCC } from "@/lib/countries";
import type { Customer } from "@/lib/types";
import type { VatCheckResult } from "@/lib/vat-check";
import { cn } from "@/lib/utils";

export function CustomerForm({ customer, defaultCountry, currency, unit }: { customer?: Customer; defaultCountry: string; currency: string; unit: string }) {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const [state, action] = React.useActionState(saveCustomer, undefined);
  const [kind, setKind] = React.useState<Customer["kind"]>(customer?.kind ?? "business");
  const [ctry, setCtry] = React.useState(customer?.country ?? defaultCountry);
  const [vat, setVat] = React.useState(customer?.vat_number ?? "");
  const [vatResult, setVatResult] = React.useState<VatCheckResult | null>(null);
  const [verified, setVerified] = React.useState(customer?.vat_verified ?? false);
  const [checking, startCheck] = React.useTransition();
  const nameRef = React.useRef<HTMLInputElement>(null);
  const addrRef = React.useRef<HTMLInputElement>(null);

  const onVerify = () =>
    startCheck(async () => {
      const res = await checkVat(vat, ctry);
      setVatResult(res);
      setVerified(res.verified);
      if (res.verified) {
        if (res.normalized) setVat(res.normalized);
        if (res.name && nameRef.current && !nameRef.current.value) nameRef.current.value = res.name;
        if (res.address && addrRef.current && !addrRef.current.value) addrRef.current.value = res.address.split(",")[0];
      }
    });

  return (
    <form action={action} className="space-y-6">
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="vat_verified" value={verified ? "1" : "0"} />
      {state?.error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : state.error}</p>
      )}

      <Card>
        <CardHeader title={t("form.company")} />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
            {(["business", "individual"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ring-1 transition",
                  kind === k ? "bg-brand-50 text-brand-700 ring-brand-300" : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300",
                )}
              >
                {k === "business" ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                {t(`kind.${k}`)}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tc("name")}>
              <Input ref={nameRef} name="name" required defaultValue={customer?.name} />
            </Field>
            <Field label={tc("country")}>
              <Select
                name="country"
                value={ctry}
                onChange={(e) => {
                  setCtry(e.target.value);
                  setVerified(false);
                  setVatResult(null);
                }}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {kind === "business" && (
            <Field
              label={t("form.vatNumber")}
              hint={t("form.vatHint")}
            >
              <div className="flex gap-2">
                <Input
                  name="vat_number"
                  value={vat}
                  onChange={(e) => {
                    setVat(e.target.value.toUpperCase());
                    setVerified(false);
                    setVatResult(null);
                  }}
                  placeholder={ctry === "GB" ? "GB123456789" : `${ctry === "GR" ? "EL" : ctry}123456789`}
                  className="font-mono"
                />
                <Button type="button" variant="secondary" onClick={onVerify} disabled={!vat || checking}>
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                  {t("form.verify")}
                </Button>
              </div>
              {vatResult && (
                <div
                  className={cn(
                    "mt-2 flex items-start gap-2 rounded-xl px-3 py-2 text-sm",
                    vatResult.verified ? "bg-emerald-50 text-emerald-800" : vatResult.offline ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700",
                  )}
                >
                  {vatResult.verified ? (
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : vatResult.offline ? (
                    <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div>
                    <div className="font-medium">
                      {vatResult.verified
                        ? t("vat.verified")
                        : !vatResult.formatValid
                          ? t("vat.badFormat")
                          : vatResult.offline
                            ? t("vat.offline")
                            : t("vat.notFound")}
                    </div>
                    {vatResult.name && <div className="text-xs opacity-80">{vatResult.name}</div>}
                    {vatResult.address && <div className="text-xs opacity-80">{vatResult.address}</div>}
                  </div>
                </div>
              )}
              {!vatResult && verified && (
                <div className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700">
                  <BadgeCheck className="h-3.5 w-3.5" /> {t("vat.verified")}
                </div>
              )}
            </Field>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("form.addressContact")} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.address1")} className="sm:col-span-2">
            <Input ref={addrRef} name="address_line1" defaultValue={customer?.address_line1 ?? ""} />
          </Field>
          <Field label={t("form.address2")} className="sm:col-span-2">
            <Input name="address_line2" defaultValue={customer?.address_line2 ?? ""} />
          </Field>
          <Field label={tc("city")}>
            <Input name="city" defaultValue={customer?.city ?? ""} />
          </Field>
          <Field label={tc("postcode")}>
            <Input name="postcode" defaultValue={customer?.postcode ?? ""} className="uppercase" />
          </Field>
          {isGCC(ctry) && (
            <>
              <Field label={t("form.nameAr")} className="sm:col-span-2">
                <Input name="name_ar" dir="rtl" lang="ar" defaultValue={customer?.name_ar ?? ""} />
              </Field>
              <Field label={t("form.buildingNumber")} hint={ctry === "SA" ? t("form.buildingHint") : undefined}>
                <Input name="building_number" inputMode="numeric" maxLength={8} defaultValue={customer?.building_number ?? ""} />
              </Field>
              <Field label={t("form.additionalNumber")}>
                <Input name="additional_number" inputMode="numeric" maxLength={8} defaultValue={customer?.additional_number ?? ""} />
              </Field>
              <Field label={t("form.district")} className="sm:col-span-2">
                <Input name="district" defaultValue={customer?.district ?? ""} />
              </Field>
              {kind === "business" && (
                <>
                  <Field label={t("form.idScheme")} hint={t("form.idHint")}>
                    <Select name="id_scheme" defaultValue={customer?.id_scheme ?? "CRN"}>
                      {["CRN", "MOM", "MLS", "700", "SAG", "OTH"].map((c) => (
                        <option key={c} value={c}>
                          {t(`form.idSchemes.${c}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("form.idValue")}>
                    <Input name="id_value" defaultValue={customer?.id_value ?? ""} />
                  </Field>
                </>
              )}
            </>
          )}
          <Field label={t("form.contactName")}>
            <Input name="contact_name" defaultValue={customer?.contact_name ?? ""} />
          </Field>
          <Field label={tc("email")} hint={t("form.emailHint")}>
            <Input name="email" type="email" defaultValue={customer?.email ?? ""} />
          </Field>
          <Field label={tc("phone")}>
            <Input name="phone" type="tel" defaultValue={customer?.phone ?? ""} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("form.commercial")} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.paymentTerms")} hint={t("form.paymentTermsHint")}>
            <Input name="payment_terms_days" type="number" min={0} max={180} defaultValue={customer?.payment_terms_days ?? ""} />
          </Field>
          <Field label={t("form.rate", { currency, unit })} hint={t("form.rateHint")}>
            <Input name="rate_per_distance" type="number" step="0.01" min={0} defaultValue={customer?.rate_per_distance ?? ""} />
          </Field>
          <Field label={tc("notes")} className="sm:col-span-2">
            <Textarea name="notes" defaultValue={customer?.notes ?? ""} />
          </Field>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href={customer ? `/app/customers/${customer.id}` : "/app/customers"} className={buttonClass("secondary")}>
          {tc("cancel")}
        </Link>
        <SubmitButton>{tc("save")}</SubmitButton>
      </div>
    </form>
  );
}
