"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOffice } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { computeTotals } from "@/lib/vat";
import { buyerSnapshot, sellerSnapshot } from "@/lib/invoices";
import type { Customer, Invoice, InvoiceLine, Role } from "@/lib/types";
import { actionError } from "@/lib/action-error";
import { getZatcaStatus, issueZatcaInvoice, retryPendingZatca, zatcaRequired, type IssueOutcome } from "@/lib/zatca";
import type { AppContext } from "@/lib/auth";

/** Saudi company connected to ZATCA → invoices are issued through clearance/reporting. */
async function zatcaActive(ctx: AppContext) {
  if (!zatcaRequired(ctx.org)) return false;
  return (await getZatcaStatus(ctx.org.id))?.status === "active";
}

const E_FINAL = ["pending", "cleared", "reported", "warning"];

const INVOICE_ROLES: Role[] = ["owner", "admin", "accountant", "dispatcher"];

export type InvoiceFormState = { error?: string } | undefined;

const lineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().min(0).max(1_000_000),
  unit_price: z.coerce.number().min(-10_000_000).max(10_000_000),
  job_id: z.string().uuid().nullable().optional(),
});

const formSchema = z.object({
  invoice_id: z.string().uuid().optional(),
  customer_id: z.string().uuid(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  supply_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().length(3),
  vat_treatment: z.enum(["standard", "reverse_charge", "zero_rated", "outside_scope", "exempt"]),
  vat_rate: z.coerce.number().min(0).max(100),
  vat_note: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  adjustment_reason: z.string().max(500).optional(),
  intent: z.enum(["draft", "issue"]),
  lines: z.array(lineSchema).min(1).max(200),
});

function val(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

export async function saveInvoice(_: InvoiceFormState, fd: FormData): Promise<InvoiceFormState> {
  const ctx = await requireOffice(INVOICE_ROLES);
  let linesRaw: unknown = [];
  try {
    linesRaw = JSON.parse(String(fd.get("lines") ?? "[]"));
  } catch {
    return { error: "invalidLines" };
  }
  const parsed = formSchema.safeParse({
    invoice_id: val(fd, "invoice_id"),
    customer_id: val(fd, "customer_id"),
    issue_date: val(fd, "issue_date"),
    supply_date: val(fd, "supply_date"),
    due_date: val(fd, "due_date"),
    currency: val(fd, "currency"),
    vat_treatment: val(fd, "vat_treatment"),
    vat_rate: val(fd, "vat_rate") ?? "0",
    vat_note: val(fd, "vat_note"),
    notes: val(fd, "notes"),
    adjustment_reason: val(fd, "adjustment_reason"),
    intent: val(fd, "intent") ?? "draft",
    lines: linesRaw,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.path[0] === "lines" ? "noLines" : first?.path[0] === "customer_id" ? "noCustomer" : "invalid" };
  }
  const f = parsed.data;
  if (f.due_date < f.issue_date) return { error: "dueBeforeIssue" };
  const sb = ctx.supabase;

  const { data: customer } = await sb.from("hl_customers").select("*").eq("id", f.customer_id).maybeSingle<Customer>();
  if (!customer) return { error: "noCustomer" };

  const viaZatca = await zatcaActive(ctx);
  if (viaZatca && f.currency.toUpperCase() !== "SAR") return { error: "zatcaCurrency" };
  if (viaZatca && f.lines.some((l) => l.unit_price < 0)) return { error: "zatcaNegative" };
  const vatRate = f.vat_treatment === "standard" ? f.vat_rate : 0;
  const totals = computeTotals(f.lines, vatRate, f.currency);
  const jobIds = [...new Set(f.lines.map((l) => l.job_id).filter((x): x is string => !!x))];

  const header = {
    customer_id: customer.id,
    issue_date: f.issue_date,
    supply_date: f.supply_date ?? null,
    due_date: f.due_date,
    currency: f.currency.toUpperCase(),
    subtotal: totals.subtotal,
    vat_rate: vatRate,
    vat_amount: totals.vat_amount,
    total: totals.total,
    vat_treatment: f.vat_treatment,
    vat_note: f.vat_note ?? null,
    notes: f.notes ?? null,
    adjustment_reason: f.adjustment_reason ?? null,
    seller_snapshot: sellerSnapshot(ctx.org),
    buyer_snapshot: buyerSnapshot(customer),
    // via ZATCA the invoice stays a draft until it has been cleared/reported
    ...(f.intent === "issue" && !viaZatca ? { status: "sent" as const, sent_at: new Date().toISOString() } : {}),
  };

  let invoiceId = f.invoice_id;
  if (invoiceId) {
    const { data: existing } = await sb
      .from("hl_invoices")
      .select("status,zatca_status")
      .eq("id", invoiceId)
      .maybeSingle<Pick<Invoice, "status" | "zatca_status">>();
    if (!existing) return { error: "notFound" };
    if (existing.status !== "draft") return { error: "immutable" };
    // signed and waiting for ZATCA: only "retry" may touch it
    if (existing.zatca_status === "failed" || (existing.zatca_status && E_FINAL.includes(existing.zatca_status))) return { error: "immutable" };
    const { error } = await sb.from("hl_invoices").update(header).eq("id", invoiceId);
    if (error) return actionError(error, "app/invoices");
    await sb.from("hl_invoice_lines").delete().eq("invoice_id", invoiceId);
    // release jobs no longer on this invoice
    let release = sb.from("hl_jobs").update({ invoice_id: null, status: "delivered" }).eq("invoice_id", invoiceId);
    if (jobIds.length) release = release.not("id", "in", `(${jobIds.join(",")})`);
    await release;
  } else {
    const { data: number, error: numErr } = await sb.rpc("hl_next_invoice_number", { p_org: ctx.org.id });
    if (numErr || !number) return actionError(numErr ?? new Error("no invoice number"), "app/invoices numbering");
    const { data: created, error } = await sb
      .from("hl_invoices")
      .insert({ ...header, org_id: ctx.org.id, number, created_by: ctx.user.id, status: header.status ?? "draft" })
      .select("id")
      .single<{ id: string }>();
    if (error || !created) return actionError(error ?? new Error("no row returned"), "app/invoices insert");
    invoiceId = created.id;
  }

  const { error: linesErr } = await sb.from("hl_invoice_lines").insert(
    f.lines.map((l, i) => ({
      org_id: ctx.org.id,
      invoice_id: invoiceId,
      job_id: l.job_id ?? null,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      amount: totals.amounts[i],
      position: i,
    })),
  );
  if (linesErr) return actionError(linesErr, "app/invoices");

  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) throw new Error("invalid invoice id");
  if (jobIds.length) {
    await sb
      .from("hl_jobs")
      .update({ invoice_id: invoiceId, status: "invoiced" })
      .in("id", jobIds)
      .or(`invoice_id.is.null,invoice_id.eq.${invoiceId}`);
  }

  await audit(ctx, f.invoice_id ? "invoice.updated" : "invoice.created", "invoice", invoiceId, {
    total: totals.total,
    currency: header.currency,
    issued: f.intent === "issue",
  });
  let query = "";
  if (f.intent === "issue" && viaZatca) {
    const r = await issueZatcaInvoice(ctx.org, invoiceId);
    await auditZatca(ctx, invoiceId, r);
    query = r.ok ? `?zatca=${r.status}` : `?zatca=${r.error}${r.fields?.length ? `&fields=${r.fields.join(",")}` : ""}`;
  }
  revalidatePath("/app/invoices");
  revalidatePath("/app/jobs");
  redirect(`/app/invoices/${invoiceId}${query}`);
}

async function loadInvoice(id: string) {
  const ctx = await requireOffice(INVOICE_ROLES);
  const { data: invoice } = await ctx.supabase.from("hl_invoices").select("*").eq("id", id).maybeSingle<Invoice>();
  if (!invoice) throw new Error("Invoice not found");
  return { ctx, invoice };
}

async function auditZatca(ctx: AppContext, id: string, r: IssueOutcome) {
  await audit(ctx, r.ok ? `invoice.zatca_${r.status}` : `invoice.zatca_${r.error}`, "invoice", id, { messages: r.messages.slice(0, 5) });
}

export type IssueResult = { ok: boolean; zatca?: string; messages?: string[]; fields?: string[] };

export async function markSent(id: string): Promise<IssueResult> {
  const { ctx, invoice } = await loadInvoice(id);
  if (invoice.status !== "draft") return { ok: true };
  if (await zatcaActive(ctx)) {
    const r = await issueZatcaInvoice(ctx.org, id);
    await auditZatca(ctx, id, r);
    revalidatePath(`/app/invoices/${id}`);
    revalidatePath("/app/invoices");
    return r.ok ? { ok: true, zatca: r.status, messages: r.messages } : { ok: false, zatca: r.error, messages: r.messages, fields: r.fields };
  }
  // refresh the snapshots at the moment of issue
  await ctx.supabase.from("hl_invoices").update({ status: "sent", sent_at: new Date().toISOString(), seller_snapshot: sellerSnapshot(ctx.org) }).eq("id", id);
  await audit(ctx, "invoice.issued", "invoice", id, { number: invoice.number });
  revalidatePath(`/app/invoices/${id}`);
  revalidatePath("/app/invoices");
  return { ok: true };
}

/** Submit again after ZATCA was unreachable (same signed document) or after fixing a rejection. */
export async function retryZatca(id: string): Promise<IssueResult> {
  const { ctx } = await loadInvoice(id);
  if (!(await zatcaActive(ctx))) return { ok: false, zatca: "not_onboarded" };
  const r = await issueZatcaInvoice(ctx.org, id);
  await auditZatca(ctx, id, r);
  await retryPendingZatca(ctx.org.id);
  revalidatePath(`/app/invoices/${id}`);
  revalidatePath("/app/invoices");
  return r.ok ? { ok: true, zatca: r.status, messages: r.messages } : { ok: false, zatca: r.error, messages: r.messages, fields: r.fields };
}

/** Credit note for an issued invoice: a new draft with the same lines, linked to the original. */
export async function createCreditNote(id: string, reason: string) {
  const { ctx, invoice } = await loadInvoice(id);
  if (invoice.doc_type !== "invoice" || invoice.status === "draft" || invoice.status === "void") throw new Error("not creditable");
  const { data: lines } = await ctx.supabase.from("hl_invoice_lines").select("*").eq("invoice_id", id).order("position").returns<InvoiceLine[]>();
  const { data: number, error: numErr } = await ctx.supabase.rpc("hl_next_invoice_number", { p_org: ctx.org.id });
  if (numErr || !number) throw new Error(numErr?.message ?? "numbering");
  const today = new Date().toISOString().slice(0, 10);
  const { data: created, error } = await ctx.supabase
    .from("hl_invoices")
    .insert({
      org_id: ctx.org.id,
      customer_id: invoice.customer_id,
      number,
      doc_type: "credit_note",
      original_invoice_id: invoice.id,
      adjustment_reason: reason.trim().slice(0, 500) || null,
      issue_date: today,
      supply_date: invoice.supply_date,
      due_date: today,
      currency: invoice.currency,
      status: "draft",
      subtotal: invoice.subtotal,
      vat_rate: invoice.vat_rate,
      vat_amount: invoice.vat_amount,
      total: invoice.total,
      vat_treatment: invoice.vat_treatment,
      vat_note: invoice.vat_note,
      seller_snapshot: sellerSnapshot(ctx.org),
      buyer_snapshot: invoice.buyer_snapshot,
      created_by: ctx.user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !created) throw new Error(error?.message ?? "insert");
  if (lines?.length) {
    await ctx.supabase.from("hl_invoice_lines").insert(
      lines.map((l) => ({
        org_id: ctx.org.id,
        invoice_id: created.id,
        job_id: null,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        amount: l.amount,
        position: l.position,
      })),
    );
  }
  await audit(ctx, "invoice.credit_note_created", "invoice", created.id, { for: invoice.number });
  revalidatePath("/app/invoices");
  redirect(`/app/invoices/${created.id}/edit`);
}

export async function markPaid(id: string, paidOn: string) {
  const { ctx, invoice } = await loadInvoice(id);
  if (invoice.status === "void") return;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(paidOn) ? paidOn : new Date().toISOString().slice(0, 10);
  await ctx.supabase
    .from("hl_invoices")
    .update({ status: "paid", paid_at: new Date(date + "T12:00:00Z").toISOString(), sent_at: invoice.sent_at ?? new Date().toISOString() })
    .eq("id", id);
  await audit(ctx, "invoice.paid", "invoice", id, { number: invoice.number, paid_on: date, total: invoice.total });
  revalidatePath(`/app/invoices/${id}`);
  revalidatePath("/app/invoices");
}

export async function markUnpaid(id: string) {
  const { ctx, invoice } = await loadInvoice(id);
  if (invoice.status !== "paid") return;
  await ctx.supabase.from("hl_invoices").update({ status: "sent", paid_at: null }).eq("id", id);
  await audit(ctx, "invoice.unpaid", "invoice", id, { number: invoice.number });
  revalidatePath(`/app/invoices/${id}`);
  revalidatePath("/app/invoices");
}

/** Void keeps the number (no gaps in the sequence) and frees the jobs for re-invoicing. */
export async function voidInvoice(id: string) {
  const { ctx, invoice } = await loadInvoice(id);
  if (invoice.status === "void") return;
  // a cleared/reported e-invoice cannot be voided — it must be cancelled with a credit note
  if (invoice.zatca_status && (E_FINAL.includes(invoice.zatca_status) || invoice.zatca_status === "failed")) {
    throw new Error("e-invoice: use a credit note");
  }
  // Saudi Arabia (ZATCA, phase 1 and 2): an issued tax invoice may only be cancelled with a credit note
  if (zatcaRequired(ctx.org) && invoice.status !== "draft") throw new Error("Saudi tax invoice: use a credit note");
  await ctx.supabase.from("hl_invoices").update({ status: "void" }).eq("id", id);
  await ctx.supabase.from("hl_jobs").update({ invoice_id: null, status: "delivered" }).eq("invoice_id", id);
  await audit(ctx, "invoice.voided", "invoice", id, { number: invoice.number });
  revalidatePath(`/app/invoices/${id}`);
  revalidatePath("/app/invoices");
  revalidatePath("/app/jobs");
}

/** Copy an invoice into a new draft (lines without job links). */
export async function duplicateInvoice(id: string) {
  const { ctx, invoice } = await loadInvoice(id);
  const { data: lines } = await ctx.supabase.from("hl_invoice_lines").select("*").eq("invoice_id", id).order("position").returns<InvoiceLine[]>();
  const { data: number, error: numErr } = await ctx.supabase.rpc("hl_next_invoice_number", { p_org: ctx.org.id });
  if (numErr || !number) throw new Error(numErr?.message ?? "numbering");
  const today = new Date().toISOString().slice(0, 10);
  const terms = Math.max(0, Math.round((new Date(invoice.due_date).getTime() - new Date(invoice.issue_date).getTime()) / 86_400_000));
  const due = new Date(Date.now() + terms * 86_400_000).toISOString().slice(0, 10);
  const { data: created, error } = await ctx.supabase
    .from("hl_invoices")
    .insert({
      org_id: ctx.org.id,
      customer_id: invoice.customer_id,
      number,
      issue_date: today,
      due_date: due,
      currency: invoice.currency,
      status: "draft",
      subtotal: invoice.subtotal,
      vat_rate: invoice.vat_rate,
      vat_amount: invoice.vat_amount,
      total: invoice.total,
      vat_treatment: invoice.vat_treatment,
      vat_note: invoice.vat_note,
      notes: invoice.notes,
      seller_snapshot: sellerSnapshot(ctx.org),
      buyer_snapshot: invoice.buyer_snapshot,
      created_by: ctx.user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !created) throw new Error(error?.message ?? "insert");
  if (lines?.length) {
    await ctx.supabase.from("hl_invoice_lines").insert(
      lines.map((l) => ({ org_id: ctx.org.id, invoice_id: created.id, job_id: null, description: l.description, quantity: l.quantity, unit_price: l.unit_price, amount: l.amount, position: l.position })),
    );
  }
  await audit(ctx, "invoice.duplicated", "invoice", created.id, { from: invoice.number });
  revalidatePath("/app/invoices");
  redirect(`/app/invoices/${created.id}/edit`);
}
