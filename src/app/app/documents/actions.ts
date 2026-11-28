"use server";
import { z } from "zod";
import { requireOffice } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { renderDocument, type DocKind } from "@/lib/documents";
import { createDocumentLink } from "@/lib/doc-links";
import { mailConfigured, sendDocumentMail } from "@/lib/mailer";
import { rateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/safe-log";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["owner", "admin", "accountant", "dispatcher"];
const KINDS: DocKind[] = ["invoice", "cmr"];
const NOT_SHAREABLE = ["draft", "void", "quote", "cancelled"];

const emailList = z
  .string()
  .max(1000)
  .transform((s) => s.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))
  .pipe(z.array(z.string().email().max(254)).max(5));

const mailSchema = z.object({
  kind: z.enum(["invoice", "cmr"]),
  id: z.string().uuid(),
  to: emailList.pipe(z.array(z.string()).min(1)),
  cc: emailList.optional(),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().max(5000),
  copyMe: z.boolean().optional(),
});

export type DocActionResult = { ok: true; url?: string; expiresAt?: string } | { ok: false; error: string };

/** Email a document as a PDF attachment, from the company (via the MatrixFleet mailbox). */
export async function emailDocument(input: z.input<typeof mailSchema>): Promise<DocActionResult> {
  const ctx = await requireOffice(ROLES);
  const parsed = mailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.path[0] === "to" ? "invalidTo" : "invalid" };
  const f = parsed.data;
  if (!mailConfigured()) return { ok: false, error: "mailNotConfigured" };

  const limited = await rateLimit([
    { scope: "doc-mail-org", value: ctx.org.id, max: 60, windowSec: 3600 },
    { scope: "doc-mail-user", value: ctx.user.id, max: 30, windowSec: 3600 },
  ]);
  if (!limited.ok) return { ok: false, error: "rateLimited" };

  const doc = await renderDocument(ctx.supabase, ctx.org, f.kind, f.id);
  if (!doc) return { ok: false, error: "notFound" };
  if (doc.status && NOT_SHAREABLE.includes(doc.status)) return { ok: false, error: "notIssued" };

  const cc = [...(f.cc ?? []), ...(f.copyMe && ctx.user.email ? [ctx.user.email.toLowerCase()] : [])].filter((e) => !f.to.includes(e));
  try {
    await sendDocumentMail({
      to: f.to,
      cc: [...new Set(cc)].slice(0, 5),
      replyTo: ctx.org.email || ctx.user.email,
      companyName: ctx.org.legal_name || ctx.org.name,
      subject: f.subject,
      message: f.message,
      attachment: { filename: doc.filename, bytes: doc.bytes },
    });
  } catch (e) {
    logError("[documents] email failed", e);
    return { ok: false, error: "sendFailed" };
  }
  // the audit trail records that it was sent and how many recipients, not their addresses
  await audit(ctx, "document.emailed", f.kind, f.id, { number: doc.number, recipients: f.to.length + cc.length });
  return { ok: true };
}

/** Signed 30-day link to the PDF, for WhatsApp or other messengers. */
export async function shareDocumentLink(kind: DocKind, id: string): Promise<DocActionResult> {
  const ctx = await requireOffice(ROLES);
  if (!KINDS.includes(kind) || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "invalid" };
  const table = kind === "invoice" ? "hl_invoices" : "hl_jobs";
  const { data: row } = await ctx.supabase.from(table).select("status").eq("id", id).eq("org_id", ctx.org.id).maybeSingle<{ status: string }>();
  if (!row) return { ok: false, error: "notFound" };
  if (NOT_SHAREABLE.includes(row.status)) return { ok: false, error: "notIssued" };
  const link = createDocumentLink(kind, id);
  await audit(ctx, "document.link_created", kind, id, { expires: link.expiresAt.toISOString().slice(0, 10) });
  return { ok: true, url: link.url, expiresAt: link.expiresAt.toISOString() };
}
