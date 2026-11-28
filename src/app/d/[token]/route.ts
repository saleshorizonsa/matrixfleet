import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyDocumentLink } from "@/lib/doc-links";
import { renderDocument } from "@/lib/documents";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/safe-log";
import type { Organization } from "@/lib/types";

export const runtime = "nodejs";

const notFound = () =>
  new NextResponse("This document link is invalid or has expired. Please ask the sender for a new one.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });

/** Public, signed link to one document PDF (shared by WhatsApp or email). */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const limited = await rateLimit([{ scope: "doc-link-ip", value: await clientIp(), max: 60, windowSec: 600 }]);
  if (!limited.ok) return new NextResponse("Too many requests", { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const ref = verifyDocumentLink(token);
  if (!ref) return notFound();
  try {
    const admin = createAdminClient();
    const table = ref.kind === "invoice" ? "hl_invoices" : "hl_jobs";
    const { data: row } = await admin.from(table).select("org_id,status").eq("id", ref.id).maybeSingle<{ org_id: string; status: string }>();
    // drafts, voided invoices and quotes are never shared
    if (!row || ["draft", "void", "quote", "cancelled"].includes(row.status)) return notFound();
    const { data: org } = await admin.from("hl_organizations").select("*").eq("id", row.org_id).maybeSingle<Organization>();
    if (!org) return notFound();
    const doc = await renderDocument(admin, org, ref.kind, ref.id);
    if (!doc) return notFound();
    return new NextResponse(new Uint8Array(doc.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${doc.filename.replace(/[^\w.-]+/g, "_")}"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    logError("[doc-link] render failed", e);
    return notFound();
  }
}
