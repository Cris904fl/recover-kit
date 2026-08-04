import { useState, type FormEvent } from "react";
import { useCreateSequence, useUpdateSequence } from "@/hooks/useSequences";
import { ApiError } from "@/lib/api";
import type { MessageChannel, Sequence } from "@/lib/types";
import styles from "./NewSequenceModal.module.css";

interface StepDraft {
  channel: MessageChannel;
  delayMinutes: number;
  subject: string;
  body: string;
}

const emptyStep = (): StepDraft => ({
  channel: "email",
  delayMinutes: 60,
  subject: "",
  body: "",
});

const MAX_STEPS = 10;

function draftFromSequence(seq: Sequence): StepDraft[] {
  return seq.steps
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      channel: s.channel,
      delayMinutes: s.delayMinutes,
      subject: s.subject ?? "",
      body: s.body,
    }));
}

export function NewSequenceModal({
  sequence,
  onClose,
}: {
  sequence?: Sequence;
  onClose: () => void;
}) {
  const isEdit = Boolean(sequence);
  const create = useCreateSequence();
  const update = useUpdateSequence();
  const mutation = isEdit ? update : create;
  const [name, setName] = useState(sequence?.name ?? "");
  const [steps, setSteps] = useState<StepDraft[]>(
    sequence ? draftFromSequence(sequence) : [emptyStep()]
  );

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSteps((prev) => (prev.length < MAX_STEPS ? [...prev, emptyStep()] : prev));
  }

  function removeStep(index: number) {
    setSteps((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const canSubmit =
    name.trim().length > 0 && steps.every((s) => s.body.trim().length > 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const payload = {
      name: name.trim(),
      steps: steps.map((s, i) => ({
        position: i,
        delayMinutes: Number(s.delayMinutes) || 0,
        channel: s.channel,
        subject: s.channel === "email" ? s.subject.trim() || undefined : undefined,
        body: s.body.trim(),
      })),
    };
    try {
      if (isEdit && sequence) {
        await update.mutateAsync({ id: sequence.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch {
      /* el error se muestra desde mutation.error */
    }
  }

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? isEdit
          ? "No se pudo guardar la secuencia."
          : "No se pudo crear la secuencia."
        : null;

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <form
        className={styles.modal}
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className={styles.head}>
          <h2 className={styles.title}>{isEdit ? "Editar secuencia" : "Nueva secuencia"}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            &times;
          </button>
        </div>

        <div className={styles.body}>
          <label className={styles.field}>
            <span className={styles.label}>Nombre</span>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Recuperacion carrito abandonado"
              autoFocus
            />
          </label>

          <div className={styles.stepsHead}>
            <span className={styles.label}>Pasos ({steps.length})</span>
            <button
              type="button"
              className={styles.addStep}
              onClick={addStep}
              disabled={steps.length >= MAX_STEPS}
            >
              + Anadir paso
            </button>
          </div>

          {steps.map((step, i) => (
            <div key={i} className={styles.step}>
              <div className={styles.stepTop}>
                <span className={styles.stepNum}>#{i + 1}</span>
                <select
                  className={styles.select}
                  value={step.channel}
                  onChange={(e) =>
                    updateStep(i, { channel: e.target.value as MessageChannel })
                  }
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
                <label className={styles.delay}>
                  Espera
                  <input
                    className={styles.delayInput}
                    type="number"
                    min={0}
                    value={step.delayMinutes}
                    onChange={(e) =>
                      updateStep(i, { delayMinutes: Number(e.target.value) })
                    }
                  />
                  min
                </label>
                {steps.length > 1 && (
                  <button
                    type="button"
                    className={styles.removeStep}
                    onClick={() => removeStep(i)}
                    aria-label="Quitar paso"
                  >
                    Quitar
                  </button>
                )}
              </div>

              {step.channel === "email" && (
                <input
                  className={styles.input}
                  value={step.subject}
                  onChange={(e) => updateStep(i, { subject: e.target.value })}
                  placeholder="Asunto del email"
                />
              )}
              <textarea
                className={styles.textarea}
                value={step.body}
                onChange={(e) => updateStep(i, { body: e.target.value })}
                placeholder="Contenido del mensaje…"
                rows={2}
              />
            </div>
          ))}

          {errorMessage && <div className={styles.error}>{errorMessage}</div>}
        </div>

        <div className={styles.foot}>
          <button type="button" className={styles.btnCancel} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className={styles.btnCreate}
            disabled={!canSubmit || mutation.isPending}
          >
            {mutation.isPending
              ? "Guardando…"
              : isEdit
                ? "Guardar cambios"
                : "Crear secuencia"}
          </button>
        </div>
      </form>
    </div>
  );
}
