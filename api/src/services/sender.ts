import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { Resend } from "resend";
import { config } from "../config.js";

export const outboxDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../outbox");

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface SmsPayload {
  to: string;
  body: string;
}

export async function sendEmail(payload: EmailPayload): Promise<string> {
  if (config.email.transport === "preview") {
    return previewEmail(payload);
  }

  const resend = new Resend(config.resendApiKey);
  const { data, error } = await resend.emails.send({
    from: payload.from ?? config.email.from,
    to:      payload.to,
    subject: payload.subject,
    html:    payload.html,
  });

  if (error || !data) {
    throw new Error(`Resend error: ${error?.message ?? "unknown"}`);
  }

  return data.id;
}

/**
 * Modo preview: en vez de enviar, escribe el correo renderizado a /outbox/<id>.html
 * (visible en http://localhost:3001/outbox/<id>.html) y devuelve ese id como provider id.
 */
function previewEmail(payload: EmailPayload): string {
  mkdirSync(outboxDir, { recursive: true });
  const id = `preview_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  const doc = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(payload.subject)}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#f4f4f7}
.env{max-width:640px;margin:24px auto;background:#fff;border:1px solid #e3e3ea;border-radius:12px;overflow:hidden}
.hdr{padding:16px 20px;border-bottom:1px solid #eee;font-size:13px;color:#555;background:#fafafb}
.hdr b{color:#111}.body{padding:24px 20px}</style></head>
<body><div class="env">
<div class="hdr"><div><b>De:</b> ${escapeHtml(payload.from ?? config.email.from)}</div>
<div><b>Para:</b> ${escapeHtml(payload.to)}</div>
<div><b>Asunto:</b> ${escapeHtml(payload.subject)}</div></div>
<div class="body">${payload.html}</div>
</div></body></html>`;
  writeFileSync(join(outboxDir, `${id}.html`), doc);
  console.log(`[email:preview] Para: ${payload.to} | Asunto: ${payload.subject} | /outbox/${id}.html`);
  return id;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c
  );
}

export async function sendSms(payload: SmsPayload): Promise<string> {
  const { twilio } = config;
  if (!twilio.accountSid || !twilio.authToken || !twilio.fromNumber) {
    throw new Error("Twilio credentials not configured");
  }

  // Dynamic import keeps Twilio optional at startup
  const { default: Twilio } = await import("twilio");
  const client = Twilio(twilio.accountSid, twilio.authToken);

  const message = await client.messages.create({
    body: payload.body,
    from: twilio.fromNumber,
    to:   payload.to,
  });

  return message.sid;
}

export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}
