import { NextResponse, type NextRequest } from "next/server";
import { getContext, ADMIN_ROLES } from "@/lib/auth";
import { PLANS, extraVehicles, stripeExtraVehiclePriceId, stripePriceId } from "@/lib/plans";
import { billingConfigured, getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { APP_URL } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const ctx = await getContext();
  const back = new URL("/app/settings/billing", APP_URL);
  if (!ADMIN_ROLES.includes(ctx.membership.role)) {
    back.searchParams.set("error", "forbidden");
    return NextResponse.redirect(back, { status: 303 });
  }
  if (!billingConfigured()) {
    back.searchParams.set("error", "not_configured");
    return NextResponse.redirect(back, { status: 303 });
  }

  const form = await request.formData();
  const planId = String(form.get("plan") ?? "");
  const plan = PLANS.find((p) => p.id === planId);
  const price = plan ? stripePriceId(plan.id, ctx.org.currency) : undefined;
  if (!plan || !price) {
    back.searchParams.set("error", "price_missing");
    return NextResponse.redirect(back, { status: 303 });
  }

  // Growth and Pro bill each vehicle above the included ones; charge for the current fleet from day one.
  const { count: vehicleCount } = await ctx.supabase.from("hl_vehicles").select("id", { count: "exact", head: true }).eq("org_id", ctx.org.id);
  const extra = extraVehicles(plan, vehicleCount ?? 0);
  const extraPrice = stripeExtraVehiclePriceId(plan.id, ctx.org.currency);
  if (extra > 0 && !extraPrice) {
    back.searchParams.set("error", "price_missing");
    return NextResponse.redirect(back, { status: 303 });
  }
  const lineItems = [{ price, quantity: 1 }, ...(extra > 0 ? [{ price: extraPrice!, quantity: extra }] : [])];

  const stripe = getStripe();
  let customerId = ctx.org.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: ctx.org.legal_name || ctx.org.name,
      email: ctx.org.email || ctx.user.email,
      metadata: { org_id: ctx.org.id },
      preferred_locales: [ctx.org.locale],
    });
    customerId = customer.id;
    // write with service role: only owners/admins reach here, but stripe ids must not be user-editable later
    await createAdminClient().from("hl_organizations").update({ stripe_customer_id: customerId }).eq("id", ctx.org.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: ctx.org.id,
    line_items: lineItems,
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
    billing_address_collection: "required",
    allow_promotion_codes: true,
    subscription_data: { metadata: { org_id: ctx.org.id, plan: plan.id } },
    metadata: { org_id: ctx.org.id, plan: plan.id },
    success_url: `${APP_URL}/app/settings/billing?success=1`,
    cancel_url: `${APP_URL}/app/settings/billing?canceled=1`,
  });

  await audit(ctx, "billing.checkout_started", "organization", ctx.org.id, { plan: plan.id, extra_vehicles: extra });
  return NextResponse.redirect(session.url!, { status: 303 });
}
