import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { queryOne } from "../db.js";
import { upsertCart, transitionCart } from "../models/cart.js";
import { enqueueSequence } from "../services/scheduler.js";

export const webhookRouter = Router();

const LineItemSchema = z.object({
  product_id: z.string(),
  title:      z.string(),
  quantity:   z.number().int().positive(),
  price:      z.coerce.number(),
  image_url:  z.string().url().optional(),
});

const CartEventSchema = z.object({
  event:       z.enum(["cart/create", "cart/update", "cart/recover"]),
  external_id: z.string(),
  customer: z.object({
    email: z.string().email(),
    name:  z.string().default(""),
  }),
  total_price: z.coerce.number(),
  line_items:  z.array(LineItemSchema),
});

function verifySignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

webhookRouter.post("/:storeId", async (req, res) => {
  const { storeId } = req.params;
  const signature   = req.headers["x-recoverkit-signature"];

  const store = await queryOne<{ id: string; webhook_secret: string }>(
    `SELECT id, webhook_secret FROM stores WHERE id = $1`,
    [storeId]
  );

  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  if (
    typeof signature !== "string" ||
    !verifySignature(
      Buffer.from(JSON.stringify(req.body)),
      signature,
      store.webhook_secret
    )
  ) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const parsed = CartEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid payload", issues: parsed.error.flatten() });
    return;
  }

  const { event, external_id, customer, total_price, line_items } = parsed.data;

  const cart = await upsertCart(storeId, external_id, {
    customerEmail: customer.email,
    customerName:  customer.name,
    totalPrice:    total_price,
    lineItems: line_items.map((li) => ({
      productId: li.product_id,
      title:     li.title,
      quantity:  li.quantity,
      price:     li.price,
      imageUrl:  li.image_url,
    })),
  });

  if (event === "cart/update" && cart.status === "idle") {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60_000);
    if (cart.updatedAt < thirtyMinutesAgo) {
      await transitionCart(cart.id, storeId, "abandoned");

      // Pick the first active sequence for this store
      const seq = await queryOne<{ id: string }>(
        `SELECT id FROM sequences WHERE store_id = $1 AND is_active = TRUE LIMIT 1`,
        [storeId]
      );
      if (seq) await enqueueSequence(cart.id, cart.storeId, seq.id);
    }
  }

  if (event === "cart/recover" && ["abandoned", "in_sequence"].includes(cart.status)) {
    await transitionCart(cart.id, storeId, "recovered");
  }

  res.status(200).json({ ok: true });
});
