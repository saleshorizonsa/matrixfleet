import "server-only";
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { embedFonts } from "./fonts";
import { A4, C, box, drawFit, embedImage, rightText, text, wrap } from "./draw";
import { CMR_LABELS, cmrLabel, pdfDate, pdfDateTime, pdfLocale, type CmrKey, type PdfLocale } from "./labels";
import { country } from "@/lib/countries";
import type { Customer, Job, Organization } from "@/lib/types";

export interface CmrPdfInput {
  job: Job;
  org: Organization;
  customer: Customer | null;
  driverName?: string | null;
  vehicleRegistration?: string | null;
  signatureBytes?: Uint8Array | null;
  logoBytes?: Uint8Array | null;
}

const M = 28;

export async function buildCmrPdf(input: CmrPdfInput) {
  const { job, org, customer } = input;
  const loc = pdfLocale(org.locale);
  const doc = await PDFDocument.create();
  const { regular, bold } = await embedFonts(doc);
  doc.setTitle(`CMR ${job.reference}`);
  doc.setAuthor(org.legal_name || org.name);
  doc.setCreator("Haulora · Matrix Infotech Ltd");

  const page = doc.addPage([A4.w, A4.h]);
  const W = A4.w - M * 2;
  const half = W / 2;
  const signature = input.signatureBytes ? await embedImage(doc, input.signatureBytes) : null;
  const logo = input.logoBytes ? await embedImage(doc, input.logoBytes) : null;

  const cell = (x: number, yTop: number, w: number, h: number, num: string, key: CmrKey, content?: string | null, contentBold = false) => {
    box(page, x, yTop, w, h, { border: C.ink, width: 0.6 });
    const label = `${num}  ${cmrLabel(loc, key)}`;
    const labelLines = Math.min(3, wrap(regular, label, 6, w - 8).length);
    text(page, label, x + 4, yTop - 3, { font: regular, size: 6, color: C.muted, maxWidth: w - 8, maxLines: 3, lineHeight: 7 });
    if (content) {
      text(page, content, x + 6, yTop - 6 - labelLines * 7, {
        font: contentBold ? bold : regular,
        size: 8.5,
        color: C.ink,
        maxWidth: w - 12,
        lineHeight: 10.5,
        maxLines: Math.max(1, Math.floor((h - 10 - labelLines * 7) / 10.5)),
      });
    }
  };

  const ctry = (c?: string | null) => (c ? country(c)?.name ?? c : "");
  const join = (...p: (string | null | undefined)[]) => p.filter(Boolean).join("\n");
  const cityLine = (pc?: string | null, city?: string | null, c?: string | null) =>
    [[pc, city].filter(Boolean).join(" "), ctry(c)].filter(Boolean).join(", ");

  // ---- sender: the customer (consignor); falls back to pickup party
  const sender = customer
    ? join(customer.name, customer.address_line1, customer.address_line2, cityLine(customer.postcode, customer.city, customer.country), customer.vat_number ? `VAT ${customer.vat_number}` : null)
    : join(job.pickup_name, job.pickup_address, cityLine(job.pickup_postcode, job.pickup_city, job.pickup_country));
  const consignee = join(job.delivery_name, job.delivery_address, cityLine(job.delivery_postcode, job.delivery_city, job.delivery_country), job.delivery_contact, job.delivery_phone);
  const carrier = join(
    org.legal_name || org.name,
    org.address_line1,
    cityLine(org.postcode, org.city, org.country),
    org.vat_number ? `VAT ${org.vat_number}` : null,
    [input.vehicleRegistration, input.driverName].filter(Boolean).join(" · ") || null,
  );
  const placeDelivery = join(job.delivery_name !== job.delivery_address ? job.delivery_address : null, cityLine(job.delivery_postcode, job.delivery_city, job.delivery_country));
  const takenOverDate = job.picked_up_at ?? job.pickup_from ?? job.scheduled_date;
  const placeTakeover = join(cityLine(job.pickup_postcode, job.pickup_city, job.pickup_country), takenOverDate ? `${CMR_LABELS[loc].date}: ${pdfDate(takenOverDate, loc)}` : null);

  let y = A4.h - M;

  // ---- Row A: sender | title block
  const rA = 90;
  cell(M, y, half, rA, "1", "b1", sender);
  box(page, M + half, y, half, rA, { border: C.ink, width: 0.6 });
  page.drawRectangle({ x: M + half + 0.6, y: y - rA + 0.6, width: half - 1.2, height: rA - 1.2, color: C.soft });
  if (logo) drawFit(page, logo, M + half + half - 76, y - 6, 68, 24, "right");
  text(page, CMR_LABELS[loc].title, M + half + 8, y - 6, { font: bold, size: 22, color: C.ink });
  text(page, cmrLabel(loc, "subtitle"), M + half + 66, y - 8, { font: bold, size: 7.5, color: C.ink, maxWidth: half - (logo ? 150 : 76), lineHeight: 9, maxLines: 2 });
  text(page, `${CMR_LABELS[loc].reference}: ${job.reference}${job.customer_ref ? ` · PO ${job.customer_ref}` : ""}`, M + half + 8, y - 36, { font: bold, size: 8.5, color: C.brand, maxWidth: half - 16, maxLines: 1 });
  text(page, CMR_LABELS[loc].convention, M + half + 8, y - 50, { font: regular, size: 6, color: C.muted, maxWidth: half - 16, lineHeight: 7.2, maxLines: 4 });
  y -= rA;

  // ---- Row B: consignee | carrier
  const rB = 74;
  cell(M, y, half, rB, "2", "b2", consignee);
  cell(M + half, y, half, rB, "16", "b16", carrier);
  y -= rB;

  // ---- Row C/D/E
  const rC = 46;
  cell(M, y, half, rC, "3", "b3", placeDelivery);
  cell(M + half, y, half, rC, "17", "b17", null);
  y -= rC;
  cell(M, y, half, rC, "4", "b4", placeTakeover);
  cell(M + half, y, half, rC + 36, "18", "b18", job.status === "delivered" || job.status === "invoiced" ? job.pod_notes : null);
  y -= rC;
  cell(M, y, half, 36, "5", "b5", job.customer_ref ? `PO ${job.customer_ref}` : null);
  y -= 36;

  // ---- goods table 6–12
  const rG = 150;
  const gc: [string, CmrKey, number][] = [
    ["6", "b6", 0.13],
    ["7", "b7", 0.11],
    ["8", "b8", 0.13],
    ["9", "b9", 0.29],
    ["10", "b10", 0.1],
    ["11", "b11", 0.12],
    ["12", "b12", 0.12],
  ];
  const nature = join(
    job.goods_description,
    job.adr ? `${CMR_LABELS[loc].adr}${job.adr_un_number ? ` — UN ${job.adr_un_number}` : ""}` : null,
    job.temperature_controlled ? CMR_LABELS[loc].tempControlled : null,
  );
  const goodsValues: Record<string, string | null> = {
    b6: job.reference,
    b7: job.pallets != null ? String(job.pallets) : null,
    b8: job.pallets != null ? CMR_LABELS[loc].pallets : null,
    b9: nature,
    b10: null,
    b11: job.weight_kg != null ? fmt(job.weight_kg, loc) : null,
    b12: job.volume_m3 != null ? fmt(job.volume_m3, loc) : null,
  };
  let gx = M;
  for (const [num, key, frac] of gc) {
    const w = W * frac;
    cell(gx, y, w, rG, num, key, goodsValues[key], key === "b9");
    gx += w;
  }
  if (job.adr) {
    page.drawRectangle({ x: M + W - 64, y: y - rG + 6, width: 58, height: 16, color: C.ink });
    text(page, "ADR", M + W - 64, y - rG + 20, { font: bold, size: 9, color: C.lime, maxWidth: 58, align: "center" });
  }
  y -= rG;

  // ---- Row F: 13 instructions | 19 special agreements / 20 to be paid by
  const rF = 74;
  cell(M, y, half, rF, "13", "b13", job.notes);
  cell(M + half, y, half, rF / 2, "19", "b19", null);
  cell(M + half, y - rF / 2, half, rF / 2, "20", "b20", customer?.name ?? null);
  y -= rF;

  // ---- Row G: 14 payment | 15 COD
  const rGp = 34;
  cell(M, y, half, rGp, "14", "b14", CMR_LABELS[loc].carriagePaid);
  cell(M + half, y, half, rGp, "15", "b15", null);
  y -= rGp;

  // ---- Row H: 21 established
  const rH = 32;
  const estDate = job.picked_up_at ?? job.scheduled_date ?? job.created_at;
  cell(M, y, W, rH, "21", "b21", `${org.city ?? ctry(org.country)} · ${pdfDate(estDate, loc)}`);
  y -= rH;

  // ---- Row I: signatures 22 | 23 | 24
  const rI = 150;
  const third = W / 3;
  cell(M, y, third, rI, "22", "b22", null);
  cell(M + third, y, third, rI, "23", "b23", join(org.legal_name || org.name, input.driverName));
  cell(M + third * 2, y, third, rI, "24", "b24", null);
  if (job.delivered_at || job.pod_signed_by || signature) {
    drawPod(page, signature, M + third * 2 + 6, y - 22, third - 12, rI - 28, loc, job, regular, bold);
  }
  y -= rI;

  // ---- footer
  text(page, "Generated with Haulora · Powered by Matrix Infotech Ltd", M, y - 10, { font: regular, size: 7, color: C.muted });
  rightText(page, `${job.reference}`, M + W, y - 10, regular, 7, C.muted);

  return doc.save();
}

function drawPod(page: PDFPage, sig: PDFImage | null, x: number, yTop: number, w: number, h: number, loc: PdfLocale, job: Job, regular: PDFFont, bold: PDFFont) {
  let y = yTop;
  if (sig) {
    const ih = drawFit(page, sig, x, y, w, h - 34);
    y -= ih + 4;
  } else {
    y -= h - 34;
  }
  if (job.pod_signed_by) {
    y = text(page, `${CMR_LABELS[loc].receivedBy}: ${job.pod_signed_by}`, x, y, { font: bold, size: 8, color: C.ink, maxWidth: w, maxLines: 2 });
  }
  if (job.delivered_at) {
    text(page, pdfDateTime(job.delivered_at, loc), x, y - 1, { font: regular, size: 8, color: C.text, maxWidth: w });
  }
}

function fmt(n: number, loc: string) {
  const intl = { en: "en-GB", de: "de-DE", fr: "fr-FR", es: "es-ES", pl: "pl-PL" }[loc] ?? "en-GB";
  return new Intl.NumberFormat(intl, { maximumFractionDigits: 2 }).format(Number(n)).replace(/[  ]/g, " ");
}
