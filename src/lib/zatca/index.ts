import "server-only";
// Saudi e-invoicing (ZATCA Phase 2) for MatrixFleet companies whose country is Saudi Arabia.
//
//  Onboarding: key pair + CSR → compliance CSID (one-time code from the Fatoora portal) →
//              the 6 compliance sample documents → production CSID. Keys and secrets are stored
//              encrypted (AES-256-GCM, ZATCA_ENCRYPTION_KEY) in hl_zatca_units, which only the
//              service role can read.
//  Issuing:    reserve counter + previous hash → sign → commit to the chain → clear (B2B, standard)
//              or report (B2C, simplified). A standard invoice only becomes "sent" once ZATCA has
//              cleared it; a simplified invoice is issued at once and reported (retried if needed).
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { country, isSaudiVatNumber } from "@/lib/countries";
import { logError } from "@/lib/safe-log";
import type { Customer, Invoice, InvoiceLine, Organization } from "@/lib/types";
import { buildCsr, certFromToken, decryptSecret, encryptSecret, generateSigningKey, zatcaConfigured, type ZatcaEnv } from "./crypto";
import { clearInvoice, complianceCheck, reportInvoice, requestComplianceCsid, requestProductionCsid, ZatcaError, type ZatcaMessage, type ZatcaResult } from "./api";
import { nowKsa, qrFromXml, signInvoice, type ZatcaCategory, type ZatcaDocType, type ZatcaInvoiceInput, type ZatcaKind, type ZatcaParty } from "./xml";

export { zatcaConfigured };
export type { ZatcaEnv };

export const INITIAL_PIH = "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==";
const FINAL = ["pending", "cleared", "reported", "warning"];

interface UnitRow {
  org_id: string;
  environment: ZatcaEnv;
  status: "not_started" | "compliance" | "active" | "failed";
  egs_serial: string;
  common_name: string;
  org_unit: string;
  invoice_types: string;
  location: string | null;
  industry: string;
  private_key_enc: string | null;
  production_token: string | null;
  production_secret_enc: string | null;
  certificate_expires_at: string | null;
  checks: unknown;
  icv: number;
  last_hash: string;
  last_error: string | null;
  onboarded_at: string | null;
}

/** What the settings page may show (no keys or secrets). */
export interface ZatcaStatus {
  environment: ZatcaEnv;
  status: UnitRow["status"];
  egsSerial: string;
  certificateExpiresAt: string | null;
  icv: number;
  lastError: string | null;
  onboardedAt: string | null;
  checks: { name: string; ok: boolean; messages: string[] }[] | null;
}

export function zatcaRequired(org: Pick<Organization, "country">) {
  return country(org.country)?.einvoicing === "zatca";
}

export async function getZatcaStatus(orgId: string): Promise<ZatcaStatus | null> {
  const { data } = await createAdminClient()
    .from("hl_zatca_units")
    .select("environment,status,egs_serial,certificate_expires_at,icv,last_error,onboarded_at,checks")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data) return null;
  return {
    environment: data.environment,
    status: data.status,
    egsSerial: data.egs_serial,
    certificateExpiresAt: data.certificate_expires_at,
    icv: Number(data.icv),
    lastError: data.last_error,
    onboardedAt: data.onboarded_at,
    checks: (data.checks as ZatcaStatus["checks"]) ?? null,
  };
}

/* ------------------------------------------------------------------ data checks */

export type SellerField = "legal_name" | "vat_number" | "company_number" | "address_line1" | "building_number" | "district" | "city" | "postcode";
export type BuyerField = "name" | "vat_number" | "id_value" | "address_line1" | "building_number" | "district" | "city" | "postcode";

/** Fields a Saudi company must fill in before connecting to ZATCA. */
export function sellerProblems(org: Organization): SellerField[] {
  const p: SellerField[] = [];
  if (!(org.legal_name || org.legal_name_ar)) p.push("legal_name");
  if (!isSaudiVatNumber(org.vat_number)) p.push("vat_number");
  if (!/^\d{10}$/.test(org.company_number ?? "")) p.push("company_number");
  if (!org.address_line1) p.push("address_line1");
  if (!/^\d{4}$/.test(org.building_number ?? "")) p.push("building_number");
  if (!org.district) p.push("district");
  if (!org.city) p.push("city");
  if (!/^\d{5}$/.test(org.postcode ?? "")) p.push("postcode");
  return p;
}

export function invoiceKind(c: Pick<Customer, "kind"> | null | undefined): ZatcaKind {
  return c?.kind === "business" ? "standard" : "simplified";
}

/** Buyer details ZATCA requires on a standard (B2B) tax invoice. */
export function buyerProblems(c: Customer | null | undefined): BuyerField[] {
  if (!c) return ["name"];
  if (invoiceKind(c) === "simplified") return [];
  const p: BuyerField[] = [];
  const sa = c.country === "SA";
  if (sa && c.vat_number && !isSaudiVatNumber(c.vat_number)) p.push("vat_number");
  if (sa && !c.vat_number && !c.id_value) p.push("id_value");
  if (!c.address_line1) p.push("address_line1");
  if (!c.city) p.push("city");
  if (sa) {
    if (!/^\d{4}$/.test(c.building_number ?? "")) p.push("building_number");
    if (!c.district) p.push("district");
    if (!/^\d{5}$/.test(c.postcode ?? "")) p.push("postcode");
  }
  return p;
}

/* ------------------------------------------------------------------ mapping */

function sellerParty(org: Organization): ZatcaParty {
  return {
    name: org.legal_name_ar || org.legal_name || org.name,
    vatNumber: org.vat_number,
    idScheme: "CRN",
    idValue: org.company_number,
    street: org.address_line1,
    building: org.building_number,
    additional: org.additional_number,
    district: org.district,
    city: org.city,
    postcode: org.postcode,
    country: "SA",
  };
}

function buyerParty(c: Customer): ZatcaParty {
  // ZATCA only accepts Saudi VAT numbers in the buyer VAT field (BR-KSA-44); a foreign buyer's
  // VAT number / TRN is sent as an "other ID" instead.
  const saudiVat = c.country === "SA" && isSaudiVatNumber(c.vat_number) ? c.vat_number : null;
  const otherId = saudiVat ? null : c.id_value || (c.country !== "SA" ? c.vat_number : null);
  return {
    name: c.name_ar || c.name,
    vatNumber: saudiVat,
    idScheme: otherId ? (c.id_value ? c.id_scheme || "OTH" : "OTH") : null,
    idValue: otherId,
    street: c.address_line1,
    building: c.building_number,
    additional: c.additional_number,
    district: c.district,
    city: c.city,
    postcode: c.postcode,
    country: c.country,
  };
}

function category(inv: Pick<Invoice, "vat_treatment">): { category: ZatcaCategory; code: string | null; reason: string | null } {
  switch (inv.vat_treatment) {
    case "standard":
      return { category: "S", code: null, reason: null };
    case "zero_rated":
      return { category: "Z", code: "VATEX-SA-34-1", reason: "The international transport of Goods" };
    default:
      // exempt / reverse charge / outside the scope → not subject to Saudi VAT
      return { category: "O", code: "VATEX-SA-OOS", reason: "Not subject to VAT" };
  }
}

/* ------------------------------------------------------------------ onboarding */

export class ZatcaSetupError extends Error {}

const SAMPLE_BUYER: ZatcaParty = {
  name: "Compliance check buyer",
  vatNumber: "300000000000003",
  street: "Prince Sultan Street",
  building: "4321",
  district: "Al Rawdah",
  city: "Jeddah",
  postcode: "23434",
  country: "SA",
};

/**
 * Connect a Saudi company to ZATCA. `otp` is the one-time code the company generates in the
 * Fatoora portal (fatoora.zatca.gov.sa → Onboard new solution unit/device). Sandbox uses 123345.
 */
export async function onboardZatca(org: Organization, environment: ZatcaEnv, otp: string): Promise<ZatcaStatus> {
  if (!zatcaConfigured()) throw new ZatcaSetupError("not_configured");
  if (!zatcaRequired(org)) throw new ZatcaSetupError("not_saudi");
  if (sellerProblems(org).length) throw new ZatcaSetupError("seller_incomplete");
  if (!/^\d{6}$/.test(otp)) throw new ZatcaSetupError("otp_format");

  const admin = createAdminClient();
  const { data: existing } = await admin.from("hl_zatca_units").select("*").eq("org_id", org.id).maybeSingle<UnitRow>();

  const vat = org.vat_number!;
  const serial = existing?.egs_serial ?? `1-MatrixFleet|2-1.0|3-${randomUUID()}`;
  const commonName = existing?.common_name ?? `MatrixFleet-${org.id.slice(0, 8)}`;
  // VAT groups (11th digit = 1) must use the member's 10-digit TIN as organisation unit
  const orgUnit = vat[10] === "1" ? vat.slice(0, 10) : (org.city || "Main branch").slice(0, 60);
  const location = [org.building_number, org.address_line1, org.district, org.city].filter(Boolean).join(" ").slice(0, 120);
  const orgName = (org.legal_name || org.name).slice(0, 120);

  const key = generateSigningKey();
  const csr = buildCsr({ privateKeyPem: key, environment, commonName, orgUnit, orgName, serial, vatNumber: vat, invoiceTypes: "1100", location, industry: "Transportation" });

  const base = {
    org_id: org.id,
    environment,
    egs_serial: serial,
    common_name: commonName,
    org_unit: orgUnit,
    invoice_types: "1100",
    location,
    industry: "Transportation",
    updated_at: new Date().toISOString(),
  };

  const fail = async (msg: string, checks?: unknown) => {
    await admin.from("hl_zatca_units").upsert({ ...base, status: existing?.status === "active" ? "active" : "failed", last_error: msg.slice(0, 500), ...(checks ? { checks } : {}) });
  };

  let compliance;
  try {
    compliance = await requestComplianceCsid(environment, csr, otp);
  } catch (e) {
    await fail(e instanceof Error ? e.message : "compliance CSID refused");
    throw new ZatcaSetupError("otp_refused");
  }

  // the six compliance documents (invoice types 1100 = standard + simplified)
  const seller = sellerParty(org);
  const docs: [ZatcaKind, ZatcaDocType][] = [
    ["standard", "invoice"], ["standard", "credit_note"], ["standard", "debit_note"],
    ["simplified", "invoice"], ["simplified", "credit_note"], ["simplified", "debit_note"],
  ];
  const checks: NonNullable<ZatcaStatus["checks"]> = [];
  let pih = INITIAL_PIH;
  const [date, time] = nowKsa().split("T");
  for (const [n, [kind, docType]] of docs.entries()) {
    const input: ZatcaInvoiceInput = {
      uuid: randomUUID(),
      number: `CHK-${n + 1}`,
      issueDate: date,
      issueTime: time,
      kind,
      docType,
      icv: n + 1,
      pih,
      supplyDate: date,
      billingReference: docType === "invoice" ? null : "CHK-1",
      reason: docType === "invoice" ? null : "Compliance check",
      seller,
      buyer: kind === "standard" ? SAMPLE_BUYER : null,
      category: "S",
      rate: 15,
      lines: [{ name: "Road freight transport", quantity: 1, unitPrice: 100 }],
    };
    const s = signInvoice(input, key, compliance.binarySecurityToken);
    let r: ZatcaResult;
    try {
      r = await complianceCheck(environment, compliance.binarySecurityToken, compliance.secret, { hash: s.hash, uuid: input.uuid, xml: s.xml });
    } catch (e) {
      r = { ok: false, httpStatus: 0, warnings: [], errors: [{ message: e instanceof Error ? e.message : "network error" }], raw: {} };
    }
    checks.push({ name: `${kind}_${docType}`, ok: r.ok, messages: [...r.errors, ...r.warnings].map(msgText) });
    pih = s.hash;
  }
  if (checks.some((c) => !c.ok)) {
    await fail("compliance checks failed", checks);
    throw new ZatcaSetupError("checks_failed");
  }

  let production;
  try {
    production = await requestProductionCsid(environment, compliance.binarySecurityToken, compliance.secret, compliance.requestID);
  } catch (e) {
    await fail(e instanceof Error ? e.message : "production CSID refused", checks);
    throw new ZatcaSetupError("production_refused");
  }
  const cert = certFromToken(production.binarySecurityToken);
  const sameChain = existing && existing.environment === environment && existing.status === "active";

  const { error } = await admin.from("hl_zatca_units").upsert({
    ...base,
    status: "active",
    private_key_enc: encryptSecret(key),
    csr,
    compliance_token: compliance.binarySecurityToken,
    compliance_secret_enc: encryptSecret(compliance.secret),
    compliance_request_id: compliance.requestID,
    production_token: production.binarySecurityToken,
    production_secret_enc: encryptSecret(production.secret),
    certificate_expires_at: cert.validTo.toISOString(),
    checks,
    // a new environment starts a new invoice chain; renewing keeps the chain
    icv: sameChain ? existing.icv : 0,
    last_hash: sameChain ? existing.last_hash : INITIAL_PIH,
    pending_icv: null,
    pending_since: null,
    last_error: null,
    onboarded_at: new Date().toISOString(),
  });
  if (error) {
    logError("[zatca] storing unit failed", error);
    throw new ZatcaSetupError("store_failed");
  }
  return (await getZatcaStatus(org.id))!;
}

/* ------------------------------------------------------------------ issuing */

export type IssueOutcome =
  | { ok: true; status: "cleared" | "reported" | "warning" | "pending"; messages: string[] }
  | { ok: false; error: "not_onboarded" | "currency" | "buyer_incomplete" | "negative_line" | "busy" | "rejected" | "failed" | "already"; messages: string[]; fields?: BuyerField[] };

const msgText = (m: ZatcaMessage) => [m.code, m.message].filter(Boolean).join(" — ");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sign and submit a draft invoice / credit note to ZATCA. On success the invoice is issued (status
 * "sent"); a rejected standard invoice stays a draft with ZATCA's messages so it can be corrected.
 */
export async function issueZatcaInvoice(org: Organization, invoiceId: string): Promise<IssueOutcome> {
  const admin = createAdminClient();
  const { data: unit } = await admin.from("hl_zatca_units").select("*").eq("org_id", org.id).maybeSingle<UnitRow>();
  if (!unit || unit.status !== "active" || !unit.private_key_enc || !unit.production_token || !unit.production_secret_enc) {
    return { ok: false, error: "not_onboarded", messages: [] };
  }
  const { data: inv } = await admin.from("hl_invoices").select("*").eq("id", invoiceId).eq("org_id", org.id).maybeSingle<Invoice>();
  if (!inv) return { ok: false, error: "failed", messages: ["invoice not found"] };
  if (inv.zatca_status && FINAL.includes(inv.zatca_status)) return { ok: false, error: "already", messages: [] };
  if (inv.zatca_status === "failed" && inv.zatca_xml && inv.zatca_hash && inv.zatca_uuid) {
    // signed and in the chain, but ZATCA never answered → submit the same document again
    return submitStored(org, unit, inv);
  }
  if (inv.currency !== "SAR") return { ok: false, error: "currency", messages: [] };

  const [{ data: lines }, { data: customer }, { data: original }] = await Promise.all([
    admin.from("hl_invoice_lines").select("*").eq("invoice_id", inv.id).order("position").returns<InvoiceLine[]>(),
    inv.customer_id ? admin.from("hl_customers").select("*").eq("id", inv.customer_id).maybeSingle<Customer>() : Promise.resolve({ data: null }),
    inv.original_invoice_id
      ? admin.from("hl_invoices").select("number").eq("id", inv.original_invoice_id).maybeSingle<{ number: string }>()
      : Promise.resolve({ data: null }),
  ]);
  if (!lines?.length || lines.some((l) => Number(l.unit_price) < 0 || Number(l.quantity) < 0)) {
    return { ok: false, error: "negative_line", messages: [] };
  }
  const fields = buyerProblems(customer);
  if (fields.length) return { ok: false, error: "buyer_incomplete", messages: [], fields };

  // reserve counter + previous hash (one invoice at a time per company)
  let reservation: { icv: number; pih: string } | null = null;
  for (let attempt = 0; attempt < 6 && !reservation; attempt++) {
    const { data, error } = await admin.rpc("hl_zatca_reserve", { p_org: org.id });
    if (!error && data?.[0]) reservation = { icv: Number(data[0].icv), pih: data[0].pih };
    else if (error?.message.includes("zatca_busy")) await sleep(800);
    else return { ok: false, error: "failed", messages: [error?.message ?? "reserve failed"] };
  }
  if (!reservation) return { ok: false, error: "busy", messages: [] };

  const kind = invoiceKind(customer);
  const cat = category(inv);
  const [date, time] = nowKsa().split("T");
  const uuid = randomUUID();
  const docType = (inv.doc_type ?? "invoice") as ZatcaDocType;
  let signed;
  try {
    const input: ZatcaInvoiceInput = {
      uuid,
      number: inv.number,
      issueDate: date,
      issueTime: time,
      kind,
      docType,
      icv: reservation.icv,
      pih: reservation.pih,
      supplyDate: inv.supply_date,
      billingReference: original?.number ?? null,
      reason: inv.adjustment_reason,
      seller: sellerParty(org),
      buyer: customer ? buyerParty(customer) : null,
      category: cat.category,
      rate: Number(inv.vat_rate),
      exemptionCode: cat.code,
      exemptionReason: cat.reason,
      lines: lines.map((l) => ({ name: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unit_price) })),
      paymentMeansCode: "30",
    };
    signed = signInvoice(input, decryptSecret(unit.private_key_enc), unit.production_token);
    if (Math.abs(signed.totals.gross - Number(inv.total)) > 0.005 || Math.abs(signed.totals.vat - Number(inv.vat_amount)) > 0.005) {
      throw new Error("totals mismatch");
    }
  } catch (e) {
    await admin.rpc("hl_zatca_release", { p_org: org.id, p_icv: reservation.icv });
    logError("[zatca] signing failed", e);
    return { ok: false, error: "failed", messages: [e instanceof Error ? e.message : "signing failed"] };
  }

  // in the chain from now on (even if ZATCA rejects it)
  const { error: commitErr } = await admin.rpc("hl_zatca_commit", { p_org: org.id, p_icv: reservation.icv, p_hash: signed.hash });
  if (commitErr) {
    logError("[zatca] chain commit failed", commitErr);
    return { ok: false, error: "failed", messages: ["chain conflict, please try again"] };
  }
  const stored: Partial<Invoice> = {
    zatca_kind: kind,
    zatca_status: "pending",
    zatca_uuid: uuid,
    zatca_icv: reservation.icv,
    zatca_hash: signed.hash,
    zatca_pih: reservation.pih,
    zatca_qr: signed.qr,
    zatca_xml: signed.xml,
    zatca_env: unit.environment,
    zatca_issued_at: new Date().toISOString(),
    zatca_messages: null,
    issue_date: date,
  };
  await admin.from("hl_invoices").update(stored).eq("id", inv.id);
  return submitStored(org, unit, { ...inv, ...stored } as Invoice);
}

async function submitStored(org: Organization, unit: UnitRow, inv: Invoice): Promise<IssueOutcome> {
  const admin = createAdminClient();
  const kind = inv.zatca_kind as ZatcaKind;
  const env = unit.environment;
  const secret = decryptSecret(unit.production_secret_enc!);
  const doc = { hash: inv.zatca_hash!, uuid: inv.zatca_uuid!, xml: inv.zatca_xml! };
  const now = new Date().toISOString();
  // a simplified invoice is handed to the customer straight away; a standard one only once cleared
  const issued = { status: "sent" as const, sent_at: inv.sent_at ?? now };

  let r: ZatcaResult;
  try {
    r = kind === "standard" ? await clearInvoice(env, unit.production_token!, secret, doc) : await reportInvoice(env, unit.production_token!, secret, doc);
  } catch (e) {
    logError("[zatca] submission failed", e);
    await admin
      .from("hl_invoices")
      .update({ zatca_status: "failed", zatca_messages: [e instanceof Error ? e.message : "network error"], ...(kind === "simplified" ? issued : {}) })
      .eq("id", inv.id);
    if (kind === "simplified") return { ok: true, status: "pending", messages: ["ZATCA unreachable — will be reported automatically"] };
    return { ok: false, error: "failed", messages: ["ZATCA unreachable — please retry"] };
  }

  const messages = [...r.errors, ...r.warnings].map(msgText);
  if (r.httpStatus >= 500 || r.httpStatus === 429 || r.httpStatus === 0) {
    await admin.from("hl_invoices").update({ zatca_status: "failed", zatca_messages: messages, ...(kind === "simplified" ? issued : {}) }).eq("id", inv.id);
    if (kind === "simplified") return { ok: true, status: "pending", messages };
    return { ok: false, error: "failed", messages };
  }
  if (!r.ok) {
    await admin
      .from("hl_invoices")
      .update({ zatca_status: "rejected", zatca_messages: messages, zatca_submitted_at: now, ...(kind === "simplified" ? issued : {}) })
      .eq("id", inv.id);
    return { ok: false, error: "rejected", messages };
  }

  const status = r.warnings.length ? "warning" : kind === "standard" ? "cleared" : "reported";
  let xml = inv.zatca_xml!;
  let qr = inv.zatca_qr;
  if (kind === "standard" && r.clearedInvoice) {
    xml = Buffer.from(r.clearedInvoice, "base64").toString("utf8");
    qr = qrFromXml(xml) ?? qr;
  }
  await admin
    .from("hl_invoices")
    .update({ zatca_status: status, zatca_messages: messages.length ? messages : null, zatca_submitted_at: now, zatca_xml: xml, zatca_qr: qr, ...issued })
    .eq("id", inv.id);
  await afterIssued(inv);
  return { ok: true, status, messages };
}

/** A credit note for the full amount cancels its original invoice (and frees its jobs). */
async function afterIssued(inv: Invoice) {
  if (inv.doc_type !== "credit_note" || !inv.original_invoice_id) return;
  const admin = createAdminClient();
  const { data: orig } = await admin.from("hl_invoices").select("id,total").eq("id", inv.original_invoice_id).maybeSingle<{ id: string; total: number }>();
  if (orig && Math.abs(Number(orig.total) - Number(inv.total)) < 0.005) {
    await admin.from("hl_invoices").update({ status: "void" }).eq("id", orig.id);
    await admin.from("hl_jobs").update({ invoice_id: null, status: "delivered" }).eq("invoice_id", orig.id);
  }
}

/** Retry simplified invoices that could not be reported yet (24-hour rule). */
export async function retryPendingZatca(orgId?: string) {
  const admin = createAdminClient();
  let q = admin.from("hl_invoices").select("*").eq("zatca_status", "failed").eq("zatca_kind", "simplified").limit(50);
  if (orgId) q = q.eq("org_id", orgId);
  const { data: rows } = await q.returns<Invoice[]>();
  let done = 0;
  for (const inv of rows ?? []) {
    const { data: unit } = await admin.from("hl_zatca_units").select("*").eq("org_id", inv.org_id).maybeSingle<UnitRow>();
    const { data: org } = await admin.from("hl_organizations").select("*").eq("id", inv.org_id).maybeSingle<Organization>();
    if (!unit || !org || unit.status !== "active") continue;
    const r = await submitStored(org, unit, inv);
    if (r.ok && r.status !== "pending") done++;
  }
  return { checked: rows?.length ?? 0, reported: done };
}

export { ZatcaError };
