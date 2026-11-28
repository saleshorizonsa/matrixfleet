// ZATCA QR payload: tag-length-value, base64. Tags 1–5 (phase 1): seller name, VAT number,
// timestamp, total with VAT, VAT total. Phase 2 adds 6 invoice hash, 7 signature,
// 8 public key and (simplified invoices) 9 the ZATCA CA's signature over the certificate.
export function qrTlv(values: (string | Buffer)[]): string {
  const parts = values.map((v, i) => {
    let bytes = typeof v === "string" ? Buffer.from(v, "utf8") : v;
    if (bytes.length > 255) bytes = truncateUtf8(bytes, 255);
    return Buffer.concat([Buffer.from([i + 1, bytes.length]), bytes]);
  });
  return Buffer.concat(parts).toString("base64");
}

function truncateUtf8(b: Buffer, max: number) {
  let end = max;
  // do not cut a multi-byte character in half
  while (end > 0 && (b[end] & 0xc0) === 0x80) end--;
  return b.subarray(0, end);
}

/** Decode a QR payload (for tests and display). */
export function readQr(b64: string): Record<number, Buffer> {
  const buf = Buffer.from(b64, "base64");
  const out: Record<number, Buffer> = {};
  for (let p = 0; p + 2 <= buf.length; ) {
    const tag = buf[p];
    const l = buf[p + 1];
    out[tag] = buf.subarray(p + 2, p + 2 + l);
    p += 2 + l;
  }
  return out;
}
