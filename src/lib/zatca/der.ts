// Minimal ASN.1 DER encoder/decoder — enough to build a ZATCA certificate signing request (CSR)
// and to read the signature out of a ZATCA certificate. No external dependency.

function len(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  const bytes: number[] = [];
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

export function tlv(tag: number, value: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), len(value.length), value]);
}

export const seq = (...items: Buffer[]) => tlv(0x30, Buffer.concat(items));
export const set = (...items: Buffer[]) => tlv(0x31, Buffer.concat(items));
export const utf8 = (s: string) => tlv(0x0c, Buffer.from(s, "utf8"));
export const printable = (s: string) => tlv(0x13, Buffer.from(s, "ascii"));
export const octet = (b: Buffer) => tlv(0x04, b);
export const bitString = (b: Buffer) => tlv(0x03, Buffer.concat([Buffer.from([0]), b]));
export const integer = (n: number) => tlv(0x02, Buffer.from([n]));
/** context-specific constructed tag [n] */
export const ctx = (n: number, ...items: Buffer[]) => tlv(0xa0 + n, Buffer.concat(items));

export function oid(dotted: string): Buffer {
  const parts = dotted.split(".").map(Number);
  const bytes: number[] = [parts[0] * 40 + parts[1]];
  for (const p of parts.slice(2)) {
    const stack: number[] = [p & 0x7f];
    let v = Math.floor(p / 128);
    while (v > 0) {
      stack.unshift((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    bytes.push(...stack);
  }
  return tlv(0x06, Buffer.from(bytes));
}

export interface DerNode {
  tag: number;
  /** header + content */
  raw: Buffer;
  content: Buffer;
  children?: DerNode[];
}

export function parse(buf: Buffer, offset = 0): DerNode & { end: number } {
  const tag = buf[offset];
  let l = buf[offset + 1];
  let hdr = 2;
  if (l & 0x80) {
    const n = l & 0x7f;
    l = 0;
    for (let i = 0; i < n; i++) l = (l << 8) | buf[offset + 2 + i];
    hdr = 2 + n;
  }
  const start = offset + hdr;
  const end = start + l;
  const node: DerNode & { end: number } = { tag, raw: buf.subarray(offset, end), content: buf.subarray(start, end), end };
  if (tag & 0x20) {
    node.children = [];
    let p = start;
    while (p < end) {
      const child = parse(buf, p);
      node.children.push(child);
      p = child.end;
    }
  }
  return node;
}
