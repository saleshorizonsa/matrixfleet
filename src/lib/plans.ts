import type { Organization, PlanId } from "./types";

export interface Plan {
  id: Exclude<PlanId, "trial">;
  name: string;
  price: { GBP: number; EUR: number };
  vehicles: number; // Infinity = unlimited
  users: number;
  features: string[]; // i18n keys in the "billing" namespace
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: { GBP: 39, EUR: 45 },
    vehicles: 3,
    users: 3,
    features: ["f_jobs", "f_driverApp", "f_pod", "f_invoicing", "f_tracking"],
  },
  {
    id: "growth",
    name: "Growth",
    price: { GBP: 99, EUR: 115 },
    vehicles: 15,
    users: 10,
    features: ["f_everythingStarter", "f_dispatch", "f_liveMap", "f_compliance", "f_cmr", "f_reports"],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: { GBP: 249, EUR: 289 },
    vehicles: Infinity,
    users: Infinity,
    features: ["f_everythingGrowth", "f_unlimited", "f_audit", "f_priority", "f_api"],
  },
];

export const TRIAL_DAYS = 14;

/** Limits that apply right now. A trial gets Growth limits. */
export function limitsFor(org: Pick<Organization, "plan">) {
  const planId = org.plan === "trial" ? "growth" : org.plan;
  const plan = PLANS.find((p) => p.id === planId)!;
  return { vehicles: plan.vehicles, users: plan.users, plan };
}

export function isSubscriptionActive(org: Pick<Organization, "plan" | "subscription_status" | "trial_ends_at">) {
  if (org.plan === "trial") return new Date(org.trial_ends_at) > new Date();
  return ["active", "trialing", "past_due"].includes(org.subscription_status);
}

export function trialDaysLeft(org: Pick<Organization, "trial_ends_at">) {
  const ms = new Date(org.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function stripePriceId(plan: Plan["id"], currency: string) {
  const cur = currency === "GBP" ? "GBP" : "EUR";
  return process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${cur}`];
}
