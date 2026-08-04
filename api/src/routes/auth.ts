import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { queryOne } from "../db.js";
import { AppError } from "../middleware/errorHandler.js";
import { authenticate, type AuthPayload } from "../middleware/authenticate.js";

export const authRouter = Router();

function issueToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "7d" });
}

// ─── Register: crea una tienda + usuario owner ─────────────────────────────────
const RegisterSchema = z.object({
  storeName: z.string().min(1).max(120),
  domain: z.string().min(3).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

authRouter.post("/register", async (req, res) => {
  const { storeName, domain, email, password } = RegisterSchema.parse(req.body);

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [email]
  );
  if (existing) throw new AppError(409, "Email already registered");

  const store = await queryOne<{ id: string }>(
    `INSERT INTO stores (domain, name, webhook_secret) VALUES ($1, $2, $3) RETURNING id`,
    [domain, storeName, config.webhookSecret]
  );

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await queryOne<{ id: string; role: "owner" | "member" }>(
    `INSERT INTO users (store_id, email, password_hash, role)
     VALUES ($1, $2, $3, 'owner') RETURNING id, role`,
    [store!.id, email, passwordHash]
  );

  const token = issueToken({ userId: user!.id, storeId: store!.id, role: user!.role });
  res.status(201).json({
    token,
    user: { id: user!.id, email, role: user!.role, storeId: store!.id },
  });
});

// ─── Login ─────────────────────────────────────────────────────────────────────
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = LoginSchema.parse(req.body);

  const user = await queryOne<{
    id: string;
    store_id: string;
    password_hash: string;
    role: "owner" | "member";
  }>(
    `SELECT id, store_id, password_hash, role FROM users WHERE email = $1`,
    [email]
  );

  // Mismo mensaje para email inexistente o password erronea (no filtrar cuentas).
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError(401, "Invalid email or password");
  }

  const token = issueToken({
    userId: user.id,
    storeId: user.store_id,
    role: user.role,
  });
  res.json({
    token,
    user: { id: user.id, email, role: user.role, storeId: user.store_id },
  });
});

// ─── Me: identidad del usuario autenticado ─────────────────────────────────────
authRouter.get("/me", authenticate, async (req, res) => {
  const row = await queryOne<{
    id: string;
    email: string;
    role: string;
    store_id: string;
    store_name: string;
    domain: string;
  }>(
    `SELECT u.id, u.email, u.role, s.id AS store_id, s.name AS store_name, s.domain
     FROM users u JOIN stores s ON s.id = u.store_id
     WHERE u.id = $1`,
    [req.auth.userId]
  );
  if (!row) throw new AppError(404, "User not found");

  res.json({
    id: row.id,
    email: row.email,
    role: row.role,
    store: { id: row.store_id, name: row.store_name, domain: row.domain },
  });
});
