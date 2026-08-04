import { Router } from "express";
import crypto from "node:crypto";
import { queryOne } from "../db.js";
import { upsertCart } from "../models/cart.js";
import { transitionCart } from "../models/cart.js";
import { enqueueSequence } from "../services/scheduler.js";

export const shopifyRouter = Router();

/** Verifica la firma HMAC-SHA256 (base64) que Shopify envia en X-Shopify-Hmac-Sha256. */
function verifyShopifyHmac(rawBody: Buffer, header: string, secret: string): boolean {
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(header));
  } catch {
    return false;
  }
}

interface ShopifyLineItem {
  product_id?: number | string;
  title?: string;
  quantity?: number;
  price?: string | number;
  image_url?: string;
}

interface ShopifyCheckout {
  id?: number | string;
  token?: string;
  email?: string;
  customer?: { first_name?: string; last_name?: string; email?: string };
  billing_address?: { name?: string };
  total_price?: string | number;
  line_items?: ShopifyLineItem[];
  checkout_token?: string;
  checkout_id?: number | string;
}

shopifyRouter.post("/:storeId", async (req, res) => {
  const { storeId } = req.params;
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const topic = (req.headers["x-shopify-topic"] as string) ?? "";
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;

  const store = await queryOne<{ id: string; webhook_secret: string }>(
    `SELECT id, webhook_secret FROM stores WHERE id = $1`,
    [storeId]
  );
  if (!store) {
    res.status(404).json({ error: "Store not found" });
    return;
  }

  if (
    !rawBody ||
    typeof hmac !== "string" ||
    !verifyShopifyHmac(rawBody, hmac, store.webhook_secret)
  ) {
    res.status(401).json({ error: "Invalid Shopify HMAC" });
    return;
  }

  const payload = req.body as ShopifyCheckout;

  // ─── Checkout creado/actualizado → candidato a carrito abandonado ─────────────
  if (topic === "checkouts/create" || topic === "checkouts/update") {
    const externalId = String(payload.token ?? payload.id ?? "");
    const email = payload.email ?? payload.customer?.email;
    if (!externalId || !email) {
      res.status(202).json({ ok: true, skipped: "sin token o email" });
      return;
    }

    const name = payload.customer
      ? `${payload.customer.first_name ?? ""} ${payload.customer.last_name ?? ""}`.trim()
      : (payload.billing_address?.name ?? "");

    const lineItems = (payload.line_items ?? []).map((li) => ({
      productId: String(li.product_id ?? ""),
      title: li.title ?? "Producto",
      quantity: li.quantity ?? 1,
      price: Number(li.price ?? 0),
      imageUrl: li.image_url,
    }));

    const cart = await upsertCart(storeId, externalId, {
      customerEmail: email,
      customerName: name,
      totalPrice: Number(payload.total_price ?? 0),
      lineItems,
    });

    // Inscribe en la secuencia activa solo si el carrito aun no esta en curso.
    if (cart.status === "idle" || cart.status === "abandoned") {
      const seq = await queryOne<{ id: string }>(
        `SELECT id FROM sequences WHERE store_id = $1 AND is_active = TRUE
         ORDER BY created_at LIMIT 1`,
        [storeId]
      );
      if (seq) {
        await enqueueSequence(cart.id, storeId, seq.id); // pasa el carrito a in_sequence
      }
    }

    res.status(200).json({ ok: true, cartId: cart.id, status: "enrolled" });
    return;
  }

  // ─── Orden creada/pagada → el carrito se recupero ────────────────────────────
  if (topic === "orders/create" || topic === "orders/paid") {
    const externalId = String(payload.checkout_token ?? payload.checkout_id ?? "");
    if (externalId) {
      const cart = await queryOne<{ id: string; status: string }>(
        `SELECT id, status FROM carts WHERE store_id = $1 AND external_id = $2`,
        [storeId, externalId]
      );
      if (cart && (cart.status === "abandoned" || cart.status === "in_sequence")) {
        await transitionCart(cart.id, storeId, "recovered");
      }
    }
    res.status(200).json({ ok: true, status: "recovered" });
    return;
  }

  // Otros topics (p.ej. el ping de verificacion de Shopify): aceptar sin actuar.
  res.status(202).json({ ok: true, ignored: topic });
});
