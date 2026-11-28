import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncExtraVehicles } from "@/lib/stripe";
import { logError } from "@/lib/safe-log";
import { retryPendingZatca } from "@/lib/zatca";

/**
 * Daily billing reconciliation (Vercel Cron, see vercel.json).
 * Vehicles can be added outside the app's own forms (e.g. directly through the API); this makes sure
 * every paying company's "extra vehicles" quantity in Stripe matches its real fleet size.
 * Also re-submits Saudi simplified e-invoices that ZATCA could not be reached for (24-hour rule).
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else gets 401.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const got = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return !!secret && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const admin = createAdminClient();
    const { data: orgs } = await admin
      .from("hl_organizations")
      .select("id")
      .not("stripe_subscription_id", "is", null)
      .in("plan", ["growth", "pro"]);
    let changed = 0;
    for (const o of orgs ?? []) {
      const r = await syncExtraVehicles(o.id);
      if (r?.changed) changed++;
    }
    let zatca = { checked: 0, reported: 0 };
    try {
      zatca = await retryPendingZatca();
    } catch (err) {
      logError("[cron] zatca retry failed", err);
    }
    return NextResponse.json({ checked: orgs?.length ?? 0, changed, zatca });
  } catch (err) {
    logError("[cron] billing-sync failed", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
