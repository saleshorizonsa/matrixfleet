import { NextResponse } from "next/server";
import { getContext, ADMIN_ROLES } from "@/lib/auth";
import { billingConfigured, getStripe } from "@/lib/stripe";
import { APP_URL } from "@/lib/utils";

export async function POST() {
  const ctx = await getContext();
  const back = new URL("/app/settings/billing", APP_URL);
  if (!ADMIN_ROLES.includes(ctx.membership.role) || !billingConfigured() || !ctx.org.stripe_customer_id) {
    back.searchParams.set("error", "portal_unavailable");
    return NextResponse.redirect(back, { status: 303 });
  }
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: ctx.org.stripe_customer_id,
      return_url: back.toString(),
    });
    return NextResponse.redirect(session.url, { status: 303 });
  } catch (err) {
    console.error("[billing] portal failed", err);
    back.searchParams.set("error", "stripe_error");
    return NextResponse.redirect(back, { status: 303 });
  }
}
