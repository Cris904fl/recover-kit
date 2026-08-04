import { Router } from "express";
import { query } from "../db.js";

export const trackRouter = Router();

// GIF transparente 1x1.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// Apertura: el cliente de correo carga el pixel -> marca el mensaje como 'opened'.
trackRouter.get("/open/:messageId", async (req, res) => {
  try {
    await query(
      `UPDATE messages
       SET status = 'opened', opened_at = COALESCE(opened_at, NOW())
       WHERE id = $1 AND status = 'sent'`,
      [req.params.messageId]
    );
  } catch {
    // Nunca romper la carga del pixel por un id invalido o error de DB.
  }
  res.set("Content-Type", "image/gif");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.send(PIXEL);
});

// Clic: registra el clic y redirige al destino original.
trackRouter.get("/click/:messageId", async (req, res) => {
  const url = typeof req.query["url"] === "string" ? req.query["url"] : null;
  try {
    await query(
      `UPDATE messages
       SET status = 'clicked',
           clicked_at = COALESCE(clicked_at, NOW()),
           opened_at  = COALESCE(opened_at, NOW())
       WHERE id = $1 AND status IN ('sent', 'opened')`,
      [req.params.messageId]
    );
  } catch {
    // No bloquear el redirect por un error de tracking.
  }
  // Solo redirigir a http/https para evitar open-redirects raros.
  if (url && /^https?:\/\//i.test(url)) {
    res.redirect(302, url);
  } else {
    res.redirect(302, "/");
  }
});
