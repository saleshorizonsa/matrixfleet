import "server-only";
import Stripe from "stripe";
import { PLANS, extraVehicles, stripeExtraVehiclePriceId, type Plan } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/safe-log";

let _stripe: Stripe | null = null;

/** True when Stripe keys are configured. Billing UI shows a "not configured" state otherwise. */
export function billingConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** Lazily created Stripe client (never instantiated at build time). Throws if not configured. */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { appInfo: { name: "MatrixFleet", url: process.env.NEXT_PUBLIC_APP_URL || "https://matrixinfotech.co.uk" } });
  }
  return _stripe;
}

/** Reverse-map a Stripe price id to our plan id using the STRIPE_PRICE_* env vars. */
export function planFromPriceId(priceId: string | null | undefined): Plan["id"] | null {
  if (!priceId) return null;
  for (const plan of PLANS) {
    for (const cur of ["GBP", "EUR"]) {
      if (process.env[`STRIPE_PRICE_${plan.id.toUpperCase()}_${cur}`] === priceId) return plan.id;
    }
  }
  return null;
}

/** True when the price id is one of the per-extra-vehicle prices (any plan, any currency). */
export function isExtraVehiclePrice(priceId: string | null | undefined) {
  return !!priceId && PLANS.some((p) => ["GBP", "EUR"].some((cur) => stripeExtraVehiclePriceId(p.id, cur) === priceId));
}

/** The plan of a subscription, looking past the extra-vehicle line item. */
export function planFromSubscription(sub: Stripe.Subscription): Plan["id"] | null {
  for (const item of sub.items.data) {
    const plan = planFromPriceId(item.price?.id);
    if (plan) return plan;
  }
  return null;
}

/**
 * Keep the "extra vehicles" line on a Growth or Pro subscription equal to the fleet size above the
 * included vehicles. Adds, updates or removes the line item; Stripe prorates the difference.
 * Also swaps the line to the right price when the plan changes (Growth £9 → Pro £7).
 * Safe to call any time: it does nothing when billing is off, there is no paid subscription,
 * or the line is already right. Never throws.
 */
export async function syncExtraVehicles(orgId: string): Promise<{ extra: number; changed: boolean } | null> {
  if (!billingConfigured()) return null;
  try {
    const admin = createAdminClient();
    const { data: org } = await admin
      .from("hl_organizations")
      .select("plan, currency, stripe_subscription_id")
      .eq("id", orgId)
      .maybeSingle<{ plan: string; currency: string; stripe_subscription_id: string | null }>();
    if (!org?.stripe_subscription_id) return null;

    const plan = PLANS.find((p) => p.id === org.plan);
    const extraPrice = plan ? stripeExtraVehiclePriceId(plan.id, org.currency) : undefined;
    const { count } = await admin.from("hl_vehicles").select("id", { count: "exact", head: true }).eq("org_id", orgId);
    const extra = plan ? extraVehicles(plan, count ?? 0) : 0;

    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
    if (["canceled", "incomplete_expired"].includes(sub.status)) return null;
    const item = sub.items.data.find((i) => isExtraVehiclePrice(i.price?.id));

    if (extra > 0 && !extraPrice) {
      console.error(`[billing] STRIPE_PRICE_${plan?.id.toUpperCase()}_EXTRA_VEHICLE_* is not set; extra vehicles are not billed`);
      return { extra, changed: false };
    }
    if (extra > 0 && !item) {
      await stripe.subscriptionItems.create({ subscription: sub.id, price: extraPrice!, quantity: extra });
      return { extra, changed: true };
    }
    if (extra > 0 && item && (item.quantity !== extra || item.price?.id !== extraPrice)) {
      await stripe.subscriptionItems.update(item.id, { price: extraPrice!, quantity: extra });
      return { extra, changed: true };
    }
    if (extra === 0 && item) {
      await stripe.subscriptionItems.del(item.id);
      return { extra, changed: true };
    }
    return { extra, changed: false };
  } catch (err) {
    logError("[billing] syncExtraVehicles failed", err);
    return null;
  }
}
