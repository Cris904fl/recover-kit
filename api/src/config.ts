import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  WEBHOOK_SECRET: z.string().min(16),
  RESEND_API_KEY: z.string().startsWith("re_"),
  EMAIL_TRANSPORT: z.enum(["preview", "resend"]).optional(),
  EMAIL_FROM: z.string().optional(),
  PUBLIC_API_URL: z.string().url().optional(),
  SCHEDULER_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
  SCHEDULER_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Sin una API key real de Resend, el envio usa el modo "preview" (renderiza el correo
// a un archivo visible en /outbox en vez de mandarlo). Pon EMAIL_TRANSPORT=resend + una
// key real para enviar de verdad.
const isPlaceholderKey = parsed.data.RESEND_API_KEY === "re_dev_placeholder";
const emailTransport = parsed.data.EMAIL_TRANSPORT ?? (isPlaceholderKey ? "preview" : "resend");

export const config = {
  env: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  // URL publica del API, usada en los enlaces de tracking dentro del correo.
  publicApiUrl: parsed.data.PUBLIC_API_URL ?? `http://localhost:${parsed.data.PORT}`,
  databaseUrl: parsed.data.DATABASE_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  webhookSecret: parsed.data.WEBHOOK_SECRET,
  resendApiKey: parsed.data.RESEND_API_KEY,
  email: {
    transport: emailTransport,
    from: parsed.data.EMAIL_FROM ?? "RecoverKit <onboarding@resend.dev>",
  },
  scheduler: {
    intervalMs: parsed.data.SCHEDULER_INTERVAL_MS,
    // Apagado en tests para no despachar contra la base real.
    enabled: parsed.data.SCHEDULER_ENABLED && parsed.data.NODE_ENV !== "test",
  },
  twilio: {
    accountSid: parsed.data.TWILIO_ACCOUNT_SID,
    authToken: parsed.data.TWILIO_AUTH_TOKEN,
    fromNumber: parsed.data.TWILIO_FROM_NUMBER,
  },
};
