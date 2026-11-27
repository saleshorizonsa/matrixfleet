import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";

// DejaVu Sans covers Latin Extended (PL/CZ/RO/HU…), Greek and €/£.
// Fonts live in src/lib/pdf/fonts. If a deployment cannot find them, add
//   outputFileTracingIncludes: { "/api/pdf/**": ["./src/lib/pdf/fonts/**"] }
// to next.config.ts.
const FONT_DIR = path.join(process.cwd(), "src", "lib", "pdf", "fonts");

let cache: { regular: Uint8Array; bold: Uint8Array } | null = null;

async function loadBytes() {
  if (!cache) {
    const [regular, bold] = await Promise.all([
      readFile(path.join(FONT_DIR, "DejaVuSans.ttf")),
      readFile(path.join(FONT_DIR, "DejaVuSans-Bold.ttf")),
    ]);
    cache = { regular: new Uint8Array(regular), bold: new Uint8Array(bold) };
  }
  return cache;
}

export interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

export async function embedFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const bytes = await loadBytes();
  const [regular, bold] = await Promise.all([
    doc.embedFont(bytes.regular, { subset: true }),
    doc.embedFont(bytes.bold, { subset: true }),
  ]);
  return { regular, bold };
}
