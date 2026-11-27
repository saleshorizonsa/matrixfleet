import "server-only";
import { PDFDocument, degrees, type PDFPage } from "pdf-lib";
import { embedFonts } from "./fonts";
import { A4, C, box, drawFit, embedImage, fetchImage, hline, rightText, text, wrap } from "./draw";
import { INVOICE_LABELS, pdfDate, pdfLocale, pdfMoney } from "./labels";
import { addressLines, type BuyerSnapshot, type SellerSnapshot } from "@/lib/invoices";
import type { Invoice, InvoiceLine } from "@/lib/types";

export interface InvoicePdfInput {
  invoice: Invoice;
  lines: InvoiceLine[];
  seller: SellerSnapshot;
  buyer: BuyerSnapshot;
  /** optional pre-fetched logo bytes (otherwise seller.logo_url is fetched) */
  logoBytes?: Uint8Array | null;
}

const M = 48; // page margin

export async function buildInvoicePdf({ invoice, lines, seller, buyer, logoBytes }: InvoicePdfInput) {
  const doc = await PDFDocument.create();
  const L = INVOICE_LABELS[pdfLocale(seller.locale)];
  const loc = pdfLocale(seller.locale);
  const { regular, bold } = await embedFonts(doc);
  doc.setTitle(`${L.invoice} ${invoice.number}`);
  doc.setAuthor(seller.legal_name || seller.name);
  doc.setCreator("MatrixFleet · Matrix Infotech Ltd");
  doc.setProducer("MatrixFleet");

  const logo = logoBytes ? await embedImage(doc, logoBytes) : await fetchImage(doc, seller.logo_url);
  const cur = invoice.currency;
  const money = (n: number) => pdfMoney(n, cur, loc);

  const pages: PDFPage[] = [];
  const newPage = () => {
    const p = doc.addPage([A4.w, A4.h]);
    pages.push(p);
    return p;
  };

  let page = newPage();
  const W = A4.w - M * 2;

  // ---- brand bar
  page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: C.brand });
  page.drawRectangle({ x: A4.w - 120, y: A4.h - 6, width: 120, height: 6, color: C.lime });

  // ---- header
  let y = A4.h - M;
  if (logo) {
    drawFit(page, logo, M, y, 170, 56);
  } else {
    text(page, seller.legal_name || seller.name, M, y, { font: bold, size: 18, color: C.ink, maxWidth: 260 });
  }
  text(page, L.invoice.toUpperCase(), M + W - 240, y, { font: bold, size: 24, color: C.ink, maxWidth: 240, align: "right" });
  let hy = y - 34;
  const meta: [string, string][] = [
    [L.invoiceNo, invoice.number],
    [L.issueDate, pdfDate(invoice.issue_date, loc)],
    ...(invoice.supply_date ? ([[L.supplyDate, pdfDate(invoice.supply_date, loc)]] as [string, string][]) : []),
    [L.dueDate, pdfDate(invoice.due_date, loc)],
  ];
  for (const [k, v] of meta) {
    rightText(page, k, M + W - 110, hy, regular, 9, C.muted);
    rightText(page, v, M + W, hy, bold, 9, C.ink);
    hy -= 14;
  }

  // ---- status stamp
  const stamp = invoice.status === "paid" ? L.paid : invoice.status === "void" ? L.void : invoice.status === "draft" ? L.draft : null;
  if (stamp) {
    const color = invoice.status === "paid" ? C.brand : invoice.status === "void" ? C.muted : C.muted;
    page.drawText(stamp, {
      x: A4.w / 2 - bold.widthOfTextAtSize(stamp, 64) / 2 + 30,
      y: A4.h / 2 - 40,
      size: 64,
      font: bold,
      color,
      opacity: 0.12,
      rotate: degrees(30),
    });
  }

  // ---- parties
  y = Math.min(y - 80, hy - 18);
  const colW = (W - 24) / 2;
  const party = (x: number, title: string, name: string, extra: string[]) => {
    let py = text(page, title.toUpperCase(), x, y, { font: bold, size: 7.5, color: C.brand });
    py = text(page, name, x, py - 4, { font: bold, size: 10.5, color: C.ink, maxWidth: colW });
    py = text(page, extra.join("\n"), x, py - 2, { font: regular, size: 9, color: C.text, maxWidth: colW, lineHeight: 12.5 });
    return py;
  };
  const sellerExtra = [
    ...addressLines(seller),
    seller.vat_number ? `${L.vatNo} ${seller.vat_number}` : "",
    seller.company_number ? `${L.companyNo} ${seller.company_number}` : "",
    [seller.email, seller.phone].filter(Boolean).join(" · "),
  ].filter(Boolean);
  const buyerExtra = [
    buyer.contact_name ?? "",
    ...addressLines(buyer),
    buyer.vat_number ? `${L.vatNo} ${buyer.vat_number}` : "",
    buyer.email ?? "",
  ].filter(Boolean);
  const y1 = party(M, L.from, seller.legal_name || seller.name, sellerExtra);
  const y2 = party(M + colW + 24, L.billTo, buyer.name, buyerExtra);
  y = Math.min(y1, y2) - 22;

  // ---- line table
  const cols = { desc: M + 10, qty: M + W - 200, unit: M + W - 95, amount: M + W - 10 };
  const descW = cols.qty - 60 - cols.desc;
  const tableHeader = () => {
    box(page, M, y, W, 22, { fill: C.soft });
    text(page, L.description, cols.desc, y - 6.5, { font: bold, size: 8, color: C.muted });
    rightText(page, L.qty, cols.qty, y - 6.5, bold, 8, C.muted);
    rightText(page, L.unitPrice, cols.unit, y - 6.5, bold, 8, C.muted);
    rightText(page, L.amount, cols.amount, y - 6.5, bold, 8, C.muted);
    y -= 22;
  };
  tableHeader();
  for (const line of [...lines].sort((a, b) => a.position - b.position)) {
    const descLines = wrap(regular, line.description, 9, descW);
    const rowH = Math.max(1, descLines.length) * 12.5 + 12;
    if (y - rowH < 140) {
      page = newPage();
      y = A4.h - M;
      tableHeader();
    }
    text(page, descLines.join("\n"), cols.desc, y - 6, { font: regular, size: 9, lineHeight: 12.5 });
    rightText(page, fmtQty(line.quantity, loc), cols.qty, y - 6, regular, 9);
    rightText(page, money(line.unit_price), cols.unit, y - 6, regular, 9);
    rightText(page, money(line.amount), cols.amount, y - 6, bold, 9, C.ink);
    y -= rowH;
    hline(page, M, M + W, y);
  }

  // ---- totals
  const need = 120 + (invoice.vat_note ? 40 : 0) + (invoice.notes ? 50 : 0) + 90;
  if (y - need < 60) {
    page = newPage();
    y = A4.h - M;
  }
  y -= 12;
  const tx = M + W - 230;
  const row = (label: string, value: string, b = false) => {
    text(page, label, tx, y, { font: b ? bold : regular, size: 9.5, color: b ? C.ink : C.muted });
    rightText(page, value, M + W, y, b ? bold : regular, 9.5, C.ink);
    y -= 17;
  };
  row(L.subtotal, money(invoice.subtotal));
  row(`${L.vat} ${fmtQty(invoice.vat_rate, loc)}%`, money(invoice.vat_amount));
  y -= 4;
  box(page, tx - 10, y + 4, 240, 30, { fill: C.ink });
  text(page, L.amountDue, tx, y - 5, { font: bold, size: 10, color: C.white });
  rightText(page, money(invoice.total), M + W - 4, y - 4, bold, 13, C.lime);
  y -= 44;

  // ---- VAT note
  if (invoice.vat_note) {
    const noteLines = wrap(regular, invoice.vat_note, 8.5, W - 24);
    const h = noteLines.length * 11.5 + 14;
    box(page, M, y, W, h, { fill: C.soft });
    page.drawRectangle({ x: M, y: y - h, width: 3, height: h, color: C.brand });
    text(page, noteLines.join("\n"), M + 12, y - 7, { font: regular, size: 8.5, lineHeight: 11.5, color: C.text });
    y -= h + 14;
  }

  // ---- notes
  if (invoice.notes) {
    y = text(page, L.notes.toUpperCase(), M, y, { font: bold, size: 7.5, color: C.brand });
    y = text(page, invoice.notes, M, y - 3, { font: regular, size: 9, maxWidth: W, lineHeight: 12.5, maxLines: 6 }) - 12;
  }

  // ---- payment details
  const bank: [string, string | null][] = [
    [L.bank, seller.bank_name],
    [L.iban, seller.bank_iban],
    [L.bic, seller.bank_bic],
    [L.sortCode, seller.bank_sort_code],
    [L.account, seller.bank_account],
    [L.paymentRef, invoice.number],
  ];
  const shown = bank.filter(([, v]) => v);
  if (y < 130) {
    page = newPage();
    y = A4.h - M;
  }
  y = text(page, L.paymentDetails.toUpperCase(), M, y, { font: bold, size: 7.5, color: C.brand }) - 4;
  for (const [k, v] of shown) {
    text(page, k, M, y, { font: regular, size: 9, color: C.muted });
    text(page, v!, M + 110, y, { font: bold, size: 9, color: C.ink });
    y -= 13;
  }
  const days = Math.max(0, Math.round((new Date(invoice.due_date).getTime() - new Date(invoice.issue_date).getTime()) / 86_400_000));
  text(page, L.paymentTerms(days), M, y - 4, { font: regular, size: 8.5, color: C.muted, maxWidth: W });

  // ---- footers
  pages.forEach((p, i) => {
    hline(p, M, A4.w - M, 40);
    text(p, L.footer, M, 32, { font: regular, size: 7.5, color: C.muted });
    rightText(p, `${invoice.number} · ${L.page} ${i + 1}/${pages.length}`, A4.w - M, 32, regular, 7.5, C.muted);
  });

  return doc.save();
}

function fmtQty(n: number, loc: string) {
  const intl = { en: "en-GB", de: "de-DE", fr: "fr-FR", es: "es-ES", pl: "pl-PL" }[loc] ?? "en-GB";
  return new Intl.NumberFormat(intl, { maximumFractionDigits: 2 }).format(Number(n)).replace(/[  ]/g, " ");
}
