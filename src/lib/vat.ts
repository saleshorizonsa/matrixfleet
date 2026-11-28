// MatrixFleet VAT engine for road freight transport services (UK + EU).
//
// IMPORTANT: this is GUIDANCE, not tax advice. The suggestion is pre-filled on
// the invoice form and the user can always override the treatment, rate and
// note. Rules implemented (services = transport of goods by road):
//
//  B2B (customer is a business):
//   1. Domestic supply (seller and buyer in the same country) → standard rate of
//      the seller's country.
//        - UK: if the transport leg itself is international (goods leave or
//          enter the UK) → zero-rated, VAT Act 1994 Sch 8 Group 8.
//        - EU: if the transport is directly linked to the export/import of goods
//          to/from outside the EU → exempt, Art. 144/146 Directive 2006/112/EC.
//   2. UK seller → business customer outside the UK → outside the scope of UK
//      VAT. B2B general rule: place of supply is where the customer belongs
//      (VATA 1994 s.7A); the customer accounts for any local VAT.
//   3. EU seller → business in ANOTHER EU member state with a VAT number →
//      reverse charge, Art. 196 Directive 2006/112/EC. Both VAT numbers must be
//      shown on the invoice and the buyer's number should be verified in VIES.
//      Without a VAT number the customer is treated as a consumer (rule 5).
//   4. EU seller → business outside the EU (incl. UK) → not subject to EU VAT;
//      place of supply is the customer's country (Art. 44).
//  B2C (consumer):
//   5. Seller's standard rate. For intra-EU transport of goods for consumers
//      the place of supply is the place of DEPARTURE (Art. 50), so if the goods
//      depart from another member state that state's rate applies (the seller
//      may need a VAT registration there).
//  GCC sellers (Saudi Arabia, UAE, Bahrain, Oman — GCC Unified VAT Agreement):
//   6. Goods transported into or out of the seller's country (international
//      transport) → zero-rated (KSA: Art. 33 VAT Implementing Regulations;
//      UAE: Art. 45 Federal Decree-Law No. 8 of 2017; Bahrain and Oman: the
//      international transport zero-rating in their VAT laws).
//   7. Transport inside the seller's country → seller's standard rate
//      (15% KSA, 5% UAE, 10% Bahrain, 5% Oman), B2B and B2C alike.
//   8. Qatar and Kuwait have no VAT in force → no VAT charged.
//  Other sellers (e.g. NO, CH): seller's standard rate, no special rules built-in.

import { country, currencyDecimals, hasVat, isEU, isGCC } from "./countries";
import type { VatTreatment } from "./types";

export type VatRule =
  | "domestic"
  | "uk_zero_rated_international"
  | "eu_export_exempt"
  | "uk_outside_scope"
  | "eu_reverse_charge"
  | "eu_reverse_charge_unverified"
  | "eu_outside_eu"
  | "b2c_seller_rate"
  | "b2c_eu_departure"
  | "gcc_domestic"
  | "gcc_international_zero"
  | "gcc_no_vat"
  | "other_seller";

export interface VatInput {
  sellerCountry: string;
  sellerVatRate: number;
  buyerCountry: string;
  buyerKind: "business" | "individual";
  buyerVatNumber?: string | null;
  buyerVatVerified?: boolean;
  pickupCountry?: string | null;
  deliveryCountry?: string | null;
  /** language of the legal note (organisation locale) */
  locale?: string;
}

export interface VatSuggestion {
  treatment: VatTreatment;
  rate: number;
  legalNote: string | null;
  rule: VatRule;
  /** English explanation for logs / tooltips; UI translates `rule` instead */
  explanation: string;
}

type NoteKey = "zero_rated" | "eu_export_exempt" | "uk_outside_scope" | "reverse_charge" | "outside_eu";

export const VAT_NOTES: Record<string, Record<NoteKey, string>> = {
  en: {
    zero_rated: "Zero-rated — international transport of goods (VAT Act 1994, Schedule 8, Group 8).",
    eu_export_exempt: "VAT exempt — transport services related to the export/import of goods (Art. 144/146 Council Directive 2006/112/EC).",
    uk_outside_scope: "Outside the scope of UK VAT — place of supply is the customer's country (VATA 1994 s.7A). The customer accounts for any VAT due.",
    reverse_charge: "Reverse charge — Article 196 Council Directive 2006/112/EC. VAT to be accounted for by the recipient.",
    outside_eu: "Not subject to EU VAT — place of supply outside the EU (Art. 44 Council Directive 2006/112/EC).",
  },
  de: {
    zero_rated: "Nullsatz — internationale Güterbeförderung (VAT Act 1994, Schedule 8, Group 8).",
    eu_export_exempt: "Steuerfrei — Beförderungsleistung im Zusammenhang mit Aus-/Einfuhr (Art. 144/146 MwStSystRL 2006/112/EG).",
    uk_outside_scope: "Nicht im Anwendungsbereich der britischen MwSt. — Leistungsort ist das Land des Kunden. Der Kunde schuldet die Steuer.",
    reverse_charge: "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge) — Art. 196 MwStSystRL 2006/112/EG.",
    outside_eu: "Nicht im Inland steuerbar — Leistungsort außerhalb der EU (Art. 44 MwStSystRL 2006/112/EG).",
  },
  fr: {
    zero_rated: "Taux zéro — transport international de marchandises (VAT Act 1994, annexe 8, groupe 8).",
    eu_export_exempt: "Exonération de TVA — prestations de transport liées à l'exportation/importation (art. 144/146 directive 2006/112/CE).",
    uk_outside_scope: "Hors champ de la TVA britannique — lieu de prestation dans le pays du client. TVA due par le client.",
    reverse_charge: "Autoliquidation — article 196 de la directive 2006/112/CE. TVA due par le preneur.",
    outside_eu: "TVA non applicable — lieu de prestation hors UE (art. 44 directive 2006/112/CE).",
  },
  es: {
    zero_rated: "Tipo cero — transporte internacional de mercancías (VAT Act 1994, anexo 8, grupo 8).",
    eu_export_exempt: "Exento de IVA — servicios de transporte vinculados a exportación/importación (art. 144/146 Directiva 2006/112/CE).",
    uk_outside_scope: "No sujeto al IVA británico — el lugar de prestación es el país del cliente. El cliente liquida el impuesto.",
    reverse_charge: "Inversión del sujeto pasivo — artículo 196 de la Directiva 2006/112/CE.",
    outside_eu: "No sujeto a IVA de la UE — lugar de prestación fuera de la UE (art. 44 Directiva 2006/112/CE).",
  },
  pl: {
    zero_rated: "Stawka zerowa — międzynarodowy transport towarów (VAT Act 1994, Schedule 8, Group 8).",
    eu_export_exempt: "Zwolnione z VAT — usługi transportowe związane z eksportem/importem towarów (art. 144/146 dyrektywy 2006/112/WE).",
    uk_outside_scope: "Poza zakresem brytyjskiego VAT — miejscem świadczenia jest kraj nabywcy. Podatek rozlicza nabywca.",
    reverse_charge: "Odwrotne obciążenie — art. 196 dyrektywy Rady 2006/112/WE.",
    outside_eu: "Nie podlega VAT w UE — miejsce świadczenia poza UE (art. 44 dyrektywy 2006/112/WE).",
  },
};

export function vatNote(key: NoteKey, locale = "en") {
  return (VAT_NOTES[locale] ?? VAT_NOTES.en)[key];
}

// GCC legal notes (English + Arabic; Saudi tax invoices must also be in Arabic).
type GccNoteKey = "international" | "no_vat";
const GCC_NOTES: Record<string, Record<GccNoteKey, { en: string; ar: string }>> = {
  SA: {
    international: {
      en: "Zero-rated — international transport of goods (Article 33, KSA VAT Implementing Regulations).",
      ar: "خاضع لنسبة الصفر — نقل دولي للسلع (المادة 33 من اللائحة التنفيذية لنظام ضريبة القيمة المضافة).",
    },
    no_vat: { en: "", ar: "" },
  },
  AE: {
    international: {
      en: "Zero-rated — international transport of goods (Article 45, Federal Decree-Law No. 8 of 2017 on VAT).",
      ar: "خاضع لنسبة الصفر — النقل الدولي للبضائع (المادة 45 من المرسوم بقانون اتحادي رقم 8 لسنة 2017).",
    },
    no_vat: { en: "", ar: "" },
  },
  BH: {
    international: {
      en: "Zero-rated — international transport of goods (Bahrain VAT Law, Decree-Law No. 48 of 2018).",
      ar: "خاضع لنسبة الصفر — النقل الدولي للبضائع (قانون ضريبة القيمة المضافة، المرسوم بقانون رقم 48 لسنة 2018).",
    },
    no_vat: { en: "", ar: "" },
  },
  OM: {
    international: {
      en: "Zero-rated — international transport of goods (Oman VAT Law, Royal Decree No. 121/2020).",
      ar: "خاضع لنسبة الصفر — النقل الدولي للبضائع (قانون ضريبة القيمة المضافة، المرسوم السلطاني رقم 121/2020).",
    },
    no_vat: { en: "", ar: "" },
  },
  QA: {
    international: { en: "", ar: "" },
    no_vat: { en: "No VAT charged — VAT is not in force in Qatar.", ar: "لا تُفرض ضريبة القيمة المضافة — الضريبة غير مطبقة في دولة قطر." },
  },
  KW: {
    international: { en: "", ar: "" },
    no_vat: { en: "No VAT charged — VAT is not in force in Kuwait.", ar: "لا تُفرض ضريبة القيمة المضافة — الضريبة غير مطبقة في دولة الكويت." },
  },
};

/** English (or bilingual for Saudi Arabia) GCC legal note. */
export function gccNote(sellerCountry: string, key: GccNoteKey) {
  const n = GCC_NOTES[sellerCountry.toUpperCase()]?.[key];
  if (!n || !n.en) return null;
  return sellerCountry.toUpperCase() === "SA" ? `${n.en}\n${n.ar}` : n.en;
}

const up = (c?: string | null) => (c ?? "").trim().toUpperCase();

export function suggestVatTreatment(input: VatInput): VatSuggestion {
  const seller = up(input.sellerCountry) || "GB";
  const buyer = up(input.buyerCountry) || seller;
  const pickup = up(input.pickupCountry) || seller;
  const delivery = up(input.deliveryCountry) || buyer;
  const locale = input.locale ?? "en";
  const rate = Number(input.sellerVatRate) || 0;
  const hasVatNo = !!input.buyerVatNumber && input.buyerVatNumber.trim().length > 3;
  const isBusiness = input.buyerKind === "business";
  const sellerEU = isEU(seller);

  const std = (rule: VatRule, explanation: string, r = rate): VatSuggestion => ({
    treatment: "standard",
    rate: r,
    legalNote: null,
    rule,
    explanation,
  });

  // --- UK seller -----------------------------------------------------------
  if (seller === "GB") {
    if (isBusiness && buyer !== "GB") {
      return {
        treatment: "outside_scope",
        rate: 0,
        legalNote: vatNote("uk_outside_scope", locale),
        rule: "uk_outside_scope",
        explanation: "UK supplier, business customer outside the UK: place of supply is the customer's country.",
      };
    }
    if (isBusiness && (pickup !== "GB" || delivery !== "GB")) {
      return {
        treatment: "zero_rated",
        rate: 0,
        legalNote: vatNote("zero_rated", locale),
        rule: "uk_zero_rated_international",
        explanation: "UK business customer, goods transported to/from outside the UK: zero-rated.",
      };
    }
    if (!isBusiness) return std("b2c_seller_rate", "Consumer customer: UK standard rate.");
    return std("domestic", "Domestic UK supply: standard rate.");
  }

  // --- EU seller -----------------------------------------------------------
  if (sellerEU) {
    const buyerEU = isEU(buyer);
    if (isBusiness && buyer === seller) {
      if (!isEU(pickup) || !isEU(delivery)) {
        return {
          treatment: "exempt",
          rate: 0,
          legalNote: vatNote("eu_export_exempt", locale),
          rule: "eu_export_exempt",
          explanation: "Domestic business customer, transport linked to export/import outside the EU: exempt (check national rules).",
        };
      }
      return std("domestic", "Domestic supply: seller's standard rate.");
    }
    if (isBusiness && buyerEU && hasVatNo) {
      return {
        treatment: "reverse_charge",
        rate: 0,
        legalNote: vatNote("reverse_charge", locale),
        rule: input.buyerVatVerified ? "eu_reverse_charge" : "eu_reverse_charge_unverified",
        explanation: input.buyerVatVerified
          ? "Business customer in another EU state with a verified VAT number: reverse charge."
          : "Reverse charge — verify the customer's VAT number in VIES before issuing.",
      };
    }
    if (isBusiness && !buyerEU) {
      return {
        treatment: "outside_scope",
        rate: 0,
        legalNote: vatNote("outside_eu", locale),
        rule: "eu_outside_eu",
        explanation: "Business customer outside the EU: not subject to EU VAT.",
      };
    }
    // consumer (or EU business without VAT number)
    if (isEU(pickup) && pickup !== seller) {
      const depRate = country(pickup)?.vat ?? rate;
      return std(
        "b2c_eu_departure",
        `Consumer, intra-EU transport: place of supply is the departure state (${pickup}) — ${depRate}% applies; you may need a VAT registration there.`,
        depRate,
      );
    }
    return std("b2c_seller_rate", "Consumer customer: seller's standard rate.");
  }

  // --- GCC sellers ----------------------------------------------------------
  if (isGCC(seller)) {
    if (!hasVat(seller)) {
      return {
        treatment: "outside_scope",
        rate: 0,
        legalNote: gccNote(seller, "no_vat"),
        rule: "gcc_no_vat",
        explanation: "No VAT system in force in the seller's country.",
      };
    }
    const sellerRate = rate || country(seller)?.vat || 0;
    if (pickup !== seller || delivery !== seller) {
      return {
        treatment: "zero_rated",
        rate: 0,
        legalNote: gccNote(seller, "international"),
        rule: "gcc_international_zero",
        explanation: "Goods transported into or out of the seller's country: international transport is zero-rated.",
      };
    }
    return std("gcc_domestic", "Transport within the seller's country: standard rate.", sellerRate);
  }

  // --- Other sellers (NO, CH, …) ------------------------------------------
  return std("other_seller", "No specific rules for this seller country — standard rate pre-filled.");
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Round to the currency's minor unit (2 decimals, 3 for KWD/BHD/OMR). */
export function roundTo(n: number, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export interface LineInput {
  quantity: number;
  unit_price: number;
}

export function computeTotals(lines: LineInput[], vatRate: number, currency?: string) {
  const d = currencyDecimals(currency);
  const r = (n: number) => roundTo(n, d);
  const amounts = lines.map((l) => r((Number(l.quantity) || 0) * (Number(l.unit_price) || 0)));
  const subtotal = r(amounts.reduce((a, b) => a + b, 0));
  const vat_amount = r((subtotal * (Number(vatRate) || 0)) / 100);
  return { amounts, subtotal, vat_amount, total: r(subtotal + vat_amount) };
}

export const VAT_TREATMENTS: VatTreatment[] = ["standard", "zero_rated", "exempt", "reverse_charge", "outside_scope"];
