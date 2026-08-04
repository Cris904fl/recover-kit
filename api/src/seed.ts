/**
 * Dev seed — RecoverKit no trae login ni datos de ejemplo.
 * Este script deja la base con una tienda, carritos, una secuencia y mensajes,
 * y ademas imprime un JWT firmado con tu JWT_SECRET para autenticarte en el frontend.
 *
 *   npm run db:seed  --workspace=api
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { db, query, queryOne } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

type CartStatus = "idle" | "abandoned" | "in_sequence" | "recovered" | "closed";

const DAY_MS = 24 * 60 * 60 * 1000;

// Reparto de estados a lo largo de ~40 carritos.
const STATUS_WEIGHTS: [CartStatus, number][] = [
  ["recovered", 0.3],
  ["abandoned", 0.25],
  ["in_sequence", 0.2],
  ["closed", 0.15],
  ["idle", 0.1],
];

const FIRST_NAMES = ["Ana", "Luis", "Marta", "Carlos", "Sofia", "Diego", "Elena", "Javier", "Lucia", "Pablo"];
const LAST_NAMES = ["Gomez", "Ruiz", "Torres", "Vega", "Cano", "Mora", "Prieto", "Nunez", "Cabrera", "Rios"];
const PRODUCTS: [string, number][] = [
  ["Zapatillas running", 89.9],
  ["Chaqueta impermeable", 129.0],
  ["Mochila 30L", 64.5],
  ["Botella termica", 24.9],
  ["Gorra tecnica", 19.9],
  ["Calcetines pack x3", 14.9],
  ["Reloj GPS", 199.0],
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickStatus(): CartStatus {
  const r = Math.random();
  let acc = 0;
  for (const [status, w] of STATUS_WEIGHTS) {
    acc += w;
    if (r <= acc) return status;
  }
  return "abandoned";
}

async function main() {
  console.log("Limpiando datos previos...");
  await query(`TRUNCATE stores RESTART IDENTITY CASCADE`);

  // ─── Store ───────────────────────────────────────────────────────────────
  const store = await queryOne<{ id: string }>(
    `INSERT INTO stores (domain, name, plan, webhook_secret)
     VALUES ($1, $2, 'pro', $3) RETURNING id`,
    ["demo-shop.myshopify.com", "Demo Shop", config.webhookSecret]
  );
  const storeId = store!.id;

  // ─── User (owner) — credenciales para el login ─────────────────────────────
  const DEMO_EMAIL = "owner@demo-shop.com";
  const DEMO_PASSWORD = "demo1234";
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await queryOne<{ id: string }>(
    `INSERT INTO users (store_id, email, password_hash, role)
     VALUES ($1, $2, $3, 'owner') RETURNING id`,
    [storeId, DEMO_EMAIL, passwordHash]
  );

  // ─── Sequence + steps ────────────────────────────────────────────────────
  const seq = await queryOne<{ id: string }>(
    `INSERT INTO sequences (store_id, name, is_active)
     VALUES ($1, 'Recuperacion carrito abandonado', TRUE) RETURNING id`,
    [storeId]
  );
  const seqId = seq!.id;

  const steps = [
    {
      pos: 0,
      delay: 60,
      channel: "email",
      subject: "Te dejaste algo en el carrito",
      body: "Hola {{name}}, notamos que dejaste algunos productos en tu carrito. Siguen disponibles para ti:",
    },
    {
      pos: 1,
      delay: 1440,
      channel: "email",
      subject: "Un 10% de descuento para completar tu compra",
      body: "Hola {{name}}, todavia estas a tiempo. Usa el codigo VUELVE10 y llevate un 10% en estos articulos:",
    },
    {
      pos: 2,
      delay: 2880,
      channel: "sms",
      subject: null,
      body: "Ultima oportunidad {{name}}: tu carrito de {{total_price}} expira pronto. Completalo en {{cart_url}}",
    },
  ];
  const stepIds: string[] = [];
  for (const s of steps) {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO sequence_steps (sequence_id, position, delay_minutes, channel, subject, body)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [seqId, s.pos, s.delay, s.channel, s.subject, s.body]
    );
    stepIds.push(row!.id);
  }
  const firstEmailStepId = stepIds[0]!;

  // ─── Carts (repartidos en los ultimos 30 dias) ───────────────────────────
  const NUM_CARTS = 45;
  const engagedCartIds: string[] = []; // carritos que ya entraron en secuencia
  let recoveredRevenue = 0;

  for (let i = 0; i < NUM_CARTS; i++) {
    const status = pickStatus();
    const daysAgo = Math.random() * 30;
    const createdAt = new Date(Date.now() - daysAgo * DAY_MS);

    const nItems = 1 + Math.floor(Math.random() * 3);
    const lineItems = Array.from({ length: nItems }, (_, k) => {
      const [title, price] = pick(PRODUCTS);
      return {
        productId: `prod_${1000 + Math.floor(Math.random() * 9000)}`,
        title,
        quantity: 1 + Math.floor(Math.random() * 2),
        price,
        imageUrl: `https://picsum.photos/seed/${title.length}${k}/80`,
      };
    });
    const totalPrice = lineItems.reduce((sum, li) => sum + li.price * li.quantity, 0);

    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;

    const abandonedAt = status === "idle" ? null : new Date(createdAt.getTime() + 30 * 60_000);
    const recoveredAt = status === "recovered" ? new Date(createdAt.getTime() + 6 * 60 * 60_000) : null;
    if (status === "recovered") recoveredRevenue += totalPrice;

    const cart = await queryOne<{ id: string }>(
      `INSERT INTO carts
         (store_id, external_id, customer_email, customer_name, total_price,
          line_items, status, abandoned_at, recovered_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING id`,
      [
        storeId,
        `ext_${100000 + i}`,
        email,
        `${firstName} ${lastName}`,
        totalPrice.toFixed(2),
        JSON.stringify(lineItems),
        status,
        abandonedAt,
        recoveredAt,
        createdAt,
      ]
    );

    if (status === "in_sequence" || status === "recovered" || status === "closed") {
      engagedCartIds.push(cart!.id);
    }
  }

  // ─── Messages (para las metricas de email) ───────────────────────────────
  // A cada carrito que entro en secuencia le mandamos el primer email; el estado
  // (sent/opened/clicked) alimenta open-rate y click-rate del dashboard.
  let msgCount = 0;
  for (const cartId of engagedCartIds) {
    const r = Math.random();
    const status = r < 0.25 ? "clicked" : r < 0.65 ? "opened" : "sent";
    const sentAt = new Date(Date.now() - Math.random() * 20 * DAY_MS);
    const openedAt = status === "opened" || status === "clicked" ? new Date(sentAt.getTime() + 3 * 60_000) : null;
    const clickedAt = status === "clicked" ? new Date(sentAt.getTime() + 5 * 60_000) : null;

    await query(
      `INSERT INTO messages
         (cart_id, step_id, store_id, channel, status, scheduled_at, sent_at, opened_at, clicked_at, provider_id, created_at)
       VALUES ($1,$2,$3,'email',$4,$5,$5,$6,$7,$8,$5)`,
      [cartId, firstEmailStepId, storeId, status, sentAt, openedAt, clickedAt, `resend_${msgCount}`]
    );
    msgCount++;
  }

  // ─── Token ───────────────────────────────────────────────────────────────
  // Asegura que el frontend apunte al API (sin token: ahora hay login real).
  const webEnvPath = resolve(__dirname, "../../web/.env");
  writeFileSync(webEnvPath, `VITE_API_BASE_URL=http://localhost:3001\n`);

  console.log("\n=========================================================");
  console.log(" Seed completado");
  console.log("---------------------------------------------------------");
  console.log(` Tienda:     Demo Shop (${storeId})`);
  console.log(` Carritos:   ${NUM_CARTS}  |  Ingreso recuperado: ${recoveredRevenue.toFixed(2)}`);
  console.log(` Secuencia:  1 (3 pasos)  |  Mensajes email: ${msgCount}`);
  console.log("=========================================================");
  console.log(" Inicia sesion en http://localhost:3000/login con:");
  console.log(`   Email:    ${DEMO_EMAIL}`);
  console.log(`   Password: ${DEMO_PASSWORD}`);
  console.log("=========================================================\n");

  await db.end();
}

main().catch((err) => {
  console.error("Seed fallo:", err);
  process.exit(1);
});
