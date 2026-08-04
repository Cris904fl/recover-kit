import { query, queryOne } from "../db.js";
import { AppError } from "../middleware/errorHandler.js";

export interface Sequence {
  id: string;
  storeId: string;
  name: string;
  isActive: boolean;
  steps: SequenceStep[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  position: number;
  delayMinutes: number;
  channel: "email" | "sms";
  subject?: string;
  body: string;
  createdAt: Date;
}

export async function listSequences(storeId: string): Promise<Sequence[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT s.*, COALESCE(
       json_agg(ss ORDER BY ss.position) FILTER (WHERE ss.id IS NOT NULL), '[]'
     ) AS steps
     FROM sequences s
     LEFT JOIN sequence_steps ss ON ss.sequence_id = s.id
     WHERE s.store_id = $1
     GROUP BY s.id
     ORDER BY s.created_at DESC`,
    [storeId]
  );
  return rows.map(toCamel);
}

export async function findSequence(id: string, storeId: string): Promise<Sequence> {
  const rows = await query<Record<string, unknown>>(
    `SELECT s.*, COALESCE(
       json_agg(ss ORDER BY ss.position) FILTER (WHERE ss.id IS NOT NULL), '[]'
     ) AS steps
     FROM sequences s
     LEFT JOIN sequence_steps ss ON ss.sequence_id = s.id
     WHERE s.id = $1 AND s.store_id = $2
     GROUP BY s.id`,
    [id, storeId]
  );
  if (!rows[0]) throw new AppError(404, "Sequence not found");
  return toCamel(rows[0]);
}

export async function createSequence(
  storeId: string,
  name: string,
  steps: Omit<SequenceStep, "id" | "sequenceId" | "createdAt">[]
): Promise<Sequence> {
  const seq = await queryOne<Record<string, unknown>>(
    `INSERT INTO sequences (store_id, name) VALUES ($1, $2) RETURNING *`,
    [storeId, name]
  );
  if (!seq) throw new Error("Insert failed");

  if (steps.length > 0) {
    await Promise.all(
      steps.map((step, i) =>
        query(
          `INSERT INTO sequence_steps
             (sequence_id, position, delay_minutes, channel, subject, body)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [seq["id"], i, step.delayMinutes, step.channel, step.subject ?? null, step.body]
        )
      )
    );
  }

  return findSequence(seq["id"] as string, storeId);
}

export interface UpdateSequencePatch {
  name?: string;
  isActive?: boolean;
  steps?: Omit<SequenceStep, "id" | "sequenceId" | "createdAt">[];
}

export async function updateSequence(
  id: string,
  storeId: string,
  patch: UpdateSequencePatch
): Promise<Sequence> {
  // Verificar pertenencia antes de tocar nada.
  const owned = await queryOne<{ id: string }>(
    `SELECT id FROM sequences WHERE id = $1 AND store_id = $2`,
    [id, storeId]
  );
  if (!owned) throw new AppError(404, "Sequence not found");

  if (patch.name === undefined && patch.isActive === undefined && !patch.steps) {
    throw new AppError(422, "Nothing to update");
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) {
    values.push(patch.name);
    fields.push(`name = $${values.length}`);
  }
  if (patch.isActive !== undefined) {
    values.push(patch.isActive);
    fields.push(`is_active = $${values.length}`);
  }

  if (fields.length > 0) {
    values.push(id, storeId);
    await query(
      `UPDATE sequences SET ${fields.join(", ")}
       WHERE id = $${values.length - 1} AND store_id = $${values.length}`,
      values
    );
  }

  // Reemplazar los pasos por completo si vienen en el patch.
  if (patch.steps) {
    await query(`DELETE FROM sequence_steps WHERE sequence_id = $1`, [id]);
    await Promise.all(
      patch.steps.map((step, i) =>
        query(
          `INSERT INTO sequence_steps
             (sequence_id, position, delay_minutes, channel, subject, body)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, i, step.delayMinutes, step.channel, step.subject ?? null, step.body]
        )
      )
    );
  }

  return findSequence(id, storeId);
}

export async function deleteSequence(id: string, storeId: string): Promise<void> {
  const row = await queryOne<{ id: string }>(
    `DELETE FROM sequences WHERE id = $1 AND store_id = $2 RETURNING id`,
    [id, storeId]
  );
  if (!row) throw new AppError(404, "Sequence not found");
}

function toCamel(row: Record<string, unknown>): Sequence {
  const steps = (row["steps"] as Record<string, unknown>[]).map((s) => ({
    id:           s["id"] as string,
    sequenceId:   s["sequence_id"] as string,
    position:     s["position"] as number,
    delayMinutes: s["delay_minutes"] as number,
    channel:      s["channel"] as "email" | "sms",
    subject:      s["subject"] as string | undefined,
    body:         s["body"] as string,
    createdAt:    new Date(s["created_at"] as string),
  }));

  return {
    id:        row["id"] as string,
    storeId:   row["store_id"] as string,
    name:      row["name"] as string,
    isActive:  row["is_active"] as boolean,
    steps,
    createdAt: new Date(row["created_at"] as string),
    updatedAt: new Date(row["updated_at"] as string),
  };
}
