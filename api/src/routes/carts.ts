import { Router } from "express";
import { z } from "zod";
import { listCarts, findCart, transitionCart } from "../models/cart.js";
import type { CartStatus } from "../models/cart.js";
import { sendRecoveryNow, enrollCart } from "../services/scheduler.js";

export const cartsRouter = Router();

const ListQuerySchema = z.object({
  status: z.enum(["idle","abandoned","in_sequence","recovered","closed"]).optional(),
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});

cartsRouter.get("/", async (req, res) => {
  const q = ListQuerySchema.parse(req.query);
  const offset = (q.page - 1) * q.limit;
  const result = await listCarts(req.auth.storeId, {
    status: q.status,
    limit:  q.limit,
    offset,
  });
  res.json({ ...result, page: q.page, limit: q.limit });
});

cartsRouter.get("/:id", async (req, res) => {
  const cart = await findCart(req.params["id"]!, req.auth.storeId);
  res.json(cart);
});

const PatchSchema = z.object({
  status: z.enum(["recovered", "closed"]),
});

cartsRouter.patch("/:id", async (req, res) => {
  const { status } = PatchSchema.parse(req.body);
  const cart = await transitionCart(
    req.params["id"]!,
    req.auth.storeId,
    status as CartStatus
  );
  res.json(cart);
});

// Dispara el correo de recuperacion (primer paso de la secuencia activa) para este carrito.
cartsRouter.post("/:id/send-recovery", async (req, res) => {
  const result = await sendRecoveryNow(req.params["id"]!, req.auth.storeId);
  res.json(result);
});

// Inscribe el carrito en la secuencia activa: encola todos los pasos; el scheduler
// los despacha cuando vencen.
cartsRouter.post("/:id/enroll", async (req, res) => {
  const result = await enrollCart(req.params["id"]!, req.auth.storeId);
  res.json(result);
});
