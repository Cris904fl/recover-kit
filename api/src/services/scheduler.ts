import { query, queryOne } from "../db.js";
import { config } from "../config.js";
import { AppError } from "../middleware/errorHandler.js";
import { sendEmail, sendSms, interpolate } from "./sender.js";

interface LineItem {
  productId?: string;
  title?: string;
  quantity?: number;
  price?: number;
  imageUrl?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c
  );
}

function getLineItems(cart: Record<string, unknown>): LineItem[] {
  const raw = cart["line_items"];
  if (Array.isArray(raw)) return raw as LineItem[];
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as LineItem[];
    } catch {
      return [];
    }
  }
  return [];
}

/** Tabla HTML con los productos del carrito (para {{items}} y el bloque automatico). */
function renderItemsTable(cart: Record<string, unknown>): string {
  const items = getLineItems(cart);
  if (!items.length) return "";
  const rows = items
    .map(
      (li) => `
      <tr>
        <td style="padding:8px 6px;border-bottom:1px solid #eee">
          ${li.imageUrl ? `<img src="${escapeHtml(li.imageUrl)}" alt="" width="44" height="44" style="border-radius:6px;object-fit:cover;vertical-align:middle;margin-right:10px">` : ""}
          ${escapeHtml(li.title ?? "Producto")}
        </td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:center;color:#666">x${li.quantity ?? 1}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">$${Number(li.price ?? 0).toFixed(2)}</td>
      </tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:10px 0">${rows}</table>`;
}

/** Bloque completo: productos + total + boton, para adjuntar cuando la plantilla no usa {{items}}. */
function renderItemsSection(
  cart: Record<string, unknown>,
  vars: Record<string, string>,
  ctaUrl: string
): string {
  const table = renderItemsTable(cart);
  if (!table) return "";
  return `
    <div style="margin-top:16px">
      <div style="font-weight:600;margin-bottom:4px">Tu carrito</div>
      ${table}
      <div style="text-align:right;font-weight:600">Total: ${vars["total_price"]}</div>
      <div style="margin-top:16px">
        <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#534AB7;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Completar compra</a>
      </div>
    </div>`;
}

/** Variables de plantilla: {{name}}, {{total_price}}, {{cart_url}}, {{items}}. */
function buildVars(cart: Record<string, unknown>): Record<string, string> {
  const name = (cart["customer_name"] as string) || "there";
  return {
    name,
    customer_name: name,
    total_price: `$${Number(cart["total_price"]).toFixed(2)}`,
    cart_url: `https://recoverkit.dev/recover/${cart["id"]}`,
    items: renderItemsTable(cart),
  };
}

/**
 * Ejecutado por el scheduler en cada tick.
 * Despacha todos los mensajes pendientes cuyo scheduled_at <= NOW().
 * Devuelve cuantos se enviaron.
 */
export async function processPendingMessages(): Promise<number> {
  const pending = await query<{
    id: string;
    cart_id: string;
    step_id: string;
    channel: string;
    store_id: string;
  }>(
    `SELECT m.id, m.cart_id, m.step_id, m.channel, m.store_id
     FROM messages m
     WHERE m.status = 'pending' AND m.scheduled_at <= NOW()
     ORDER BY m.scheduled_at
     LIMIT 100`
  );

  const results = await Promise.allSettled(pending.map(dispatchMessage));
  return results.filter((r) => r.status === "fulfilled" && r.value === true).length;
}

/** Devuelve true si el mensaje se envio. */
export async function dispatchMessage(msg: {
  id: string;
  cart_id: string;
  step_id: string;
  channel: string;
  store_id: string;
}): Promise<boolean> {
  const [cart, step] = await Promise.all([
    queryOne<Record<string, unknown>>(
      `SELECT * FROM carts WHERE id = $1 AND store_id = $2`,
      [msg.cart_id, msg.store_id]
    ),
    queryOne<Record<string, unknown>>(
      `SELECT * FROM sequence_steps WHERE id = $1`,
      [msg.step_id]
    ),
  ]);

  if (!cart || !step) {
    await markFailed(msg.id, "Cart or step not found");
    return false;
  }

  // Carrito ya comprado o cerrado: se cancela el envio (estado terminal, no se reprocesa).
  const status = cart["status"] as string;
  if (status === "recovered" || status === "closed") {
    await markFailed(msg.id, `Cart ${status}, message cancelled`);
    return false;
  }

  const vars = buildVars(cart);

  try {
    let providerId: string;

    if (msg.channel === "email") {
      const bodyTemplate = step["body"] as string;
      // Enlace de clic rastreado: registra el clic y redirige al carrito.
      const trackedCta = `${config.publicApiUrl}/track/click/${msg.id}?url=${encodeURIComponent(vars["cart_url"]!)}`;
      let html = interpolate(bodyTemplate, vars);
      if (!bodyTemplate.includes("{{items}}")) {
        html += renderItemsSection(cart, vars, trackedCta);
      }
      // Pixel de apertura (invisible): al cargarse marca el mensaje como 'opened'.
      html += `<img src="${config.publicApiUrl}/track/open/${msg.id}" width="1" height="1" alt="" style="display:none">`;
      providerId = await sendEmail({
        to:      cart["customer_email"] as string,
        subject: interpolate((step["subject"] as string) ?? "You left something behind", vars),
        html,
      });
    } else {
      providerId = await sendSms({
        to:   cart["customer_email"] as string,
        body: interpolate(step["body"] as string, vars),
      });
    }

    await query(
      `UPDATE messages
       SET status = 'sent', sent_at = NOW(), provider_id = $1
       WHERE id = $2`,
      [providerId, msg.id]
    );
    return true;
  } catch (err) {
    await markFailed(msg.id, (err as Error).message);
    return false;
  }
}

async function markFailed(messageId: string, error: string): Promise<void> {
  await query(
    `UPDATE messages SET status = 'failed', error = $1 WHERE id = $2`,
    [error, messageId]
  );
}

/**
 * Enqueue sequence messages for a newly abandoned cart.
 */
export async function enqueueSequence(
  cartId: string,
  storeId: string,
  sequenceId: string
): Promise<number> {
  const steps = await query<{ id: string; delay_minutes: number }>(
    `SELECT id, delay_minutes FROM sequence_steps
     WHERE sequence_id = $1 ORDER BY position`,
    [sequenceId]
  );

  const now = new Date();

  await Promise.all(
    steps.map((step) => {
      const scheduledAt = new Date(now.getTime() + step.delay_minutes * 60_000);
      return query(
        `INSERT INTO messages (cart_id, step_id, store_id, channel, scheduled_at)
         SELECT $1, $2, $3, ss.channel, $4
         FROM sequence_steps ss WHERE ss.id = $2`,
        [cartId, step.id, storeId, scheduledAt.toISOString()]
      );
    })
  );

  await query(`UPDATE carts SET status = 'in_sequence' WHERE id = $1`, [cartId]);
  return steps.length;
}

export interface RecoveryResult {
  messageId: string;
  cartId: string;
  to: string;
  channel: string;
  subject: string | null;
  status: string;
  providerId: string | null;
  error: string | null;
  previewUrl: string | null;
}

/**
 * Envia AHORA el correo (o SMS) del primer paso de la secuencia activa para un carrito.
 * Reusa el pipeline real de despacho; devuelve el resultado para mostrarlo en la UI.
 */
export async function sendRecoveryNow(
  cartId: string,
  storeId: string
): Promise<RecoveryResult> {
  const cart = await queryOne<Record<string, unknown>>(
    `SELECT * FROM carts WHERE id = $1 AND store_id = $2`,
    [cartId, storeId]
  );
  if (!cart) throw new AppError(404, "Cart not found");

  // No tiene sentido enviar recuperacion a un carrito ya comprado o cerrado.
  const cartStatus = cart["status"] as string;
  if (cartStatus === "recovered" || cartStatus === "closed") {
    throw new AppError(
      422,
      `El carrito esta '${cartStatus}': no se envian correos de recuperacion.`
    );
  }

  const seq = await queryOne<{ id: string }>(
    `SELECT id FROM sequences WHERE store_id = $1 AND is_active = TRUE
     ORDER BY created_at LIMIT 1`,
    [storeId]
  );
  if (!seq) throw new AppError(422, "No hay una secuencia activa para esta tienda");

  const step = await queryOne<Record<string, unknown>>(
    `SELECT * FROM sequence_steps WHERE sequence_id = $1 ORDER BY position LIMIT 1`,
    [seq.id]
  );
  if (!step) throw new AppError(422, "La secuencia activa no tiene pasos");

  const inserted = await queryOne<{ id: string }>(
    `INSERT INTO messages (cart_id, step_id, store_id, channel, scheduled_at, status)
     VALUES ($1, $2, $3, $4, NOW(), 'pending') RETURNING id`,
    [cartId, step["id"], storeId, step["channel"]]
  );

  await dispatchMessage({
    id:       inserted!.id,
    cart_id:  cartId,
    step_id:  step["id"] as string,
    channel:  step["channel"] as string,
    store_id: storeId,
  });

  // Si el carrito estaba idle/abandoned, pasa a in_sequence.
  if (["idle", "abandoned"].includes(cart["status"] as string)) {
    await query(`UPDATE carts SET status = 'in_sequence' WHERE id = $1`, [cartId]);
  }

  const result = await queryOne<{
    status: string;
    provider_id: string | null;
    error: string | null;
  }>(`SELECT status, provider_id, error FROM messages WHERE id = $1`, [inserted!.id]);

  const vars = buildVars(cart);
  const subject =
    step["channel"] === "email"
      ? interpolate((step["subject"] as string) ?? "You left something behind", vars)
      : null;

  const providerId = result?.provider_id ?? null;
  const previewUrl =
    config.email.transport === "preview" && providerId?.startsWith("preview_")
      ? `/outbox/${providerId}.html`
      : null;

  return {
    messageId:  inserted!.id,
    cartId,
    to:         cart["customer_email"] as string,
    channel:    step["channel"] as string,
    subject,
    status:     result?.status ?? "unknown",
    providerId,
    error:      result?.error ?? null,
    previewUrl,
  };
}

export interface EnrollResult {
  cartId: string;
  sequence: string;
  stepsQueued: number;
  schedule: { position: number; channel: string; dueInMinutes: number }[];
}

/**
 * Inscribe un carrito en la secuencia activa: encola TODOS los pasos con su
 * scheduled_at (segun el delay de cada uno). El scheduler los ira despachando
 * a medida que venzan. Reemplaza cualquier encolado pendiente previo del carrito.
 */
export async function enrollCart(cartId: string, storeId: string): Promise<EnrollResult> {
  const cart = await queryOne<Record<string, unknown>>(
    `SELECT status FROM carts WHERE id = $1 AND store_id = $2`,
    [cartId, storeId]
  );
  if (!cart) throw new AppError(404, "Cart not found");

  const status = cart["status"] as string;
  if (status === "recovered" || status === "closed") {
    throw new AppError(
      422,
      `El carrito esta '${status}': no se puede iniciar la secuencia.`
    );
  }

  const seq = await queryOne<{ id: string; name: string }>(
    `SELECT id, name FROM sequences WHERE store_id = $1 AND is_active = TRUE
     ORDER BY created_at LIMIT 1`,
    [storeId]
  );
  if (!seq) throw new AppError(422, "No hay una secuencia activa para esta tienda");

  // Evita duplicados si se re-inscribe: descarta lo pendiente previo.
  await query(`DELETE FROM messages WHERE cart_id = $1 AND status = 'pending'`, [cartId]);

  const stepsQueued = await enqueueSequence(cartId, storeId, seq.id);

  const steps = await query<{ position: number; delay_minutes: number; channel: string }>(
    `SELECT position, delay_minutes, channel FROM sequence_steps
     WHERE sequence_id = $1 ORDER BY position`,
    [seq.id]
  );

  return {
    cartId,
    sequence: seq.name,
    stepsQueued,
    schedule: steps.map((s) => ({
      position: s.position,
      channel: s.channel,
      dueInMinutes: s.delay_minutes,
    })),
  };
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

/**
 * Arranca el despachador en segundo plano: cada intervalMs procesa los mensajes
 * pendientes que ya vencieron. Esto es el "cron" que hace que la secuencia
 * completa se dispare sola.
 */
export function startScheduler(intervalMs: number): void {
  if (schedulerTimer) return;
  console.log(
    `[scheduler] activo: procesa mensajes pendientes cada ${Math.round(intervalMs / 1000)}s`
  );
  schedulerTimer = setInterval(async () => {
    if (ticking) return; // evita solapes si un tick tarda mas que el intervalo
    ticking = true;
    try {
      const sent = await processPendingMessages();
      if (sent > 0) console.log(`[scheduler] despachados ${sent} mensaje(s)`);
    } catch (err) {
      console.error("[scheduler] error:", (err as Error).message);
    } finally {
      ticking = false;
    }
  }, intervalMs);

  // No mantener vivo el proceso solo por el timer.
  schedulerTimer.unref?.();
}
