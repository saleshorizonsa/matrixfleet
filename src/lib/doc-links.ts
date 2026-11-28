import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { DocKind } from "./documents";

/**
 * Signed, expiring links to a single document PDF (for WhatsApp / email bodies), e.g.
 *   https://fleet.matrixinfo.co.uk/d/v1.i.<uuid>.<expiry>.<signature>
 * No database row is needed: the link carries the document and its expiry and is signed with a key
 * derived from the server-only service role key. Anyone with the link can open that one PDF until
 * it expires — like an emailed attachment — but cannot change it or reach anything else.
 */
const DAYS = 30;
const KIND: Record<DocKind, string> = { invoice: "i", cmr: "c" };

function key() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createHmac("sha256", secret).update("matrixfleet:document-links:v1").digest();
}

const sign = (payload: string) => createHmac("sha256", key()).update(payload).digest("base64url").slice(0, 32);

export function createDocumentLink(kind: DocKind, id: string, days = DAYS) {
  const exp = Math.floor(Date.now() / 1000) + days * 86400;
  const payload = `v1.${KIND[kind]}.${id}.${exp}`;
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return { url: `${base}/d/${payload}.${sign(payload)}`, expiresAt: new Date(exp * 1000) };
}

export function verifyDocumentLink(token: string): { kind: DocKind; id: string } | null {
  const m = /^v1\.([ic])\.([0-9a-f-]{36})\.(\d{10})\.([A-Za-z0-9_-]{32})$/i.exec(token);
  if (!m) return null;
  const [, k, id, exp, sig] = m;
  const want = Buffer.from(sign(`v1.${k}.${id}.${exp}`));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  if (Number(exp) * 1000 < Date.now()) return null;
  return { kind: k === "i" ? "invoice" : "cmr", id };
}
