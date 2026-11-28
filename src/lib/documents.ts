import "server-only";
// One place that renders the business documents (invoice / credit note, CMR) as PDF, so the
// download routes, the email sender and the shared WhatsApp link all produce the same file.
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildInvoicePdf } from "@/lib/pdf/invoice";
import { buildCmrPdf } from "@/lib/pdf/cmr";
import { buyerSnapshot, sellerSnapshot, type BuyerSnapshot, type SellerSnapshot } from "@/lib/invoices";
import type { Customer, Invoice, InvoiceLine, Job, Organization } from "@/lib/types";

export type DocKind = "invoice" | "cmr";

export interface RenderedDocument {
  bytes: Uint8Array;
  filename: string;
  /** "Invoice INV-2026-0001", "Credit note …", "CMR JOB-000123" */
  title: string;
  number: string;
  kind: DocKind;
  docType?: Invoice["doc_type"];
  status?: string;
  total?: number;
  currency?: string;
  dueDate?: string;
  recipient: { name: string | null; email: string | null; phone: string | null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, any, any>;

/**
 * Render a document. `sb` decides what may be read: the signed-in user's client (RLS) for the app,
 * or the service client for a verified share link. `org` must be the document's own company.
 */
export async function renderDocument(sb: Sb, org: Organization, kind: DocKind, id: string): Promise<RenderedDocument | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return kind === "invoice" ? renderInvoice(sb, org, id) : renderCmr(sb, org, id);
}

async function renderInvoice(sb: Sb, org: Organization, id: string): Promise<RenderedDocument | null> {
  const { data: invoice } = await sb.from("hl_invoices").select("*").eq("id", id).eq("org_id", org.id).maybeSingle<Invoice>();
  if (!invoice) return null;
  const [{ data: lines }, { data: customer }, { data: original }] = await Promise.all([
    sb.from("hl_invoice_lines").select("*").eq("invoice_id", id).order("position").returns<InvoiceLine[]>(),
    invoice.customer_id ? sb.from("hl_customers").select("*").eq("id", invoice.customer_id).maybeSingle<Customer>() : Promise.resolve({ data: null }),
    invoice.original_invoice_id
      ? sb.from("hl_invoices").select("number").eq("id", invoice.original_invoice_id).maybeSingle<{ number: string }>()
      : Promise.resolve({ data: null }),
  ]);
  // issued invoices are rendered from their snapshots so they never change
  let seller = invoice.seller_snapshot as unknown as SellerSnapshot;
  let buyer = invoice.buyer_snapshot as unknown as BuyerSnapshot;
  if (!seller?.name) seller = sellerSnapshot(org);
  if (!buyer?.name) buyer = customer ? buyerSnapshot(customer as Customer) : ({ name: "—", kind: "business", country: org.country } as BuyerSnapshot);

  const bytes = await buildInvoicePdf({ invoice, lines: lines ?? [], seller, buyer, originalNumber: (original as { number: string } | null)?.number ?? null });
  const credit = invoice.doc_type === "credit_note";
  const c = customer as Customer | null;
  return {
    bytes,
    filename: `${invoice.number}.pdf`,
    title: `${credit ? "Credit note" : "Invoice"} ${invoice.number}`,
    number: invoice.number,
    kind: "invoice",
    docType: invoice.doc_type,
    status: invoice.status,
    total: Number(invoice.total),
    currency: invoice.currency,
    dueDate: invoice.due_date,
    recipient: { name: buyer.name ?? c?.name ?? null, email: buyer.email ?? c?.email ?? null, phone: c?.phone ?? null },
  };
}

async function renderCmr(sb: Sb, org: Organization, jobId: string): Promise<RenderedDocument | null> {
  const { data: job } = await sb.from("hl_jobs").select("*").eq("id", jobId).eq("org_id", org.id).maybeSingle<Job>();
  if (!job) return null;
  const [customerRes, driverRes, vehicleRes, signature, logo] = await Promise.all([
    job.customer_id ? sb.from("hl_customers").select("*").eq("id", job.customer_id).maybeSingle<Customer>() : Promise.resolve({ data: null }),
    job.driver_id ? sb.from("hl_drivers").select("full_name").eq("id", job.driver_id).maybeSingle<{ full_name: string }>() : Promise.resolve({ data: null }),
    job.vehicle_id ? sb.from("hl_vehicles").select("registration").eq("id", job.vehicle_id).maybeSingle<{ registration: string }>() : Promise.resolve({ data: null }),
    job.pod_signature_path ? downloadBytes(sb, job.pod_signature_path) : Promise.resolve(null),
    org.logo_url ? fetchBytes(org.logo_url) : Promise.resolve(null),
  ]);
  const customer = (customerRes.data as Customer | null) ?? null;
  const bytes = await buildCmrPdf({
    job,
    org,
    customer,
    driverName: (driverRes.data as { full_name: string } | null)?.full_name ?? null,
    vehicleRegistration: (vehicleRes.data as { registration: string } | null)?.registration ?? null,
    signatureBytes: signature,
    logoBytes: logo,
  });
  return {
    bytes,
    filename: `CMR-${job.reference}.pdf`,
    title: `CMR ${job.reference}`,
    number: job.reference,
    kind: "cmr",
    status: job.status,
    recipient: { name: customer?.name ?? null, email: customer?.email ?? null, phone: customer?.phone ?? null },
  };
}

async function downloadBytes(sb: Sb, path: string) {
  try {
    const { data } = await sb.storage.from("hl-pod").download(path);
    return data ? new Uint8Array(await data.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

async function fetchBytes(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
