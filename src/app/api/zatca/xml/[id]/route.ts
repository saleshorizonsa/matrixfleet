import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";

export const runtime = "nodejs";

/** Download the e-invoice XML (ZATCA-cleared for standard invoices, signed for simplified ones). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ctx = await getContext();
  if (ctx.membership.role === "driver") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data } = await ctx.supabase.from("hl_invoices").select("number,zatca_xml").eq("id", id).maybeSingle<{ number: string; zatca_xml: string | null }>();
  if (!data?.zatca_xml) return NextResponse.json({ error: "not found" }, { status: 404 });
  const name = `${data.number.replace(/[^A-Za-z0-9._-]/g, "_")}.xml`;
  return new NextResponse(data.zatca_xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
