// Hand-written row types for the hl_* tables (see supabase/migrations/0001_init.sql).

export type Role = "owner" | "admin" | "dispatcher" | "driver" | "accountant";
export type JobStatus = "quote" | "booked" | "assigned" | "in_transit" | "delivered" | "invoiced" | "cancelled";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";
export type VatTreatment = "standard" | "reverse_charge" | "zero_rated" | "outside_scope" | "exempt";
export type PlanId = "trial" | "starter" | "growth" | "pro";

export interface PricingSettings {
  base_fee: number;
  rate_per_distance: number; // per km or per mile, following org.distance_unit
  fuel_surcharge_pct: number;
  adr_surcharge: number;
  per_pallet: number;
}

export interface Organization {
  id: string;
  name: string;
  legal_name: string | null;
  country: string;
  currency: string;
  distance_unit: "km" | "mi";
  locale: string;
  vat_number: string | null;
  company_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  bank_name: string | null;
  bank_iban: string | null;
  bank_bic: string | null;
  bank_sort_code: string | null;
  bank_account: string | null;
  invoice_prefix: string;
  next_invoice_number: number;
  payment_terms_days: number;
  default_vat_rate: number;
  pricing: PricingSettings;
  plan: PlanId;
  subscription_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string;
  current_period_end: string | null;
  created_at: string;
}

export interface Membership {
  org_id: string;
  user_id: string;
  role: Role;
  full_name: string | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  org_id: string;
  email: string;
  role: Role;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Customer {
  id: string;
  org_id: string;
  name: string;
  kind: "business" | "individual";
  vat_number: string | null;
  vat_verified: boolean;
  vat_verified_at: string | null;
  country: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  payment_terms_days: number | null;
  rate_per_distance: number | null;
  notes: string | null;
  created_at: string;
}

export interface Driver {
  id: string;
  org_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  licence_number: string | null;
  licence_categories: string | null;
  licence_expiry: string | null;
  cpc_expiry: string | null;
  tacho_card_expiry: string | null;
  status: "active" | "off" | "inactive";
  colour: string;
  last_lat: number | null;
  last_lng: number | null;
  last_speed: number | null;
  last_heading: number | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  org_id: string;
  registration: string;
  make: string | null;
  model: string | null;
  kind: "van" | "luton" | "rigid" | "artic" | "trailer" | "car" | "other";
  capacity_kg: number | null;
  pallets: number | null;
  mot_expiry: string | null;
  insurance_expiry: string | null;
  tax_expiry: string | null;
  tacho_calibration_expiry: string | null;
  next_service_date: string | null;
  odometer: number | null;
  status: "available" | "in_use" | "maintenance" | "off_road";
  default_driver_id: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  org_id: string;
  reference: string;
  customer_id: string | null;
  customer_ref: string | null;
  status: JobStatus;
  pickup_name: string | null;
  pickup_address: string | null;
  pickup_city: string | null;
  pickup_postcode: string | null;
  pickup_country: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_from: string | null;
  pickup_to: string | null;
  pickup_contact: string | null;
  pickup_phone: string | null;
  delivery_name: string | null;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_postcode: string | null;
  delivery_country: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_from: string | null;
  delivery_to: string | null;
  delivery_contact: string | null;
  delivery_phone: string | null;
  goods_description: string | null;
  weight_kg: number | null;
  pallets: number | null;
  volume_m3: number | null;
  adr: boolean;
  adr_un_number: string | null;
  temperature_controlled: boolean;
  distance_km: number | null;
  duration_min: number | null;
  price_net: number | null;
  cost_estimate: number | null;
  currency: string;
  scheduled_date: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  sort_order: number;
  tracking_token: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  pod_signed_by: string | null;
  pod_signature_path: string | null;
  pod_photo_paths: string[];
  pod_notes: string | null;
  pod_lat: number | null;
  pod_lng: number | null;
  invoice_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobEvent {
  id: string;
  org_id: string;
  job_id: string;
  kind: string;
  status: JobStatus | null;
  message: string | null;
  lat: number | null;
  lng: number | null;
  created_by: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  org_id: string;
  customer_id: string | null;
  number: string;
  issue_date: string;
  supply_date: string | null;
  due_date: string;
  currency: string;
  status: InvoiceStatus;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  vat_treatment: VatTreatment;
  vat_note: string | null;
  seller_snapshot: Record<string, unknown>;
  buyer_snapshot: Record<string, unknown>;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface InvoiceLine {
  id: string;
  org_id: string;
  invoice_id: string;
  job_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  position: number;
}

export interface VehicleCheck {
  id: string;
  org_id: string;
  vehicle_id: string;
  driver_id: string | null;
  odometer: number | null;
  items: Record<string, "ok" | "defect" | "na">;
  defects: string | null;
  passed: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface DriverShift {
  id: string;
  org_id: string;
  driver_id: string;
  vehicle_id: string | null;
  started_at: string;
  ended_at: string | null;
  break_minutes: number;
  on_break_since: string | null;
  notes: string | null;
}

export interface AuditLog {
  id: number;
  org_id: string;
  user_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
