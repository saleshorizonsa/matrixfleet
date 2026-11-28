import { NextResponse, type NextRequest } from "next/server";
import { getContext } from "@/lib/auth";
import { pdfResponse } from "@/lib/pdf/draw";
import { renderDocument } from "@/lib/documents";

export const runtime = "nodejs";

/** CMR consignment note for a job. Office staff and the assigned driver (via RLS) can download it. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const ctx = await getContext();
  const doc = await renderDocument(ctx.supabase, ctx.org, "cmr", jobId);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return pdfResponse(doc.bytes, doc.filename, !download);
}
