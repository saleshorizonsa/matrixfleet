import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, BadgeCheck, Banknote, Mail, MapPin, Package, Pencil, Phone, Plus, Receipt, Trash2, User } from "lucide-react";
import { requireOffice, canManage } from "@/lib/auth";
import { Badge, Card, CardBody, CardHeader, LinkButton, PageHeader, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/app/client";
import { StatusBadge } from "@/components/app/status-badge";
import { Flag } from "@/components/customers/flag";
import { ReverifyVatButton } from "@/components/customers/reverify-vat";
import { deleteCustomer } from "../actions";
import { country as findCountry } from "@/lib/countries";
import { date, intlLocale, money } from "@/lib/format";
import type { Customer, Invoice, Job } from "@/lib/types";

const INV_TONE = { draft: "slate", sent: "sky", paid: "green", overdue: "red", void: "slate" } as const;

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOffice();
  const t = await getTranslations("customers");
  const tc = await getTranslations("common");
  const loc = intlLocale(await getLocale());

  const { data: customer } = await ctx.supabase.from("hl_customers").select("*").eq("id", id).eq("org_id", ctx.org.id).maybeSingle<Customer>();
  if (!customer) notFound();

  const [{ data: jobs }, { data: invoices }] = await Promise.all([
    ctx.supabase
      .from("hl_jobs")
      .select("id, reference, status, scheduled_date, pickup_city, delivery_city, price_net, currency")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    ctx.supabase
      .from("hl_invoices")
      .select("id, number, issue_date, due_date, status, total, currency")
      .eq("customer_id", id)
      .order("issue_date", { ascending: false })
      .limit(20),
  ]);
  type JobRow = Pick<Job, "id" | "reference" | "status" | "scheduled_date" | "pickup_city" | "delivery_city" | "price_net" | "currency">;
  const jobList = (jobs ?? []) as JobRow[];
  const invList = (invoices ?? []) as Pick<Invoice, "id" | "number" | "issue_date" | "due_date" | "status" | "total" | "currency">[];
  const revenue = jobList.filter((j) => j.status === "delivered" || j.status === "invoiced").reduce((s, j) => s + Number(j.price_net ?? 0), 0);
  const outstanding = invList.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + Number(i.total), 0);
  const active = jobList.filter((j) => ["booked", "assigned", "in_transit"].includes(j.status)).length;
  const terms = customer.payment_terms_days ?? ctx.org.payment_terms_days;

  return (
    <>
      <Link href="/app/customers" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> {t("title")}
      </Link>
      <PageHeader
        title={customer.name}
        description={
          <span className="flex items-center gap-2">
            <Flag code={customer.country} /> {findCountry(customer.country)?.name ?? customer.country} · {t(`kind.${customer.kind}`)}
          </span>
        }
        actions={
          <>
            {canManage(ctx.membership.role) && (
              <ConfirmButton action={deleteCustomer.bind(null, customer.id)} message={tc("confirmDelete")} variant="ghost" size="md">
                <Trash2 className="h-4 w-4" /> {tc("delete")}
              </ConfirmButton>
            )}
            <LinkButton href={`/app/customers/${customer.id}/edit`} variant="secondary">
              <Pencil className="h-4 w-4" /> {tc("edit")}
            </LinkButton>
            <LinkButton href={`/app/jobs/new?customer=${customer.id}`}>
              <Plus className="h-4 w-4" /> {t("newJob")}
            </LinkButton>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("stats.jobs")} value={jobList.length} icon={<Package className="h-5 w-5" />} />
        <Stat label={t("stats.active")} value={active} icon={<MapPin className="h-5 w-5" />} tone="sky" />
        <Stat label={t("stats.revenue")} value={money(revenue, ctx.org.currency, loc)} icon={<Banknote className="h-5 w-5" />} tone="green" />
        <Stat label={t("stats.outstanding")} value={money(outstanding, ctx.org.currency, loc)} icon={<Receipt className="h-5 w-5" />} tone={outstanding ? "amber" : "green"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader title={t("contact")} />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-700">
                <User className="h-4 w-4 text-slate-400" /> {customer.contact_name ?? "—"}
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="h-4 w-4 text-slate-400" />
                {customer.email ? <a className="hover:text-brand-600" href={`mailto:${customer.email}`}>{customer.email}</a> : "—"}
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="h-4 w-4 text-slate-400" />
                {customer.phone ? <a className="hover:text-brand-600" href={`tel:${customer.phone}`}>{customer.phone}</a> : "—"}
              </div>
              <div className="flex items-start gap-2 text-slate-700">
                <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                <span>
                  {[customer.address_line1, customer.address_line2, [customer.postcode, customer.city].filter(Boolean).join(" ")]
                    .filter(Boolean)
                    .map((l, i) => (
                      <span key={i} className="block">
                        {l}
                      </span>
                    ))}
                  {!customer.address_line1 && !customer.city && "—"}
                </span>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("billing")} />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">{t("form.vatNumber")}</span>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono">{customer.vat_number ?? "—"}</span>
                  {customer.vat_number &&
                    (customer.vat_verified ? <BadgeCheck className="h-4 w-4 text-emerald-500" /> : <Badge tone="amber">{t("vat.unverified")}</Badge>)}
                </span>
              </div>
              {customer.vat_verified_at && (
                <div className="text-right text-xs text-slate-400">{t("vat.checkedOn", { date: date(customer.vat_verified_at, loc) })}</div>
              )}
              {customer.vat_number && <ReverifyVatButton customerId={customer.id} />}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t("form.paymentTerms")}</span>
                <span>{t("days", { days: terms })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t("rateOverride")}</span>
                <span>
                  {customer.rate_per_distance ? `${money(customer.rate_per_distance, ctx.org.currency, loc)} / ${ctx.org.distance_unit}` : t("rateDefault")}
                </span>
              </div>
              {customer.notes && <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-slate-600">{customer.notes}</p>}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title={t("recentJobs")}
              action={
                <Link href={`/app/jobs?customer=${customer.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                  {t("viewAll")}
                </Link>
              }
            />
            {jobList.length === 0 ? (
              <CardBody className="text-sm text-slate-500">{t("noJobs")}</CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {jobList.slice(0, 12).map((j) => (
                  <li key={j.id}>
                    <Link href={`/app/jobs/${j.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="font-mono font-medium text-slate-900">{j.reference}</span>
                        <span className="ml-2 truncate text-slate-500">
                          {j.pickup_city ?? "?"} → {j.delivery_city ?? "?"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="hidden text-xs text-slate-400 sm:inline">{date(j.scheduled_date, loc)}</span>
                        <span className="w-24 text-right font-medium tabular-nums">{money(j.price_net, j.currency, loc)}</span>
                        <StatusBadge status={j.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title={t("invoices")} />
            {invList.length === 0 ? (
              <CardBody className="text-sm text-slate-500">{t("noInvoices")}</CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {invList.map((i) => (
                  <li key={i.id}>
                    <Link href={`/app/invoices/${i.id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50">
                      <span>
                        <span className="font-mono font-medium text-slate-900">{i.number}</span>
                        <span className="ml-2 text-xs text-slate-500">
                          {date(i.issue_date, loc)} · {t("due", { date: date(i.due_date, loc) })}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-medium tabular-nums">{money(i.total, i.currency, loc)}</span>
                        <Badge tone={INV_TONE[i.status]}>{t(`invoiceStatus.${i.status}`)}</Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
