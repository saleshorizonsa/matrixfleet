import { getTranslations } from "next-intl/server";
import { requireOffice, ADMIN_ROLES } from "@/lib/auth";
import { Card, CardBody, CardHeader, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/app/client";
import { ActionForm } from "@/components/settings/action-form";
import { LogoUploader } from "@/components/settings/logo-uploader";
import { updateCompany } from "./actions";
import { COUNTRIES, CURRENCIES } from "@/lib/countries";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";

export const metadata = { title: "Company settings" };

export default async function CompanySettingsPage() {
  const ctx = await requireOffice();
  const t = await getTranslations("settings.company");
  const ts = await getTranslations("settings");
  const org = ctx.org;
  const canEdit = ADMIN_ROLES.includes(ctx.membership.role);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <ActionForm action={updateCompany} className="space-y-6">
        <fieldset disabled={!canEdit} className="space-y-6">
          <Card>
            <CardHeader title={t("identity")} description={t("identityHint")} />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label={t("name")}>
                <Input name="name" defaultValue={org.name} required />
              </Field>
              <Field label={t("legalName")}>
                <Input name="legal_name" defaultValue={org.legal_name ?? ""} />
              </Field>
              <Field label={t("vatNumber")} hint={t("vatHint")}>
                <Input name="vat_number" defaultValue={org.vat_number ?? ""} placeholder="GB123456789" />
              </Field>
              <Field label={t("companyNumber")}>
                <Input name="company_number" defaultValue={org.company_number ?? ""} />
              </Field>
              <Field label={t("address1")} className="sm:col-span-2">
                <Input name="address_line1" defaultValue={org.address_line1 ?? ""} />
              </Field>
              <Field label={t("address2")} className="sm:col-span-2">
                <Input name="address_line2" defaultValue={org.address_line2 ?? ""} />
              </Field>
              <Field label={t("city")}>
                <Input name="city" defaultValue={org.city ?? ""} />
              </Field>
              <Field label={t("postcode")}>
                <Input name="postcode" defaultValue={org.postcode ?? ""} />
              </Field>
              <Field label={t("email")}>
                <Input name="email" type="email" defaultValue={org.email ?? ""} />
              </Field>
              <Field label={t("phone")}>
                <Input name="phone" type="tel" defaultValue={org.phone ?? ""} />
              </Field>
              <Field label={t("website")} className="sm:col-span-2">
                <Input name="website" type="url" defaultValue={org.website ?? ""} placeholder="https://" />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("regional")} description={t("regionalHint")} />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label={t("country")}>
                <Select name="country" defaultValue={org.country}>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("currency")}>
                <Select name="currency" defaultValue={org.currency}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t("distanceUnit")}>
                <Select name="distance_unit" defaultValue={org.distance_unit}>
                  <option value="mi">{t("miles")}</option>
                  <option value="km">{t("kilometres")}</option>
                </Select>
              </Field>
              <Field label={t("documentLanguage")} hint={t("documentLanguageHint")}>
                <Select name="locale" defaultValue={org.locale}>
                  {LOCALES.map((l) => (
                    <option key={l} value={l}>
                      {LOCALE_LABELS[l]}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("invoicing")} description={t("invoicingHint")} />
            <CardBody className="grid gap-4 sm:grid-cols-3">
              <Field label={t("defaultVat")}>
                <Input name="default_vat_rate" type="number" step="0.01" min="0" max="50" defaultValue={org.default_vat_rate} />
              </Field>
              <Field label={t("invoicePrefix")} hint={t("invoicePrefixHint", { example: `${org.invoice_prefix}-${new Date().getFullYear()}-0001` })}>
                <Input name="invoice_prefix" defaultValue={org.invoice_prefix} maxLength={12} />
              </Field>
              <Field label={t("paymentTerms")}>
                <Input name="payment_terms_days" type="number" min="0" max="180" defaultValue={org.payment_terms_days} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("bank")} description={t("bankHint")} />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label={t("bankName")} className="sm:col-span-2">
                <Input name="bank_name" defaultValue={org.bank_name ?? ""} />
              </Field>
              <Field label="IBAN">
                <Input name="bank_iban" defaultValue={org.bank_iban ?? ""} placeholder="GB29 NWBK 6016 1331 9268 19" />
              </Field>
              <Field label="BIC / SWIFT">
                <Input name="bank_bic" defaultValue={org.bank_bic ?? ""} />
              </Field>
              <Field label={t("sortCode")} hint={t("ukOnly")}>
                <Input name="bank_sort_code" defaultValue={org.bank_sort_code ?? ""} placeholder="60-16-13" />
              </Field>
              <Field label={t("accountNumber")} hint={t("ukOnly")}>
                <Input name="bank_account" defaultValue={org.bank_account ?? ""} />
              </Field>
            </CardBody>
          </Card>
        </fieldset>
        {canEdit ? (
          <div className="flex justify-end">
            <SubmitButton size="lg">{ts("saveChanges")}</SubmitButton>
          </div>
        ) : (
          <p className="text-sm text-slate-500">{ts("adminOnly")}</p>
        )}
      </ActionForm>

      <div className="space-y-6">
        <LogoUploader logoUrl={org.logo_url} canEdit={canEdit} />
      </div>
    </div>
  );
}
