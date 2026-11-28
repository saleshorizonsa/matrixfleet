import { NextResponse, type NextRequest } from "next/server";
import { getContext } from "@/lib/auth";
import { pdfResponse } from "@/lib/pdf/draw";
import { renderDocument } from "@/lib/documents";

export const runtime = "nodejs";

/** Invoice / credit note PDF for office staff. ?download=1 → attachment, otherwise inline. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (ctx.membership.role === "driver") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const doc = await renderDocument(ctx.supabase, ctx.org, "invoice", id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return pdfResponse(doc.bytes, doc.filename, !download);
}
