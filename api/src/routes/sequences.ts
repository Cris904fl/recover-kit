import { Router } from "express";
import { z } from "zod";
import {
  listSequences,
  findSequence,
  createSequence,
  updateSequence,
  deleteSequence,
  type SequenceStep,
  type UpdateSequencePatch,
} from "../models/sequence.js";

export const sequencesRouter = Router();

const StepSchema = z.object({
  position:     z.number().int().min(0),
  delayMinutes: z.number().int().min(0),
  channel:      z.enum(["email", "sms"]),
  subject:      z.string().optional(),
  body:         z.string().min(1),
});

const CreateSchema = z.object({
  name:  z.string().min(1).max(120),
  steps: z.array(StepSchema).min(1).max(10),
});

const PatchSchema = z.object({
  name:     z.string().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
  steps:    z.array(StepSchema).min(1).max(10).optional(),
});

sequencesRouter.get("/", async (req, res) => {
  const sequences = await listSequences(req.auth.storeId);
  res.json(sequences);
});

sequencesRouter.get("/:id", async (req, res) => {
  const seq = await findSequence(req.params["id"]!, req.auth.storeId);
  res.json(seq);
});

sequencesRouter.post("/", async (req, res) => {
  const { name, steps } = CreateSchema.parse(req.body);
  const mappedSteps: Omit<SequenceStep, "id" | "sequenceId" | "createdAt">[] = steps.map(s => ({
    position:     s.position,
    delayMinutes: s.delayMinutes,
    channel:      s.channel,
    subject:      s.subject,
    body:         s.body,
  }));
  const seq = await createSequence(req.auth.storeId, name, mappedSteps);
  res.status(201).json(seq);
});

sequencesRouter.patch("/:id", async (req, res) => {
  const raw = PatchSchema.parse(req.body);
  const patch: UpdateSequencePatch = {};
  if (raw.name !== undefined) patch.name = raw.name;
  if (raw.isActive !== undefined) patch.isActive = raw.isActive;
  if (raw.steps !== undefined) {
    patch.steps = raw.steps.map((s) => ({
      position:     s.position,
      delayMinutes: s.delayMinutes,
      channel:      s.channel,
      subject:      s.subject,
      body:         s.body,
    }));
  }
  const seq = await updateSequence(req.params["id"]!, req.auth.storeId, patch);
  res.json(seq);
});

sequencesRouter.delete("/:id", async (req, res) => {
  await deleteSequence(req.params["id"]!, req.auth.storeId);
  res.status(204).end();
});
