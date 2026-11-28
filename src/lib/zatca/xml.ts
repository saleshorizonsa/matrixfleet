// ZATCA Phase 2 e-invoice (UBL 2.1, KSA profile) — builder, hashing, signing and QR.
//
// The XML is generated already in canonical form (C14N: no self-closing tags, attributes and namespace
// declarations in canonical order, no insignificant whitespace). That way the "invoice hash" — SHA-256
// over the canonical invoice without UBLExtensions, cac:Signature and the QR reference — is simply the
// hash of the assembled string without those three parts, with no XML library needed.
import { certFromToken, certificateHash, sha256b64, sha256hexb64, signInvoiceHash } from "./crypto";
import { qrTlv } from "./qr";

export type ZatcaKind = "standard" | "simplified";
export type ZatcaDocType = "invoice" | "credit_note" | "debit_note";
/** UN/ECE 5305 VAT category: S standard, Z zero-rated, E exempt, O outside the scope */
export type ZatcaCategory = "S" | "Z" | "E" | "O";

export interface ZatcaParty {
  name: string;
  vatNumber?: string | null;
  /** CRN, MOM, MLS, 700, SAG, NAT, GCC, IQA, PAS, OTH */
  idScheme?: string | null;
  idValue?: string | null;
  street?: string | null;
  building?: string | null;
  additional?: string | null;
  district?: string | null;
  city?: string | null;
  postcode?: string | null;
  country: string;
}

export interface ZatcaLine {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ZatcaInvoiceInput {
  uuid: string;
  number: string;
  issueDate: string; // YYYY-MM-DD (Saudi time)
  issueTime: string; // HH:MM:SS (Saudi time)
  kind: ZatcaKind;
  docType: ZatcaDocType;
  icv: number;
  pih: string;
  supplyDate?: string | null;
  /** number of the original invoice (credit / debit notes) */
  billingReference?: string | null;
  /** reason for a credit / debit note */
  reason?: string | null;
  seller: ZatcaParty;
  buyer?: ZatcaParty | null;
  category: ZatcaCategory;
  rate: number;
  exemptionCode?: string | null;
  exemptionReason?: string | null;
  lines: ZatcaLine[];
  /** UN/ECE 4461: 10 cash, 30 credit transfer, 42 bank account, 48 card */
  paymentMeansCode?: string;
  note?: string | null;
}

export interface ZatcaTotals {
  lines: { net: number; vat: number }[];
  net: number;
  vat: number;
  gross: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const a = (n: number) => r2(n).toFixed(2);

export function zatcaTotals(i: Pick<ZatcaInvoiceInput, "lines" | "rate" | "category">): ZatcaTotals {
  const rate = i.category === "S" ? i.rate : 0;
  const lines = i.lines.map((l) => {
    const net = r2(l.quantity * l.unitPrice);
    return { net, vat: r2((net * rate) / 100) };
  });
  const net = r2(lines.reduce((s, l) => s + l.net, 0));
  const vat = r2((net * rate) / 100);
  return { lines, net, vat, gross: r2(net + vat) };
}

/* ------------------------------------------------------------------ escaping (canonical XML) */

const text = (s: string | number) =>
  String(s).replace(/\r/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attrv = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/\t/g, "&#x9;").replace(/\n/g, "&#xA;").replace(/\r/g, "&#xD;");

/** element with optional attributes (already in canonical order) */
function el(name: string, content: string | number | null | undefined, attrs?: [string, string][]): string {
  const at = attrs?.map(([k, v]) => ` ${k}="${attrv(v)}"`).join("") ?? "";
  return `<${name}${at}>${content ?? ""}</${name}>`;
}
const t = (name: string, value: string | number | null | undefined, attrs?: [string, string][]) =>
  value === null || value === undefined || value === "" ? "" : el(name, text(value), attrs);
const amt = (name: string, n: number) => el(name, a(n), [["currencyID", "SAR"]]);

/* ------------------------------------------------------------------ document parts */

const NS_ROOT =
  ' xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"' +
  ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"' +
  ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"' +
  ' xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"';

const TYPE_CODE: Record<ZatcaDocType, string> = { invoice: "388", credit_note: "381", debit_note: "383" };

function address(p: ZatcaParty) {
  return el(
    "cac:PostalAddress",
    t("cbc:StreetName", p.street) +
      t("cbc:BuildingNumber", p.building) +
      t("cbc:PlotIdentification", p.additional) +
      t("cbc:CitySubdivisionName", p.district) +
      t("cbc:CityName", p.city) +
      t("cbc:PostalZone", p.postcode) +
      el("cac:Country", t("cbc:IdentificationCode", p.country)),
  );
}

function party(p: ZatcaParty, role: "seller" | "buyer") {
  const id = p.idValue ? el("cac:PartyIdentification", t("cbc:ID", p.idValue, [["schemeID", p.idScheme || "OTH"]])) : "";
  const tax = el(
    "cac:PartyTaxScheme",
    t("cbc:CompanyID", p.vatNumber) + el("cac:TaxScheme", t("cbc:ID", "VAT")),
  );
  const legal = el("cac:PartyLegalEntity", t("cbc:RegistrationName", p.name));
  const body = id + address(p) + (role === "seller" || p.vatNumber ? tax : "") + legal;
  return el(role === "seller" ? "cac:AccountingSupplierParty" : "cac:AccountingCustomerParty", el("cac:Party", body));
}

function taxCategory(i: ZatcaInvoiceInput, withReason: boolean) {
  const pct = i.category === "S" ? i.rate : 0;
  return el(
    "cac:TaxCategory",
    t("cbc:ID", i.category, [["schemeAgencyID", "6"], ["schemeID", "UN/ECE 5305"]]) +
      t("cbc:Percent", pct.toFixed(2)) +
      (withReason && i.category !== "S"
        ? t("cbc:TaxExemptionReasonCode", i.exemptionCode) + t("cbc:TaxExemptionReason", i.exemptionReason)
        : "") +
      el("cac:TaxScheme", t("cbc:ID", "VAT", [["schemeAgencyID", "6"], ["schemeID", "UN/ECE 5153"]])),
  );
}

function body(i: ZatcaInvoiceInput, tot: ZatcaTotals) {
  const head =
    t("cbc:ProfileID", "reporting:1.0") +
    t("cbc:ID", i.number) +
    t("cbc:UUID", i.uuid) +
    t("cbc:IssueDate", i.issueDate) +
    t("cbc:IssueTime", i.issueTime) +
    t("cbc:InvoiceTypeCode", TYPE_CODE[i.docType], [["name", i.kind === "standard" ? "0100000" : "0200000"]]) +
    t("cbc:Note", i.note, [["languageID", "ar"]]) +
    t("cbc:DocumentCurrencyCode", "SAR") +
    t("cbc:TaxCurrencyCode", "SAR") +
    (i.docType !== "invoice" && i.billingReference
      ? el("cac:BillingReference", el("cac:InvoiceDocumentReference", t("cbc:ID", i.billingReference)))
      : "") +
    el("cac:AdditionalDocumentReference", t("cbc:ID", "ICV") + t("cbc:UUID", i.icv)) +
    el(
      "cac:AdditionalDocumentReference",
      t("cbc:ID", "PIH") + el("cac:Attachment", t("cbc:EmbeddedDocumentBinaryObject", i.pih, [["mimeCode", "text/plain"]])),
    );

  const parties =
    party(i.seller, "seller") +
    (i.buyer ? party(i.buyer, "buyer") : el("cac:AccountingCustomerParty", el("cac:Party", ""))) +
    (i.kind === "standard" || i.supplyDate ? el("cac:Delivery", t("cbc:ActualDeliveryDate", i.supplyDate || i.issueDate)) : "") +
    el(
      "cac:PaymentMeans",
      t("cbc:PaymentMeansCode", i.paymentMeansCode || "30") + (i.docType !== "invoice" ? t("cbc:InstructionNote", i.reason || "Correction") : ""),
    );

  const taxes =
    el("cac:TaxTotal", amt("cbc:TaxAmount", tot.vat)) +
    el(
      "cac:TaxTotal",
      amt("cbc:TaxAmount", tot.vat) +
        el("cac:TaxSubtotal", amt("cbc:TaxableAmount", tot.net) + amt("cbc:TaxAmount", tot.vat) + taxCategory(i, true)),
    ) +
    el(
      "cac:LegalMonetaryTotal",
      amt("cbc:LineExtensionAmount", tot.net) +
        amt("cbc:TaxExclusiveAmount", tot.net) +
        amt("cbc:TaxInclusiveAmount", tot.gross) +
        amt("cbc:AllowanceTotalAmount", 0) +
        amt("cbc:PrepaidAmount", 0) +
        amt("cbc:PayableAmount", tot.gross),
    );

  const pct = (i.category === "S" ? i.rate : 0).toFixed(2);
  const lines = i.lines
    .map((l, n) =>
      el(
        "cac:InvoiceLine",
        t("cbc:ID", n + 1) +
          el("cbc:InvoicedQuantity", trimNum(l.quantity), [["unitCode", "PCE"]]) +
          amt("cbc:LineExtensionAmount", tot.lines[n].net) +
          el("cac:TaxTotal", amt("cbc:TaxAmount", tot.lines[n].vat) + amt("cbc:RoundingAmount", tot.lines[n].net + tot.lines[n].vat)) +
          el(
            "cac:Item",
            t("cbc:Name", l.name.slice(0, 1000)) +
              el("cac:ClassifiedTaxCategory", t("cbc:ID", i.category) + t("cbc:Percent", pct) + el("cac:TaxScheme", t("cbc:ID", "VAT"))),
          ) +
          el("cac:Price", amt("cbc:PriceAmount", l.unitPrice)),
      ),
    )
    .join("");

  return { head, rest: parties + taxes + lines };
}

function trimNum(n: number) {
  return String(Math.round(n * 1e6) / 1e6);
}

const QR_REF = (qr: string) =>
  el("cac:AdditionalDocumentReference", t("cbc:ID", "QR") + el("cac:Attachment", t("cbc:EmbeddedDocumentBinaryObject", qr, [["mimeCode", "text/plain"]])));

const SIGNATURE_REF = el(
  "cac:Signature",
  t("cbc:ID", "urn:oasis:names:specification:ubl:signature:Invoice") + t("cbc:SignatureMethod", "urn:oasis:names:specification:ubl:dsig:enveloped:xades"),
);

const DS = "http://www.w3.org/2000/09/xmldsig#";
const XADES = "http://uri.etsi.org/01903/v1.3.2#";

function signedProperties(signingTime: string, certHash: string, issuer: string, serial: string, forHash: boolean) {
  // Exclusive canonical form, as ZATCA's validator computes it for the xadesSignedProperties reference.
  const ds = forHash ? [["xmlns:ds", DS] as [string, string]] : [];
  return el(
    "xades:SignedProperties",
    el(
      "xades:SignedSignatureProperties",
      t("xades:SigningTime", signingTime) +
        el(
          "xades:SigningCertificate",
          el(
            "xades:Cert",
            el(
              "xades:CertDigest",
              el("ds:DigestMethod", "", [...ds, ["Algorithm", "http://www.w3.org/2001/04/xmlenc#sha256"]]) + t("ds:DigestValue", certHash, ds),
            ) + el("xades:IssuerSerial", t("ds:X509IssuerName", issuer, ds) + t("ds:X509SerialNumber", serial, ds)),
          ),
        ),
    ),
    forHash ? [["xmlns:xades", XADES], ["Id", "xadesSignedProperties"]] : [["Id", "xadesSignedProperties"]],
  );
}

function ublExtensions(p: { invoiceHash: string; propsHash: string; signature: string; cert: string; props: string }) {
  const tr = (xpath: string) => el("ds:Transform", t("ds:XPath", xpath), [["Algorithm", "http://www.w3.org/TR/1999/REC-xpath-19991116"]]);
  const signedInfo = el(
    "ds:SignedInfo",
    el("ds:CanonicalizationMethod", "", [["Algorithm", "http://www.w3.org/2006/12/xml-c14n11"]]) +
      el("ds:SignatureMethod", "", [["Algorithm", "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"]]) +
      el(
        "ds:Reference",
        el(
          "ds:Transforms",
          tr("not(//ancestor-or-self::ext:UBLExtensions)") +
            tr("not(//ancestor-or-self::cac:Signature)") +
            tr("not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])") +
            el("ds:Transform", "", [["Algorithm", "http://www.w3.org/2006/12/xml-c14n11"]]),
        ) +
          el("ds:DigestMethod", "", [["Algorithm", "http://www.w3.org/2001/04/xmlenc#sha256"]]) +
          t("ds:DigestValue", p.invoiceHash),
        [["Id", "invoiceSignedData"], ["URI", ""]],
      ) +
      el(
        "ds:Reference",
        el("ds:DigestMethod", "", [["Algorithm", "http://www.w3.org/2001/04/xmlenc#sha256"]]) + t("ds:DigestValue", p.propsHash),
        [["Type", "http://www.w3.org/2000/09/xmldsig#SignatureProperties"], ["URI", "#xadesSignedProperties"]],
      ),
  );
  const signature = el(
    "ds:Signature",
    signedInfo +
      t("ds:SignatureValue", p.signature) +
      el("ds:KeyInfo", el("ds:X509Data", t("ds:X509Certificate", p.cert))) +
      el("ds:Object", el("xades:QualifyingProperties", p.props, [["xmlns:xades", XADES], ["Target", "signature"]])),
    [["xmlns:ds", DS], ["Id", "signature"]],
  );
  return el(
    "ext:UBLExtensions",
    el(
      "ext:UBLExtension",
      t("ext:ExtensionURI", "urn:oasis:names:specification:ubl:dsig:enveloped:xades") +
        el(
          "ext:ExtensionContent",
          el(
            "sig:UBLDocumentSignatures",
            el(
              "sac:SignatureInformation",
              t("cbc:ID", "urn:oasis:names:specification:ubl:signature:1") +
                t("sbc:ReferencedSignatureID", "urn:oasis:names:specification:ubl:signature:Invoice") +
                signature,
            ),
            [
              ["xmlns:sac", "urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2"],
              ["xmlns:sbc", "urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2"],
              ["xmlns:sig", "urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2"],
            ],
          ),
        ),
    ),
  );
}

/* ------------------------------------------------------------------ public API */

export interface SignedInvoice {
  xml: string;
  /** base64 SHA-256 of the canonical invoice (goes into the next invoice's PIH) */
  hash: string;
  qr: string;
  totals: ZatcaTotals;
}

/** Invoice hash only (used by tests and to verify stored XML). */
export function invoiceHashOf(i: ZatcaInvoiceInput) {
  const tot = zatcaTotals(i);
  const { head, rest } = body(i, tot);
  return sha256b64(`<Invoice${NS_ROOT}>${head}${rest}</Invoice>`);
}

/**
 * Build, hash and sign an e-invoice with the EGS key and its ZATCA certificate
 * (binarySecurityToken). Returns the final XML plus the hash and QR payload.
 */
export function signInvoice(i: ZatcaInvoiceInput, privateKeyPem: string, certToken: string, signingTime = nowKsa()): SignedInvoice {
  const tot = zatcaTotals(i);
  const { head, rest } = body(i, tot);
  const hash = sha256b64(`<Invoice${NS_ROOT}>${head}${rest}</Invoice>`);
  const signature = signInvoiceHash(hash, privateKeyPem);

  const cert = certFromToken(certToken);
  const certHash = certificateHash(cert.base64);
  const timestamp = signingTime;
  const propsHash = sha256hexb64(signedProperties(timestamp, certHash, cert.issuer, cert.serialNumber, true));
  const props = signedProperties(timestamp, certHash, cert.issuer, cert.serialNumber, false);

  const qr = qrTlv([
    i.seller.name,
    i.seller.vatNumber ?? "",
    `${i.issueDate}T${i.issueTime}`,
    a(tot.gross),
    a(tot.vat),
    hash,
    signature,
    cert.publicKey,
    ...(i.kind === "simplified" ? [cert.signature] : []),
  ]);

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<Invoice${NS_ROOT}>` +
    ublExtensions({ invoiceHash: hash, propsHash, signature, cert: cert.base64, props }) +
    head +
    QR_REF(qr) +
    SIGNATURE_REF +
    rest +
    `</Invoice>`;
  return { xml, hash, qr, totals: tot };
}

/** "YYYY-MM-DDTHH:MM:SS" in Saudi time (UTC+3, no daylight saving). */
export function nowKsa(d = new Date()) {
  return new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 19);
}

/** Phase-1 QR (5 fields) for Saudi invoices issued without a ZATCA connection. */
export function phase1Qr(sellerName: string, vatNumber: string, isoTimestamp: string, total: number, vat: number) {
  return qrTlv([sellerName, vatNumber, isoTimestamp, a(total), a(vat)]);
}

/** Read the QR payload back out of a (ZATCA-cleared) XML document. */
export function qrFromXml(xml: string): string | null {
  const m = xml.match(/<cbc:ID>QR<\/cbc:ID><cac:Attachment><cbc:EmbeddedDocumentBinaryObject[^>]*>([^<]+)</) ??
    xml.match(/<cbc:ID>QR<\/cbc:ID>\s*<cac:Attachment>\s*<cbc:EmbeddedDocumentBinaryObject[^>]*>([^<]+)</);
  return m ? m[1].trim() : null;
}
