import "server-only";
import { rgb, type PDFDocument, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";

export const A4 = { w: 595.28, h: 841.89 };

export const C = {
  ink: rgb(0.04, 0.08, 0.19),
  text: rgb(0.12, 0.14, 0.2),
  muted: rgb(0.42, 0.45, 0.52),
  line: rgb(0.86, 0.88, 0.92),
  soft: rgb(0.965, 0.97, 0.985),
  brand: rgb(0.357, 0.357, 0.969),
  lime: rgb(0.776, 0.957, 0.196),
  white: rgb(1, 1, 1),
};

/** Replace characters the font cannot encode (rare emoji etc.) with "?" */
export function safe(font: PDFFont, text: string) {
  const chars = font.getCharacterSet();
  const set = new Set(chars);
  let out = "";
  for (const ch of text.replace(/\r/g, "")) {
    const cp = ch.codePointAt(0)!;
    out += ch === "\n" || set.has(cp) ? ch : "?";
  }
  return out;
}

export function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of safe(font, text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        cur = next;
      } else {
        if (cur) lines.push(cur);
        // hard-break very long words
        let word = w;
        while (font.widthOfTextAtSize(word, size) > maxWidth && word.length > 1) {
          let i = word.length - 1;
          while (i > 1 && font.widthOfTextAtSize(word.slice(0, i), size) > maxWidth) i--;
          lines.push(word.slice(0, i));
          word = word.slice(i);
        }
        cur = word;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

export interface TextOpts {
  font: PDFFont;
  size?: number;
  color?: RGB;
  maxWidth?: number;
  lineHeight?: number;
  maxLines?: number;
  align?: "left" | "right" | "center";
}

/** Draws (wrapped) text with its top at `y`. Returns the y below the last line. */
export function text(page: PDFPage, value: string | null | undefined, x: number, y: number, o: TextOpts) {
  if (value === null || value === undefined || value === "") return y;
  const size = o.size ?? 9;
  const lh = o.lineHeight ?? size * 1.3;
  let lines = o.maxWidth ? wrap(o.font, String(value), size, o.maxWidth) : safe(o.font, String(value)).split("\n");
  if (o.maxLines && lines.length > o.maxLines) {
    lines = lines.slice(0, o.maxLines);
    lines[lines.length - 1] = lines[lines.length - 1].replace(/.{0,2}$/, "…");
  }
  let cy = y - size;
  for (const line of lines) {
    let lx = x;
    if (o.align && o.align !== "left" && o.maxWidth) {
      const w = o.font.widthOfTextAtSize(line, size);
      lx = o.align === "right" ? x + o.maxWidth - w : x + (o.maxWidth - w) / 2;
    }
    page.drawText(line, { x: lx, y: cy, size, font: o.font, color: o.color ?? C.text });
    cy -= lh;
  }
  return y - lines.length * lh;
}

export function rightText(page: PDFPage, value: string, xRight: number, y: number, font: PDFFont, size = 9, color: RGB = C.text) {
  const v = safe(font, value);
  page.drawText(v, { x: xRight - font.widthOfTextAtSize(v, size), y: y - size, size, font, color });
}

export function hline(page: PDFPage, x1: number, x2: number, y: number, color: RGB = C.line, thickness = 0.7) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

export function box(page: PDFPage, x: number, yTop: number, w: number, h: number, opts: { fill?: RGB; border?: RGB; width?: number } = {}) {
  page.drawRectangle({
    x,
    y: yTop - h,
    width: w,
    height: h,
    color: opts.fill,
    borderColor: opts.border ?? (opts.fill ? undefined : C.ink),
    borderWidth: opts.border || !opts.fill ? opts.width ?? 0.6 : 0,
  });
}

/** Embed a PNG or JPEG from raw bytes (detects by magic number). */
export async function embedImage(doc: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> {
  try {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await doc.embedPng(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await doc.embedJpg(bytes);
  } catch {
    /* unsupported image */
  }
  return null;
}

export async function fetchImage(doc: PDFDocument, url: string | null | undefined) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return await embedImage(doc, new Uint8Array(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

/** Draw an image scaled to fit inside w×h, top-left anchored at (x, yTop). */
export function drawFit(page: PDFPage, img: PDFImage, x: number, yTop: number, w: number, h: number, align: "left" | "right" = "left") {
  const s = Math.min(w / img.width, h / img.height, 1);
  const iw = img.width * s;
  const ih = img.height * s;
  page.drawImage(img, { x: align === "right" ? x + w - iw : x, y: yTop - ih, width: iw, height: ih });
  return ih;
}

export function pdfResponse(bytes: Uint8Array, filename: string, inline = true) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/[^\w.-]+/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
