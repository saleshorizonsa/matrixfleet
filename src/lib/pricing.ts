import type { PricingSettings } from "./types";

export interface QuoteInput {
  distanceKm: number;
  unit: "km" | "mi";
  pallets?: number | null;
  adr?: boolean;
  pricing: PricingSettings;
  /** customer-specific override of the per-distance rate */
  ratePerDistance?: number | null;
}

export interface QuoteBreakdown {
  distance: number; // in the org's unit
  rate: number;
  base: number;
  distanceCharge: number;
  palletCharge: number;
  adrCharge: number;
  subtotal: number;
  fuelPct: number;
  fuelCharge: number;
  total: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export const DEFAULT_PRICING: PricingSettings = {
  base_fee: 35,
  rate_per_distance: 1.6,
  fuel_surcharge_pct: 8,
  adr_surcharge: 45,
  per_pallet: 4,
};

/** Pure quote calculation: base + distance × rate + pallets + ADR, then fuel surcharge %. */
export function calculateQuote(input: QuoteInput): QuoteBreakdown {
  const p = { ...DEFAULT_PRICING, ...(input.pricing ?? {}) };
  const distance = input.unit === "mi" ? input.distanceKm * 0.621371 : input.distanceKm;
  const rate = input.ratePerDistance != null && input.ratePerDistance > 0 ? input.ratePerDistance : Number(p.rate_per_distance);
  const base = Number(p.base_fee) || 0;
  const distanceCharge = distance * rate;
  const palletCharge = (Number(input.pallets) || 0) * (Number(p.per_pallet) || 0);
  const adrCharge = input.adr ? Number(p.adr_surcharge) || 0 : 0;
  const subtotal = base + distanceCharge + palletCharge + adrCharge;
  const fuelPct = Number(p.fuel_surcharge_pct) || 0;
  const fuelCharge = (subtotal * fuelPct) / 100;
  return {
    distance: r2(distance),
    rate: r2(rate),
    base: r2(base),
    distanceCharge: r2(distanceCharge),
    palletCharge: r2(palletCharge),
    adrCharge: r2(adrCharge),
    subtotal: r2(subtotal),
    fuelPct,
    fuelCharge: r2(fuelCharge),
    total: r2(subtotal + fuelCharge),
  };
}
