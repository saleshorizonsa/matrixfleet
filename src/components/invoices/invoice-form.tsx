"use client";
import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, BadgeCheck, Info, Plus, RotateCcw, ShieldAlert, Sparkles, Trash2, Truck } from "lucide-react";
import { saveInvoice } from "@/app/app/invoices/actions";
import { Badge, Card, CardBody, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/app/client";
import { VAT_TREATMENTS, computeTotals, suggestVatTreatment } from "@/lib/vat";
import { addDays, jobLineDescription } from "@/lib/invoices";
import { CURRENCIES, country } from "@/lib/countries";
import { date, intlLocale, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Customer, Job, VatTreatment } from "@/lib/types";

export type InvoiceFormCustomer = Pick<
  Customer,
  "id" | "name" | "country" | "kind" | "vat_number" | "vat_verified" | "payment_terms_days" | "city"
>;
export type InvoiceFormJob = Pick<
  Job,
  | "id" | "customer_id" | "reference" | "pickup_city" | "pickup_country" | "delivery_city" | "delivery_country"
  | "price_net" | "currency" | "delivered_at" | "scheduled_date" | "customer_ref" | "goods_description"
>;

export interface InvoiceFormInitial {
  invoice_id: string;
  number: string;
  customer_id: string | null;
  issue_date: string;
  supply_date: string | null;
  due_date: string;
  currency: string;
  vat_treatment: VatTreatment;
  vat_rate: number;
  vat_note: string | null;
  notes: string | null;
  lines: { description: string; quantity: number; unit_price: number; job_id: string | null }[];
}

interface Line {
  key: string;
  description: string;
  quantity: string;
  unit_price: string;
  job_id: string | null;
}

let seq = 0;
const newKey = () => `l${++seq}`;
const today = () => new Date().toISOString().slice(0, 10);

export function InvoiceForm({
  customers,
  jobs,
  org,
  initial,
  preselectCustomer,
  preselectJob,
}: {
  customers: InvoiceFormCustomer[];
  jobs: InvoiceFormJob[];
  org: { country: string; default_vat_rate: number; currency: string; payment_terms_days: number; locale: string };
  initial?: InvoiceFormInitial;
  preselectCustomer?: string;
  preselectJob?: string;
}) {
  const t = useTranslations("invoices");
  const tc = useTranslations("common");
  const loc = intlLocale(useLocale());
  const [state, action] = React.useActionState(saveInvoice, undefined);

  const initialJob = preselectJob ? jobs.find((j) => j.id === preselectJob) : undefined;
  const [customerId, setCustomerId] = React.useState<string>(
    initial?.customer_id ?? initialJob?.customer_id ?? preselectCustomer ?? "",
  );
  const customer = customers.find((c) => c.id === customerId);

  const toLine = (j: InvoiceFormJob): Line => ({
    key: newKey(),
    description: jobLineDescription(j),
    quantity: "1",
    unit_price: String(j.price_net ?? 0),
    job_id: j.id,
  });

  const [lines, setLines] = React.useState<Line[]>(() => {
    if (initial) return initial.lines.map((l) => ({ key: newKey(), description: l.description, quantity: String(l.quantity), unit_price: String(l.unit_price), job_id: l.job_id }));
    if (initialJob) return [toLine(initialJob)];
    return [];
  });

  const terms = customer?.payment_terms_days ?? org.payment_terms_days;
  const [issueDate, setIssueDate] = React.useState(initial?.issue_date ?? today());
  // due date follows issue date + payment terms until the user edits it
  const [dueOverride, setDueOverride] = React.useState<string | null>(initial?.due_date ?? null);
  const dueDate = dueOverride ?? (issueDate ? addDays(issueDate, terms) : "");
  // supply date follows the latest delivery among the selected jobs until edited
  const [supplyOverride, setSupplyOverride] = React.useState<string | null>(initial ? initial.supply_date ?? "" : null);
  const [currency, setCurrency] = React.useState(initial?.currency ?? initialJob?.currency ?? org.currency);
  const [notes, setNotes] = React.useState(initial?.notes ?? "");

  const customerJobs = React.useMemo(() => jobs.filter((j) => j.customer_id === customerId), [jobs, customerId]);
  const selectedJobIds = new Set(lines.map((l) => l.job_id).filter(Boolean) as string[]);
  const selectedJobs = jobs.filter((j) => selectedJobIds.has(j.id));
  const latestDelivery = selectedJobs
    .map((j) => (j.delivered_at ?? j.scheduled_date ?? "").slice(0, 10))
    .filter(Boolean)
    .sort()
    .pop();
  const supplyDate = supplyOverride ?? latestDelivery ?? "";

  // ---- VAT suggestion
  const routeJob = selectedJobs.find((j) => j.pickup_country !== org.country || j.delivery_country !== org.country) ?? selectedJobs[0];
  const suggestion = customer
    ? suggestVatTreatment({
        sellerCountry: org.country,
        sellerVatRate: org.default_vat_rate,
        buyerCountry: customer.country,
        buyerKind: customer.kind,
        buyerVatNumber: customer.vat_number,
        buyerVatVerified: customer.vat_verified,
        pickupCountry: routeJob?.pickup_country,
        deliveryCountry: routeJob?.delivery_country,
        locale: org.locale,
      })
    : null;
  const [override, setOverride] = React.useState<{ treatment: VatTreatment; rate: string; note: string } | null>(
    initial ? { treatment: initial.vat_treatment, rate: String(initial.vat_rate), note: initial.vat_note ?? "" } : null,
  );
  const treatment: VatTreatment = override?.treatment ?? suggestion?.treatment ?? "standard";
  const rateStr = override?.rate ?? String(suggestion?.rate ?? org.default_vat_rate);
  const note = override?.note ?? suggestion?.legalNote ?? "";
  const vatRate = treatment === "standard" ? Number(rateStr) || 0 : 0;
  const isOverridden =
    !!override && !!suggestion && (override.treatment !== suggestion.treatment || Number(override.rate) !== suggestion.rate || override.note !== (suggestion.legalNote ?? ""));
  const edit = (patch: Partial<{ treatment: VatTreatment; rate: string; note: string }>) =>
    setOverride({ treatment, rate: rateStr, note, ...patch });

  const parsed = lines.map((l) => ({ quantity: Number(l.quantity.replace(",", ".")) || 0, unit_price: Number(l.unit_price.replace(",", ".")) || 0 }));
  const totals = computeTotals(parsed, vatRate);
  const payload = JSON.stringify(
    lines
      .filter((l) => l.description.trim())
      .map((l, i) => ({ description: l.description.trim(), quantity: parsed[i].quantity, unit_price: parsed[i].unit_price, job_id: l.job_id })),
  );

  const toggleJob = (j: InvoiceFormJob) => {
    if (selectedJobIds.has(j.id)) setLines((ls) => ls.filter((l) => l.job_id !== j.id));
    else {
      setLines((ls) => [...ls, toLine(j)]);
      if (selectedJobIds.size === 0 && !initial) setCurrency(j.currency);
    }
  };
  const allSelected = customerJobs.length > 0 && customerJobs.every((j) => selectedJobIds.has(j.id));
  const toggleAll = () => {
    if (allSelected) setLines((ls) => ls.filter((l) => !customerJobs.some((j) => j.id === l.job_id)));
    else setLines((ls) => [...ls, ...customerJobs.filter((j) => !selectedJobIds.has(j.id)).map(toLine)]);
  };
  const updateLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const mixedCurrency = selectedJobs.some((j) => j.currency !== currency);
  const fmt = (n: number) => money(n, currency, loc);

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <input type="hidden" name="lines" value={payload} />
      {initial && <input type="hidden" name="invoice_id" value={initial.invoice_id} />}
      <input type="hidden" name="vat_treatment" value={treatment} />
      <input type="hidden" name="vat_rate" value={vatRate} />
      <input type="hidden" name="vat_note" value={note} />

      <div className="space-y-6">
        {/* customer */}
        <Card>
          <CardHeader title={t("form.customer")} />
          <CardBody>
            {customers.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("form.noCustomers")}{" "}
                <Link href="/app/customers" className="font-semibold text-brand-600 underline">
                  {t("form.customer")} →
                </Link>
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label={t("form.customer")}>
                  <Select
                    name="customer_id"
                    value={customerId}
                    required
                    disabled={!!initial && lines.some((l) => l.job_id)}
                    onChange={(e) => {
                      setCustomerId(e.target.value);
                      setLines((ls) => ls.filter((l) => !l.job_id));
                      setOverride(null);
                    }}
                  >
                    <option value="">{t("form.selectCustomer")}</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.city ? `· ${c.city}` : ""} ({c.country})
                      </option>
                    ))}
                  </Select>
                </Field>
                {initial && lines.some((l) => l.job_id) && <input type="hidden" name="customer_id" value={customerId} />}
                {customer && (
                  <div className="flex flex-wrap items-center gap-2 pb-2">
                    <Badge tone="slate">{country(customer.country)?.name ?? customer.country}</Badge>
                    {customer.vat_number ? (
                      customer.vat_verified ? (
                        <Badge tone="green">
                          <BadgeCheck className="h-3.5 w-3.5" /> {customer.vat_number}
                        </Badge>
                      ) : (
                        <Badge tone="amber" title={t("form.vatUnverified")}>
                          <ShieldAlert className="h-3.5 w-3.5" /> {customer.vat_number}
                        </Badge>
                      )
                    ) : (
                      <Badge tone="slate">{t("form.noVatNumber")}</Badge>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* jobs */}
        {customer && (
          <Card className="animate-fade-up">
            <CardHeader
              title={t("form.uninvoicedJobs")}
              action={
                customerJobs.length > 0 && (
                  <button type="button" onClick={toggleAll} className="text-sm font-medium text-brand-600 hover:underline">
                    {t("form.selectAll")}
                  </button>
                )
              }
            />
            {customerJobs.length === 0 ? (
              <CardBody className="flex items-center gap-3 text-sm text-slate-500">
                <Truck className="h-5 w-5 text-slate-300" /> {t("form.noUninvoicedJobs")}
              </CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {customerJobs.map((j) => {
                  const on = selectedJobIds.has(j.id);
                  return (
                    <li key={j.id}>
                      <label className={cn("flex cursor-pointer items-center gap-4 px-5 py-3 transition", on ? "bg-brand-50/60" : "hover:bg-slate-50")}>
                        <input type="checkbox" checked={on} onChange={() => toggleJob(j)} className="h-4 w-4 accent-brand-500" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-mono font-semibold text-slate-900">{j.reference}</span>
                            {j.customer_ref && <span className="text-xs text-slate-400">PO {j.customer_ref}</span>}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-slate-600">
                            {j.pickup_city ?? "—"} <span className="text-xs text-slate-400">{j.pickup_country}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                            {j.delivery_city ?? "—"} <span className="text-xs text-slate-400">{j.delivery_country}</span>
                            <span className="ml-2 text-xs text-slate-400">{date(j.delivered_at ?? j.scheduled_date, loc)}</span>
                          </div>
                        </div>
                        <div className="text-right text-sm font-semibold tabular-nums text-slate-900">{money(j.price_net ?? 0, j.currency, loc)}</div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}

        {/* lines */}
        <Card>
          <CardHeader
            title={t("form.lines")}
            action={
              <button
                type="button"
                onClick={() => setLines((ls) => [...ls, { key: newKey(), description: "", quantity: "1", unit_price: "0", job_id: null }])}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
              >
                <Plus className="h-4 w-4" /> {t("form.addLine")}
              </button>
            }
          />
          <CardBody className="space-y-3">
            {lines.length === 0 && <p className="text-sm text-slate-400">{t("errors.noLines")}</p>}
            {lines.map((l, i) => (
              <div key={l.key} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-slate-50/70 p-3 ring-1 ring-slate-100 sm:grid-cols-[1fr_80px_120px_110px_auto] sm:items-center">
                <div className="col-span-2 sm:col-span-1">
                  {l.job_id && <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-600">{t("form.fromJob")}</div>}
                  <Input aria-label={t("form.description")} placeholder={t("form.description")} value={l.description} onChange={(e) => updateLine(l.key, { description: e.target.value })} />
                </div>
                <Input aria-label={t("form.qty")} inputMode="decimal" value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: e.target.value })} className="text-right" />
                <Input aria-label={t("form.unitPrice")} inputMode="decimal" value={l.unit_price} onChange={(e) => updateLine(l.key, { unit_price: e.target.value })} className="text-right" />
                <div className="text-right text-sm font-semibold tabular-nums text-slate-900">{fmt(totals.amounts[i] ?? 0)}</div>
                <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="justify-self-end rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={t("form.removeLine")}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {mixedCurrency && (
              <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4" /> {selectedJobs.map((j) => j.currency).filter((c, i, a) => a.indexOf(c) === i).join(" / ")} ≠ {currency}
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Field label={t("form.notes")}>
              <Textarea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("form.notesPlaceholder")} />
            </Field>
          </CardBody>
        </Card>
      </div>

      {/* sidebar */}
      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <Card>
          <CardHeader title={t("form.dates")} />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("form.issueDate")}>
                <Input type="date" name="issue_date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
              </Field>
              <Field label={t("form.dueDate")}>
                <Input
                  type="date"
                  name="due_date"
                  value={dueDate}
                  min={issueDate}
                  onChange={(e) => setDueOverride(e.target.value)}
                  required
                />
              </Field>
              <Field label={t("form.supplyDate")}>
                <Input
                  type="date"
                  name="supply_date"
                  value={supplyDate}
                  onChange={(e) => setSupplyOverride(e.target.value)}
                />
              </Field>
              <Field label={t("form.currency")}>
                <Select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t("form.vat")}
            action={
              suggestion && (
                <Badge tone="brand">
                  <Sparkles className="h-3.5 w-3.5" /> {t("form.suggested")}
                </Badge>
              )
            }
          />
          <CardBody className="space-y-4">
            {suggestion && (
              <div className="flex gap-2.5 rounded-xl bg-brand-50/70 p-3 text-sm text-brand-800 ring-1 ring-brand-100">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t(`rules.${suggestion.rule}`)}</span>
              </div>
            )}
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Field label={t("form.vatTreatment")}>
                <Select value={treatment} onChange={(e) => edit({ treatment: e.target.value as VatTreatment })}>
                  {VAT_TREATMENTS.map((v) => (
                    <option key={v} value={v}>
                      {t(`treatments.${v}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("form.vatRate")}>
                <Input inputMode="decimal" value={treatment === "standard" ? rateStr : "0"} disabled={treatment !== "standard"} onChange={(e) => edit({ rate: e.target.value })} className="text-right" />
              </Field>
            </div>
            <Field label={t("form.vatNote")}>
              <Textarea value={note} onChange={(e) => edit({ note: e.target.value })} className="min-h-[72px] text-xs" />
            </Field>
            {isOverridden && (
              <div className="flex items-center justify-between gap-2 text-xs text-amber-700">
                <span>{t("form.overridden")}</span>
                <button type="button" onClick={() => setOverride(null)} className="inline-flex items-center gap-1 font-semibold hover:underline">
                  <RotateCcw className="h-3.5 w-3.5" /> {t("form.resetSuggestion")}
                </button>
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-slate-400">{t("form.guidance")}</p>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <div className="space-y-2 p-5 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>{t("form.subtotal")}</span>
              <span className="tabular-nums text-slate-900">{fmt(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>
                {t("form.vat")} {vatRate}%
              </span>
              <span className="tabular-nums text-slate-900">{fmt(totals.vat_amount)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between bg-ink-900 px-5 py-4 text-white">
            <span className="font-medium">{t("form.total")}</span>
            <span className="font-display text-2xl font-bold tabular-nums text-lime-signal">{fmt(totals.total)}</span>
          </div>
          <div className="space-y-2 p-4">
            {state?.error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : state.error}</p>
            )}
            <SubmitButton name="intent" value="issue" className="w-full" size="lg" disabled={!customerId || lines.length === 0}>
              {t("form.issue")}
            </SubmitButton>
            <SubmitButton name="intent" value="draft" variant="secondary" className="w-full" disabled={!customerId || lines.length === 0}>
              {t("form.saveDraft")}
            </SubmitButton>
            <Link href={initial ? `/app/invoices/${initial.invoice_id}` : "/app/invoices"} className="block pt-1 text-center text-sm text-slate-500 hover:text-slate-800">
              {tc("cancel")}
            </Link>
          </div>
        </Card>
      </div>
    </form>
  );
}
