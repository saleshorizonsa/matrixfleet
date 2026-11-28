// Server-only module (node:crypto). Kept free of the "server-only" import so it can be unit-tested with jiti.
import { X509Certificate, createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { bitString, ctx, integer, octet, oid, parse, printable, seq, set, utf8 } from "./der";

export type ZatcaEnv = "sandbox" | "simulation" | "production";

/* ------------------------------------------------------------------ secrets at rest */

function encKey(): Buffer {
  const raw = process.env.ZATCA_ENCRYPTION_KEY ?? "";
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ZATCA_ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
  return key;
}

export function zatcaConfigured() {
  try {
    encKey();
    return true;
  } catch {
    return false;
  }
}

/** AES-256-GCM, stored as "v1.<iv>.<tag>.<ciphertext>" (base64). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
}

export function decryptSecret(stored: string): string {
  const [v, iv, tag, ct] = stored.split(".");
  if (v !== "v1") throw new Error("unknown secret format");
  const d = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
}

/* ------------------------------------------------------------------ keys and CSR */

export function generateSigningKey() {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "secp256k1" });
  return privateKey.export({ type: "sec1", format: "pem" }).toString();
}

const TEMPLATE: Record<ZatcaEnv, string> = {
  sandbox: "TSTZATCA-Code-Signing",
  simulation: "PREZATCA-Code-Signing",
  production: "ZATCA-Code-Signing",
};

export interface CsrInput {
  privateKeyPem: string;
  environment: ZatcaEnv;
  commonName: string;
  orgUnit: string;
  orgName: string;
  /** "1-<solution>|2-<model>|3-<serial>" */
  serial: string;
  vatNumber: string;
  /** "1100" = standard + simplified */
  invoiceTypes: string;
  location: string;
  industry: string;
}

const attr = (o: string, value: Buffer) => set(seq(oid(o), value));

/** Builds the CSR and returns it as ZATCA expects it: base64 of the PEM text. */
export function buildCsr(i: CsrInput): string {
  const key = createPrivateKey(i.privateKeyPem);
  const spki = createPublicKey(key).export({ type: "spki", format: "der" });

  const subject = seq(
    attr("2.5.4.6", printable("SA")),
    attr("2.5.4.11", utf8(i.orgUnit)),
    attr("2.5.4.10", utf8(i.orgName)),
    attr("2.5.4.3", utf8(i.commonName)),
  );
  const dirName = seq(
    attr("2.5.4.4", utf8(i.serial)), // SN
    attr("0.9.2342.19200300.100.1.1", utf8(i.vatNumber)), // UID
    attr("2.5.4.12", utf8(i.invoiceTypes)), // title
    attr("2.5.4.26", utf8(i.location)), // registeredAddress
    attr("2.5.4.15", utf8(i.industry)), // businessCategory
  );
  const extensions = seq(
    seq(oid("1.3.6.1.4.1.311.20.2"), octet(printable(TEMPLATE[i.environment]))),
    seq(oid("2.5.29.17"), octet(seq(ctx(4, dirName)))),
  );
  const attributes = ctx(0, seq(oid("1.2.840.113549.1.9.14"), set(extensions)));
  const info = seq(integer(0), subject, Buffer.from(spki), attributes);
  const signature = sign("sha256", info, key); // DER-encoded ECDSA signature
  const csr = seq(info, seq(oid("1.2.840.10045.4.3.2")), bitString(signature));

  const b64 = csr.toString("base64").replace(/.{64}/g, "$&\n");
  const pem = `-----BEGIN CERTIFICATE REQUEST-----\n${b64}${b64.endsWith("\n") ? "" : "\n"}-----END CERTIFICATE REQUEST-----\n`;
  return Buffer.from(pem).toString("base64");
}

/* ------------------------------------------------------------------ certificate */

export interface CertInfo {
  /** base64 DER body (what goes into ds:X509Certificate) */
  base64: string;
  issuer: string;
  serialNumber: string;
  publicKey: Buffer;
  signature: Buffer;
  validTo: Date;
}

/** ZATCA returns binarySecurityToken = base64(base64 DER certificate). */
export function certFromToken(token: string): CertInfo {
  const base64 = Buffer.from(token, "base64").toString("utf8").replace(/\s+/g, "");
  const der = Buffer.from(base64, "base64");
  const x = new X509Certificate(der);
  const issuer = x.issuer.split("\n").reverse().join(", ");
  const serialNumber = BigInt("0x" + x.serialNumber).toString(10);
  const publicKey = Buffer.from(x.publicKey.export({ type: "spki", format: "der" }));
  const root = parse(der);
  const sigNode = root.children?.[2];
  const signature = sigNode ? Buffer.from(sigNode.content.subarray(1)) : Buffer.alloc(0);
  return { base64, issuer, serialNumber, publicKey, signature, validTo: new Date(x.validTo) };
}

/** ZATCA's certificate digest: base64 of the hex SHA-256 of the base64 certificate text. */
export function certificateHash(certBase64: string) {
  return Buffer.from(createHash("sha256").update(certBase64).digest("hex")).toString("base64");
}

/** ECDSA (secp256k1, SHA-256) signature over the invoice hash bytes, base64. */
export function signInvoiceHash(invoiceHashB64: string, privateKeyPem: string) {
  return sign("sha256", Buffer.from(invoiceHashB64, "base64"), createPrivateKey(privateKeyPem)).toString("base64");
}

export function publicKeyOf(privateKeyPem: string) {
  return Buffer.from(createPublicKey(createPrivateKey(privateKeyPem)).export({ type: "spki", format: "der" }));
}

export const sha256b64 = (s: string | Buffer) => createHash("sha256").update(s).digest("base64");
export const sha256hexb64 = (s: string | Buffer) => Buffer.from(createHash("sha256").update(s).digest("hex")).toString("base64");
