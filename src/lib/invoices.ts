// Invoice helpers shared by the invoices pages, server actions and the PDF route.
import type { Customer, Invoice, InvoiceStatus, Job, Organization } from "./types";
import { country } from "./countries";

export interface SellerSnapshot {
  name: string;
  legal_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  vat_number: string | null;
  company_number: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  locale: string;
  bank_name: string | null;
  bank_iban: string | null;
  bank_bic: string | null;
  bank_sort_code: string | null;
  bank_account: string | null;
  payment_terms_days: number;
}

export interface BuyerSnapshot {
  name: string;
  kind: "business" | "individual";
  contact_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  vat_number: string | null;
  vat_verified: boolean;
  email: string | null;
}

export function sellerSnapshot(org: Organization): SellerSnapshot {
  return {
    name: org.name,
    legal_name: org.legal_name,
    address_line1: org.address_line1,
    address_line2: org.address_line2,
    city: org.city,
    postcode: org.postcode,
    country: org.country,
    vat_number: org.vat_number,
    company_number: org.company_number,
    email: org.email,
    phone: org.phone,
    website: org.website,
    logo_url: org.logo_url,
    locale: org.locale,
    bank_name: org.bank_name,
    bank_iban: org.bank_iban,
    bank_bic: org.bank_bic,
    bank_sort_code: org.bank_sort_code,
    bank_account: org.bank_account,
    payment_terms_days: org.payment_terms_days,
  };
}

export function buyerSnapshot(c: Customer): BuyerSnapshot {
  return {
    name: c.name,
    kind: c.kind,
    contact_name: c.contact_name,
    address_line1: c.address_line1,
    address_line2: c.address_line2,
    city: c.city,
    postcode: c.postcode,
    country: c.country,
    vat_number: c.vat_number,
    vat_verified: c.vat_verified,
    email: c.email,
  };
}

/** Address block lines (without the name). */
export function addressLines(p: {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string | null;
}) {
  const cityLine = [p.postcode, p.city].filter(Boolean).join(" ");
  return [p.address_line1, p.address_line2, cityLine, country(p.country)?.name ?? p.country].filter(Boolean) as string[];
}

/** Effective status: a sent invoice past its due date is shown as overdue. */
export function effectiveStatus(inv: Pick<Invoice, "status" | "due_date">): InvoiceStatus {
  if (inv.status === "sent" && inv.due_date < new Date().toISOString().slice(0, 10)) return "overdue";
  return inv.status;
}

export function jobLineDescription(job: Pick<Job, "reference" | "pickup_city" | "pickup_country" | "delivery_city" | "delivery_country" | "customer_ref" | "scheduled_date" | "delivered_at" | "goods_description">) {
  const from = [job.pickup_city, job.pickup_country].filter(Boolean).join(", ");
  const to = [job.delivery_city, job.delivery_country].filter(Boolean).join(", ");
  const when = (job.delivered_at ?? job.scheduled_date ?? "").slice(0, 10);
  const parts = [`${job.reference}: ${from || "—"} → ${to || "—"}`];
  if (when) parts.push(when);
  if (job.customer_ref) parts.push(`PO ${job.customer_ref}`);
  return parts.join(" · ");
}

/** Rows paid within the last `days` days. */
export function paidWithin<T extends { paid_at: string | null }>(rows: T[], days: number) {
  const since = Date.now() - days * 86_400_000;
  return rows.filter((r) => r.paid_at && new Date(r.paid_at).getTime() >= since);
}

export function addDays(isoDate: string, days: number) {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const INVOICE_TABS = ["all", "draft", "sent", "overdue", "paid", "void"] as const;
export type InvoiceTab = (typeof INVOICE_TABS)[number];
