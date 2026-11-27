import "server-only";
import Stripe from "stripe";
import { PLANS, type Plan } from "@/lib/plans";

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
    _stripe = new Stripe(key, { appInfo: { name: "Haulora", url: "https://haulora.com" } });
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
