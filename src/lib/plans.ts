import type { Organization, PlanId } from "./types";

export type Currency = "GBP" | "EUR";

export interface Plan {
  id: Exclude<PlanId, "trial">;
  name: string;
  /** Monthly base price, excl. VAT. */
  price: Record<Currency, number>;
  /** Vehicles covered by the base price. */
  includedVehicles: number;
  /** Price per vehicle above `includedVehicles`, per month. null = no extras (upgrade instead). */
  extraVehiclePrice: Record<Currency, number> | null;
  users: number; // Infinity = unlimited
  features: string[]; // i18n keys in the "billing" namespace
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: { GBP: 39, EUR: 45 },
    includedVehicles: 3,
    extraVehiclePrice: null,
    users: 3,
    features: ["f_jobs", "f_driverApp", "f_pod", "f_invoicing", "f_tracking"],
  },
  {
    id: "growth",
    name: "Growth",
    price: { GBP: 119, EUR: 139 },
    includedVehicles: 10,
    extraVehiclePrice: { GBP: 9, EUR: 10 },
    users: 10,
    features: ["f_everythingStarter", "f_dispatch", "f_liveMap", "f_compliance", "f_cmr", "f_reports"],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: { GBP: 279, EUR: 325 },
    includedVehicles: 30,
    extraVehiclePrice: { GBP: 7, EUR: 8 },
    users: Infinity,
    features: ["f_everythingGrowth", "f_audit", "f_priority", "f_api"],
  },
];

export const TRIAL_DAYS = 14;
/** Vehicle cap during the free trial (trials get Growth features, but nothing is billed yet). */
export const TRIAL_MAX_VEHICLES = 30;

export function billingCurrency(currency: string): Currency {
  return currency === "GBP" ? "GBP" : "EUR";
}

/** Most vehicles a plan allows (Infinity when extra vehicles are billed instead of blocked). */
export function maxVehicles(plan: Plan) {
  return plan.extraVehiclePrice ? Infinity : plan.includedVehicles;
}

/** Vehicles billed on top of the base price. */
export function extraVehicles(plan: Plan, vehicleCount: number) {
  return plan.extraVehiclePrice ? Math.max(0, vehicleCount - plan.includedVehicles) : 0;
}

/** Monthly cost (excl. VAT) for a fleet on a plan. */
export function monthlyCost(plan: Plan, vehicleCount: number, currency: string) {
  const cur = billingCurrency(currency);
  return plan.price[cur] + extraVehicles(plan, vehicleCount) * (plan.extraVehiclePrice?.[cur] ?? 0);
}

/** Cheapest plan for a fleet of this size (e.g. Pro beats Growth with extras from ~28 vehicles). */
export function planForFleet(vehicleCount: number, currency = "GBP"): Plan {
  const fits = PLANS.filter((p) => vehicleCount <= maxVehicles(p));
  return fits.reduce((best, p) => (monthlyCost(p, vehicleCount, currency) < monthlyCost(best, vehicleCount, currency) ? p : best), fits[0]);
}

/** Limits that apply right now. A trial gets Growth features and users, capped at TRIAL_MAX_VEHICLES vehicles. */
export function limitsFor(org: Pick<Organization, "plan">) {
  const trial = org.plan === "trial";
  const plan = PLANS.find((p) => p.id === (trial ? "growth" : org.plan))!;
  return {
    vehicles: trial ? TRIAL_MAX_VEHICLES : maxVehicles(plan),
    includedVehicles: plan.includedVehicles,
    users: plan.users,
    plan,
    trial,
  };
}

export function isSubscriptionActive(org: Pick<Organization, "plan" | "subscription_status" | "trial_ends_at">) {
  if (org.plan === "trial") return new Date(org.trial_ends_at) > new Date();
  return ["active", "trialing", "past_due"].includes(org.subscription_status);
}

export function trialDaysLeft(org: Pick<Organization, "trial_ends_at">) {
  const ms = new Date(org.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** Stripe price id for a plan's monthly base fee. */
export function stripePriceId(plan: Plan["id"], currency: string) {
  return process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${billingCurrency(currency)}`];
}

/** Stripe price id for one extra vehicle per month on a plan, e.g. STRIPE_PRICE_GROWTH_EXTRA_VEHICLE_GBP. */
export function stripeExtraVehiclePriceId(plan: Plan["id"], currency: string) {
  return process.env[`STRIPE_PRICE_${plan.toUpperCase()}_EXTRA_VEHICLE_${billingCurrency(currency)}`];
}
