import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing email for documents (invoices, credit notes, CMR) through the same Zoho mailbox that sends
 * account emails. Sent "From: <Company> via MatrixFleet <info@…>" with Reply-To set to the company,
 * so customers answer the haulier directly. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.
 */
export function mailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transport: Transporter | null = null;
function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
  return transport;
}

/** Strip anything that could break a header (quotes, angle brackets, line breaks). */
const clean = (s: string) => s.replace(/[\r\n"<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface DocumentMail {
  to: string[];
  cc?: string[];
  replyTo?: string | null;
  companyName: string;
  subject: string;
  message: string;
  attachment: { filename: string; bytes: Uint8Array };
}

export async function sendDocumentMail(m: DocumentMail) {
  const from = `"${clean(m.companyName)} via MatrixFleet" <${process.env.SMTP_USER}>`;
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#0f172a">` +
    esc(m.message).replace(/\n/g, "<br>") +
    `<p style="margin-top:28px;font-size:12px;color:#64748b">The document is attached as a PDF. Sent with MatrixFleet on behalf of ${esc(clean(m.companyName))}.</p></div>`;
  return getTransport().sendMail({
    from,
    to: m.to,
    cc: m.cc?.length ? m.cc : undefined,
    replyTo: m.replyTo || undefined,
    subject: m.subject.replace(/[\r\n]+/g, " ").slice(0, 200),
    text: `${m.message}\n\n—\nThe document is attached as a PDF. Sent with MatrixFleet on behalf of ${clean(m.companyName)}.`,
    html,
    attachments: [{ filename: m.attachment.filename.replace(/[^\w.-]+/g, "_"), content: Buffer.from(m.attachment.bytes), contentType: "application/pdf" }],
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}
