import "express-async-errors";
import express from "express";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { cartsRouter } from "./routes/carts.js";
import { sequencesRouter } from "./routes/sequences.js";
import { analyticsRouter } from "./routes/analytics.js";
import { webhookRouter } from "./routes/webhook.js";
import { shopifyRouter } from "./routes/shopify.js";
import { trackRouter } from "./routes/track.js";
import { outboxDir } from "./services/sender.js";
import { startScheduler } from "./services/scheduler.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authenticate } from "./middleware/authenticate.js";

const app = express();

// CORS — el frontend (localhost:3000) llama al API en otro origen (localhost:3001),
// asi que hay que responder el preflight OPTIONS y exponer las cabeceras permitidas.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Guarda el body crudo para verificar firmas HMAC de webhooks (Shopify usa el byte-exacto).
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
  })
);

// Public routes
app.use("/auth", authRouter);
app.use("/webhook/shopify", shopifyRouter);
app.use("/webhook", webhookRouter);
app.use("/track", trackRouter);
// Previews de correos generados en modo dev (http://localhost:3001/outbox/<id>.html)
app.use("/outbox", express.static(outboxDir));

// Protected routes
app.use("/api", authenticate);
app.use("/api/carts", cartsRouter);
app.use("/api/sequences", sequencesRouter);
app.use("/api/analytics", analyticsRouter);

// Global error handler — must be last
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`RecoverKit API listening on port ${config.port}`);
  if (config.scheduler.enabled) {
    startScheduler(config.scheduler.intervalMs);
  }
});

export { app };
