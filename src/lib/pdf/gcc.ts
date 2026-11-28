import "server-only";
import QRCode from "qrcode";
import { rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** Arabic labels for GCC tax invoices (Saudi invoices must be in Arabic; English is allowed alongside). */
export const AR = {
  taxInvoice: "فاتورة ضريبية",
  simplifiedTaxInvoice: "فاتورة ضريبية مبسطة",
  invoice: "فاتورة",
  creditNote: "إشعار دائن",
  invoiceNo: "رقم الفاتورة",
  creditNoteNo: "رقم الإشعار",
  issueDate: "تاريخ الإصدار",
  supplyDate: "تاريخ التوريد",
  dueDate: "تاريخ الاستحقاق",
  originalInvoice: "الفاتورة الأصلية",
  seller: "المورد",
  buyer: "العميل",
  description: "الوصف",
  qty: "الكمية",
  unitPrice: "سعر الوحدة",
  amount: "المبلغ",
  subtotal: "الإجمالي غير شامل الضريبة",
  vat: "ضريبة القيمة المضافة",
  total: "الإجمالي شامل الضريبة",
  reason: "سبب الإشعار",
  vatNo: "الرقم الضريبي",
  crNo: "السجل التجاري",
} as const;

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

export const hasArabic = (s: string | null | undefined) => !!s && ARABIC.test(s);

/**
 * pdf-lib/fontkit shapes Arabic and lays a right-to-left run out reversed, which also reverses any
 * digits or Latin words inside it. Pre-reversing those left-to-right runs makes them come out right.
 */
export function arText(s: string) {
  if (!hasArabic(s)) return s;
  return s.replace(/[A-Za-z0-9][A-Za-z0-9.,:/\-+@&]*(?:\s+[A-Za-z0-9][A-Za-z0-9.,:/\-+@&]*)*/g, (m) => [...m].reverse().join(""));
}

/** Draw an Arabic label right-aligned at xRight (top-aligned at y like the other helpers). */
export function arRight(page: PDFPage, value: string, xRight: number, y: number, font: PDFFont, size: number, color = rgb(0.4, 0.45, 0.52)) {
  const v = arText(value);
  page.drawText(v, { x: xRight - font.widthOfTextAtSize(v, size), y: y - size, size, font, color });
  return font.widthOfTextAtSize(v, size);
}

export function arLeft(page: PDFPage, value: string, x: number, y: number, font: PDFFont, size: number, color = rgb(0.4, 0.45, 0.52)) {
  const v = arText(value);
  page.drawText(v, { x, y: y - size, size, font, color });
  return font.widthOfTextAtSize(v, size);
}

/** Vector QR code (no image needed). yTop is the top edge. */
export function drawQr(page: PDFPage, payload: string, x: number, yTop: number, size: number) {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  page.drawRectangle({ x, y: yTop - size, width: size, height: size, color: rgb(1, 1, 1) });
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) {
        page.drawRectangle({
          x: x + (c + quiet) * cell,
          y: yTop - (r + quiet + 1) * cell,
          width: cell + 0.05,
          height: cell + 0.05,
          color: rgb(0, 0, 0),
        });
      }
    }
  }
}
