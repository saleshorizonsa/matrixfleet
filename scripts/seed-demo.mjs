// Seed a demo company with realistic UK/EU data.
// Usage:  node --env-file=.env.local scripts/seed-demo.mjs
// Creates (or reuses) demo users and writes their logins to scripts/demo-credentials.local.txt (git-ignored).
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync, readFileSync } from "node:fs";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) throw new Error("Supabase env vars missing — run with --env-file=.env.local");

const CRED_FILE = new globalThis.URL("./demo-credentials.local.txt", import.meta.url);
const SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "matrixfleet";
const admin = createClient(URL, SERVICE, { db: { schema: SCHEMA }, auth: { persistSession: false } });

function loadCreds() {
  if (existsSync(CRED_FILE)) {
    const lines = readFileSync(CRED_FILE, "utf8").split("\n");
    const get = (k) => lines.find((l) => l.startsWith(k + "="))?.split("=")[1]?.trim();
    if (get("OWNER_PASSWORD")) return { owner: get("OWNER_PASSWORD"), driver: get("DRIVER_PASSWORD") };
  }
  return { owner: "Demo-" + randomBytes(6).toString("base64url"), driver: "Drive-" + randomBytes(6).toString("base64url") };
}
const creds = loadCreds();
const OWNER_EMAIL = "owner@demo.haulora.test";
const DRIVER_EMAIL = "driver@demo.haulora.test";

async function ensureUser(email, password, full_name) {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users?.find((u) => u.email === email);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
  if (error) throw error;
  return data.user.id;
}

const ownerId = await ensureUser(OWNER_EMAIL, creds.owner, "Sarah Mitchell");
const driverUserId = await ensureUser(DRIVER_EMAIL, creds.driver, "Tomasz Nowak");

// Remove a previous demo org so the seed is repeatable.
const { data: oldMem } = await admin.from("hl_memberships").select("org_id").eq("user_id", ownerId);
for (const m of oldMem ?? []) await admin.from("hl_organizations").delete().eq("id", m.org_id);
await admin.from("hl_memberships").delete().eq("user_id", driverUserId);

// Create the organisation as the owner (exercises the real RPC).
const ownerClient = createClient(URL, ANON, { db: { schema: SCHEMA }, auth: { persistSession: false } });
const { error: signErr } = await ownerClient.auth.signInWithPassword({ email: OWNER_EMAIL, password: creds.owner });
if (signErr) throw signErr;
const { data: orgId, error: orgErr } = await ownerClient.rpc("hl_create_organization", {
  p_name: "Northline Haulage", p_country: "GB", p_currency: "GBP", p_full_name: "Sarah Mitchell", p_locale: "en",
});
if (orgErr) throw orgErr;

await admin.from("hl_organizations").update({
  legal_name: "Northline Haulage Ltd", vat_number: "GB123456789", company_number: "12345678",
  address_line1: "Unit 4, Trafford Park Road", city: "Manchester", postcode: "M17 1HH",
  email: "ops@northline.example", phone: "+44 161 555 0100", website: "northline.example",
  bank_name: "Barclays", bank_sort_code: "20-00-00", bank_account: "55779911", bank_iban: "GB33BUKB20000055779911", bank_bic: "BUKBGB22",
}).eq("id", orgId);

const days = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const at = (n, h) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.toISOString(); };

// Customers
const customers = [
  { name: "Brightway Retail Ltd", country: "GB", city: "Leeds", postcode: "LS1 4DY", address_line1: "12 Wellington St", vat_number: "GB987654321", contact_name: "James Carter", email: "logistics@brightway.example" },
  { name: "Kessler Maschinenbau GmbH", country: "DE", city: "Hamburg", postcode: "20095", address_line1: "Mönckebergstraße 7", vat_number: "DE811907980", contact_name: "Anna Kessler", email: "versand@kessler.example" },
  { name: "Maison Duval SARL", country: "FR", city: "Lille", postcode: "59000", address_line1: "8 Rue Nationale", vat_number: "FR40303265045", contact_name: "Claire Duval", email: "achats@duval.example" },
  { name: "Van Dijk Foods B.V.", country: "NL", city: "Rotterdam", postcode: "3011", address_line1: "Coolsingel 40", vat_number: "NL003028112B01", contact_name: "Pieter van Dijk", email: "transport@vandijk.example" },
  { name: "Polmet Sp. z o.o.", country: "PL", city: "Poznań", postcode: "61-001", address_line1: "ul. Święty Marcin 29", vat_number: "PL5260001246", contact_name: "Katarzyna Wiśniewska", email: "logistyka@polmet.example" },
  { name: "Liffey Building Supplies", country: "IE", city: "Dublin", postcode: "D02 X285", address_line1: "21 Grand Canal Dock", vat_number: "IE6388047V", contact_name: "Sean O'Brien", email: "orders@liffey.example" },
  { name: "Greenfield Garden Centre", country: "GB", city: "Bristol", postcode: "BS1 5TR", address_line1: "3 Harbourside", contact_name: "Emma Hughes", email: "emma@greenfield.example" },
].map((c) => ({ ...c, org_id: orgId, kind: "business", payment_terms_days: 30 }));
const { data: cust, error: cErr } = await admin.from("hl_customers").insert(customers).select("id,name,country");
if (cErr) throw cErr;

// Drivers (one linked to the driver app login)
const driversIn = [
  { full_name: "Tomasz Nowak", email: DRIVER_EMAIL, phone: "+44 7700 900101", colour: "#5B5BF7", user_id: driverUserId, last_lat: 53.4794, last_lng: -2.2453, licence_expiry: days(400), cpc_expiry: days(21), tacho_card_expiry: days(300), licence_categories: "B, C, CE" },
  { full_name: "Gareth Evans", email: "gareth@northline.example", phone: "+44 7700 900102", colour: "#10B981", last_lat: 52.4862, last_lng: -1.8904, licence_expiry: days(800), cpc_expiry: days(200), tacho_card_expiry: days(5), licence_categories: "B, C" },
  { full_name: "Ioana Popescu", email: "ioana@northline.example", phone: "+44 7700 900103", colour: "#F59E0B", last_lat: 51.0, last_lng: 1.7, licence_expiry: days(1200), cpc_expiry: days(500), tacho_card_expiry: days(700), licence_categories: "B, C, CE" },
  { full_name: "Liam Walsh", email: "liam@northline.example", phone: "+44 7700 900104", colour: "#EF4444", last_lat: 51.5072, last_lng: -0.1276, licence_expiry: days(-3), cpc_expiry: days(90), tacho_card_expiry: days(400), licence_categories: "B, C1" },
].map((d, i) => ({ ...d, org_id: orgId, status: "active", last_seen_at: i < 3 ? new Date(Date.now() - i * 60_000).toISOString() : new Date(Date.now() - 86_400_000).toISOString(), licence_number: `MORGA75${i}0129AB9CD` }));
const { data: drv, error: dErr } = await admin.from("hl_drivers").insert(driversIn).select("id,full_name");
if (dErr) throw dErr;
await admin.from("hl_memberships").insert({ org_id: orgId, user_id: driverUserId, role: "driver", full_name: "Tomasz Nowak" });

// Vehicles
const vehiclesIn = [
  { registration: "MN24 HLR", make: "DAF", model: "XF 480", kind: "artic", capacity_kg: 24000, pallets: 26, mot_expiry: days(120), insurance_expiry: days(200), tax_expiry: days(60), tacho_calibration_expiry: days(14), next_service_date: days(30), odometer: 312450, default_driver_id: drv[0].id, status: "in_use" },
  { registration: "MN73 KTR", make: "Volvo", model: "FM 330", kind: "rigid", capacity_kg: 10000, pallets: 14, mot_expiry: days(9), insurance_expiry: days(300), tax_expiry: days(150), tacho_calibration_expiry: days(500), next_service_date: days(12), odometer: 158200, default_driver_id: drv[1].id, status: "in_use" },
  { registration: "MA22 VNX", make: "Mercedes-Benz", model: "Sprinter 316", kind: "van", capacity_kg: 1200, pallets: 3, mot_expiry: days(240), insurance_expiry: days(-2), tax_expiry: days(100), next_service_date: days(45), odometer: 88900, default_driver_id: drv[3].id, status: "available" },
  { registration: "MX21 LUT", make: "Ford", model: "Transit Luton", kind: "luton", capacity_kg: 1000, pallets: 4, mot_expiry: days(180), insurance_expiry: days(180), tax_expiry: days(25), next_service_date: days(80), odometer: 120300, status: "maintenance" },
  { registration: "MN23 SCN", make: "Scania", model: "R 450", kind: "artic", capacity_kg: 24000, pallets: 26, mot_expiry: days(330), insurance_expiry: days(260), tax_expiry: days(210), tacho_calibration_expiry: days(600), next_service_date: days(20), odometer: 201330, default_driver_id: drv[2].id, status: "in_use" },
].map((v) => ({ ...v, org_id: orgId }));
const { data: veh, error: vErr } = await admin.from("hl_vehicles").insert(vehiclesIn).select("id,registration");
if (vErr) throw vErr;

// Places
const P = {
  manchester: { name: "Northline Depot", address: "Trafford Park Road", city: "Manchester", postcode: "M17 1HH", country: "GB", lat: 53.4668, lng: -2.3189 },
  leeds: { name: "Brightway DC", address: "Thorpe Park", city: "Leeds", postcode: "LS15 8GB", country: "GB", lat: 53.8008, lng: -1.5491 },
  birmingham: { name: "Midlands Hub", address: "Saltley Business Park", city: "Birmingham", postcode: "B8 1BL", country: "GB", lat: 52.4862, lng: -1.8904 },
  london: { name: "Park Royal Warehouse", address: "Abbey Road, Park Royal", city: "London", postcode: "NW10 7RH", country: "GB", lat: 51.5308, lng: -0.2797 },
  bristol: { name: "Greenfield Garden Centre", address: "3 Harbourside", city: "Bristol", postcode: "BS1 5TR", country: "GB", lat: 51.4545, lng: -2.5879 },
  glasgow: { name: "Clyde Logistics", address: "Hillington Park", city: "Glasgow", postcode: "G52 4RU", country: "GB", lat: 55.8642, lng: -4.2518 },
  dover: { name: "Port of Dover", address: "Eastern Docks", city: "Dover", postcode: "CT16 1JA", country: "GB", lat: 51.1279, lng: 1.3134 },
  rotterdam: { name: "Van Dijk Foods", address: "Maasvlakte", city: "Rotterdam", postcode: "3199", country: "NL", lat: 51.9244, lng: 4.4777 },
  hamburg: { name: "Kessler Werk 2", address: "Billbrookdeich 20", city: "Hamburg", postcode: "22113", country: "DE", lat: 53.5511, lng: 9.9937 },
  lille: { name: "Maison Duval Entrepôt", address: "Zone Industrielle", city: "Lille", postcode: "59000", country: "FR", lat: 50.6292, lng: 3.0573 },
  poznan: { name: "Polmet Magazyn", address: "ul. Głogowska 210", city: "Poznań", postcode: "60-104", country: "PL", lat: 52.4064, lng: 16.9252 },
  dublin: { name: "Liffey Building Supplies", address: "Grand Canal Dock", city: "Dublin", postcode: "D02 X285", country: "IE", lat: 53.3498, lng: -6.2603 },
};
const C = Object.fromEntries(cust.map((c) => [c.name.split(" ")[0].toLowerCase(), c.id]));
const routeKm = (a, b) => {
  const R = 6371, toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.22);
};
const job = (o) => {
  const a = P[o.from], b = P[o.to], km = routeKm(a, b);
  return {
    org_id: orgId, customer_id: o.customer, status: o.status, scheduled_date: days(o.day),
    pickup_name: a.name, pickup_address: a.address, pickup_city: a.city, pickup_postcode: a.postcode, pickup_country: a.country, pickup_lat: a.lat, pickup_lng: a.lng,
    pickup_from: at(o.day, 7), pickup_to: at(o.day, 10),
    delivery_name: b.name, delivery_address: b.address, delivery_city: b.city, delivery_postcode: b.postcode, delivery_country: b.country, delivery_lat: b.lat, delivery_lng: b.lng,
    delivery_from: at(o.day + (km > 600 ? 1 : 0), 13), delivery_to: at(o.day + (km > 600 ? 1 : 0), 17),
    goods_description: o.goods, weight_kg: o.kg, pallets: o.pallets, adr: !!o.adr, adr_un_number: o.adr ?? null,
    distance_km: km, duration_min: Math.round(km / 70 * 60), price_net: o.price ?? Math.round(35 + km * 0.621371 * 1.6 * 1.08 + (o.pallets ?? 0) * 4),
    currency: "GBP", driver_id: o.driver != null ? drv[o.driver].id : null, vehicle_id: o.vehicle != null ? veh[o.vehicle].id : null,
    customer_ref: o.ref ?? null, sort_order: o.sort ?? 0,
    picked_up_at: ["in_transit", "delivered", "invoiced"].includes(o.status) ? at(o.day, 8) : null,
    delivered_at: ["delivered", "invoiced"].includes(o.status) ? at(o.day, 15) : null,
    pod_signed_by: ["delivered", "invoiced"].includes(o.status) ? "J. Smith" : null,
  };
};
const jobsIn = [
  // past, delivered (revenue history)
  ...Array.from({ length: 18 }, (_, i) => {
    const routes = [["manchester", "leeds", "brightway"], ["birmingham", "bristol", "greenfield"], ["manchester", "hamburg", "kessler"], ["london", "lille", "maison"], ["manchester", "rotterdam", "van"], ["birmingham", "dublin", "liffey"], ["london", "poznan", "polmet"]];
    const [from, to, c] = routes[i % routes.length];
    return job({ from, to, customer: C[c], status: "delivered", day: -2 - i * 1.5 | 0, goods: ["Palletised retail goods", "Garden furniture", "Machine parts", "Wine & spirits", "Chilled food", "Timber & plasterboard", "Steel profiles"][i % 7], kg: 4000 + i * 600, pallets: 6 + (i % 10), driver: i % 4, vehicle: i % 5 });
  }),
  // today
  job({ from: "manchester", to: "leeds", customer: C.brightway, status: "in_transit", day: 0, goods: "Palletised retail goods", kg: 8200, pallets: 14, driver: 0, vehicle: 0, ref: "PO-55120", sort: 0 }),
  job({ from: "leeds", to: "glasgow", customer: C.brightway, status: "assigned", day: 0, goods: "Returns cages", kg: 2100, pallets: 6, driver: 0, vehicle: 0, sort: 1 }),
  job({ from: "birmingham", to: "london", customer: C.greenfield, status: "in_transit", day: 0, goods: "Garden furniture", kg: 3400, pallets: 8, driver: 1, vehicle: 1, sort: 0 }),
  job({ from: "dover", to: "hamburg", customer: C.kessler, status: "in_transit", day: 0, goods: "CNC machine parts", kg: 18200, pallets: 20, driver: 2, vehicle: 4, ref: "KM-2026-4471", sort: 0 }),
  job({ from: "london", to: "bristol", customer: C.greenfield, status: "booked", day: 0, goods: "Compost & planters", kg: 900, pallets: 3 }),
  job({ from: "manchester", to: "dublin", customer: C.liffey, status: "booked", day: 0, goods: "Insulation boards", kg: 5200, pallets: 12, adr: null }),
  // upcoming
  job({ from: "manchester", to: "rotterdam", customer: C.van, status: "booked", day: 1, goods: "Chilled food (2–8°C)", kg: 12000, pallets: 18 }),
  job({ from: "birmingham", to: "lille", customer: C.maison, status: "assigned", day: 1, goods: "Wine & spirits", kg: 7600, pallets: 12, driver: 1, vehicle: 1 }),
  job({ from: "london", to: "poznan", customer: C.polmet, status: "booked", day: 2, goods: "Industrial coatings", kg: 9800, pallets: 16, adr: "UN1263" }),
  job({ from: "manchester", to: "hamburg", customer: C.kessler, status: "quote", day: 4, goods: "Machine tooling", kg: 14000, pallets: 18 }),
  job({ from: "leeds", to: "london", customer: C.brightway, status: "quote", day: 3, goods: "Seasonal stock", kg: 6000, pallets: 12 }),
];
const { data: jobs, error: jErr } = await admin.from("hl_jobs").insert(jobsIn).select("id,status,customer_id,price_net,reference");
if (jErr) throw jErr;

// A vehicle check with a defect + a shift for the demo driver
await admin.from("hl_vehicle_checks").insert([
  { org_id: orgId, vehicle_id: veh[0].id, driver_id: drv[0].id, odometer: 312400, passed: true, items: { tyres: "ok", lights: "ok", mirrors: "ok", brakes: "ok", fluids: "ok", bodywork: "ok", load: "ok", horn: "ok", dashboard: "ok", safety: "ok" } },
  { org_id: orgId, vehicle_id: veh[1].id, driver_id: drv[1].id, odometer: 158150, passed: false, defects: "Nearside indicator lens cracked", items: { tyres: "ok", lights: "defect", mirrors: "ok", brakes: "ok", fluids: "ok", bodywork: "ok", load: "ok", horn: "ok", dashboard: "ok", safety: "ok" } },
]);
await admin.from("hl_driver_shifts").insert({ org_id: orgId, driver_id: drv[0].id, vehicle_id: veh[0].id, started_at: at(0, 6), break_minutes: 15 });

writeFileSync(
  CRED_FILE,
  `# MatrixFleet demo logins (local development only — do not commit)\nOWNER_EMAIL=${OWNER_EMAIL}\nOWNER_PASSWORD=${creds.owner}\nDRIVER_EMAIL=${DRIVER_EMAIL}\nDRIVER_PASSWORD=${creds.driver}\n`,
);
console.log(`Seeded org ${orgId}: ${cust.length} customers, ${drv.length} drivers, ${veh.length} vehicles, ${jobs.length} jobs.`);
console.log("Logins written to scripts/demo-credentials.local.txt");
