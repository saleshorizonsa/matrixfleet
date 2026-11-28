import { NextResponse, type NextRequest } from "next/server";
import { getContext } from "@/lib/auth";
import { buildInvoicePdf } from "@/lib/pdf/invoice";
import { pdfResponse } from "@/lib/pdf/draw";
import { buyerSnapshot, sellerSnapshot, type BuyerSnapshot, type SellerSnapshot } from "@/lib/invoices";
import type { Customer, Invoice, InvoiceLine } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (ctx.membership.role === "driver") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: invoice } = await ctx.supabase.from("hl_invoices").select("*").eq("id", id).maybeSingle<Invoice>();
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data: lines } = await ctx.supabase
    .from("hl_invoice_lines")
    .select("*")
    .eq("invoice_id", id)
    .order("position")
    .returns<InvoiceLine[]>();

  // Issued invoices are rendered from their snapshots so they never change.
  let seller = invoice.seller_snapshot as unknown as SellerSnapshot;
  let buyer = invoice.buyer_snapshot as unknown as BuyerSnapshot;
  if (!seller?.name) seller = sellerSnapshot(ctx.org);
  if (!buyer?.name) {
    const { data: c } = invoice.customer_id
      ? await ctx.supabase.from("hl_customers").select("*").eq("id", invoice.customer_id).maybeSingle<Customer>()
      : { data: null };
    buyer = c ? buyerSnapshot(c) : ({ name: "—", kind: "business", country: ctx.org.country } as BuyerSnapshot);
  }

  const { data: original } = invoice.original_invoice_id
    ? await ctx.supabase.from("hl_invoices").select("number").eq("id", invoice.original_invoice_id).maybeSingle<{ number: string }>()
    : { data: null };
  const bytes = await buildInvoicePdf({ invoice, lines: lines ?? [], seller, buyer, originalNumber: original?.number ?? null });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return pdfResponse(bytes, `${invoice.number}.pdf`, !download);
}
