import { query, queryOne } from "../db.js";
import { AppError } from "../middleware/errorHandler.js";

export type CartStatus = "idle" | "abandoned" | "in_sequence" | "recovered" | "closed";

export interface Cart {
  id: string;
  storeId: string;
  externalId: string;
  customerEmail: string;
  customerName: string;
  totalPrice: number;
  lineItems: LineItem[];
  status: CartStatus;
  abandonedAt: Date | null;
  recoveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LineItem {
  productId: string;
  title: string;
  quantity: number;
  price: number;
  imageUrl?: string;
}

// ─── Valid state transitions ───────────────────────────────────────────────────
const TRANSITIONS: Record<CartStatus, CartStatus[]> = {
  idle:        ["abandoned"],
  abandoned:   ["in_sequence", "recovered", "closed"],
  in_sequence: ["recovered", "closed"],
  recovered:   [],
  closed:      [],
};

export function canTransition(from: CartStatus, to: CartStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Queries ──────────────────────────────────────────────────────────────────
export async function findCart(id: string, storeId: string): Promise<Cart> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT * FROM carts WHERE id = $1 AND store_id = $2`,
    [id, storeId]
  );
  if (!row) throw new AppError(404, "Cart not found");
  return toCamel(row);
}

export async function listCarts(
  storeId: string,
  opts: { status?: CartStatus; limit?: number; offset?: number }
): Promise<{ data: Cart[]; total: number }> {
  const conditions = ["store_id = $1"];
  const params: unknown[] = [storeId];

  if (opts.status) {
    params.push(opts.status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.join(" AND ");
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  params.push(limit, offset);

  const [rows, countRow] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT * FROM carts WHERE ${where}
       ORDER BY updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM carts WHERE ${where}`,
      params.slice(0, -2)
    ),
  ]);

  return {
    data: rows.map(toCamel),
    total: parseInt(countRow?.count ?? "0", 10),
  };
}

export async function upsertCart(
  storeId: string,
  externalId: string,
  patch: Partial<Omit<Cart, "id" | "storeId" | "externalId" | "createdAt" | "updatedAt">>
): Promise<Cart> {
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO carts (store_id, external_id, customer_email, customer_name, total_price, line_items)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (store_id, external_id) DO UPDATE
       SET customer_email = EXCLUDED.customer_email,
           customer_name  = EXCLUDED.customer_name,
           total_price    = EXCLUDED.total_price,
           line_items     = EXCLUDED.line_items,
           updated_at     = NOW()
     RETURNING *`,
    [
      storeId,
      externalId,
      patch.customerEmail ?? "",
      patch.customerName ?? "",
      patch.totalPrice ?? 0,
      JSON.stringify(patch.lineItems ?? []),
    ]
  );
  return toCamel(row!);
}

export async function transitionCart(
  id: string,
  storeId: string,
  to: CartStatus
): Promise<Cart> {
  const cart = await findCart(id, storeId);

  if (!canTransition(cart.status, to)) {
    throw new AppError(
      422,
      `Cannot transition cart from '${cart.status}' to '${to}'`
    );
  }

  const extra: Record<string, unknown> = {};
  if (to === "abandoned") extra["abandoned_at"] = new Date();
  if (to === "recovered") extra["recovered_at"] = new Date();

  // $1=status, $2=id, $3=storeId; los valores de `extra` empiezan en $4.
  const setClauses = Object.keys(extra)
    .map((k, i) => `${k} = $${i + 4}`)
    .join(", ");

  const row = await queryOne<Record<string, unknown>>(
    `UPDATE carts
     SET status = $1 ${setClauses ? `, ${setClauses}` : ""}
     WHERE id = $2 AND store_id = $3
     RETURNING *`,
    [to, id, storeId, ...Object.values(extra)]
  );

  return toCamel(row!);
}

// ─── Row → camelCase ─────────────────────────────────────────────────────────
function toCamel(row: Record<string, unknown>): Cart {
  return {
    id:            row["id"] as string,
    storeId:       row["store_id"] as string,
    externalId:    row["external_id"] as string,
    customerEmail: row["customer_email"] as string,
    customerName:  row["customer_name"] as string,
    totalPrice:    Number(row["total_price"]),
    lineItems:     row["line_items"] as LineItem[],
    status:        row["status"] as CartStatus,
    abandonedAt:   row["abandoned_at"] ? new Date(row["abandoned_at"] as string) : null,
    recoveredAt:   row["recovered_at"] ? new Date(row["recovered_at"] as string) : null,
    createdAt:     new Date(row["created_at"] as string),
    updatedAt:     new Date(row["updated_at"] as string),
  };
}
