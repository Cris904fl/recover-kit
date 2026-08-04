import { useState } from "react";
import {
  useSequences,
  useToggleSequence,
  useDeleteSequence,
} from "@/hooks/useSequences";
import { NewSequenceModal } from "@/components/sequences/NewSequenceModal";
import type { Sequence } from "@/lib/types";
import styles from "./SequencesPage.module.css";

export function SequencesPage() {
  const { data: sequences, isLoading } = useSequences();
  const toggle = useToggleSequence();
  const remove = useDeleteSequence();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Sequence | null>(null);

  const modalOpen = creating || editing !== null;

  function closeModal() {
    setCreating(false);
    setEditing(null);
  }

  function onDelete(seq: Sequence) {
    if (window.confirm(`¿Eliminar la secuencia "${seq.name}"? Esta accion no se puede deshacer.`)) {
      remove.mutate(seq.id);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Sequences</h1>
        <button className={styles.btnCreate} onClick={() => setCreating(true)}>
          + New sequence
        </button>
      </div>

      {modalOpen && (
        <NewSequenceModal sequence={editing ?? undefined} onClose={closeModal} />
      )}

      {isLoading && <p className={styles.loading}>Loading sequences…</p>}

      {sequences && sequences.length === 0 && (
        <p className={styles.loading}>
          Aun no tienes secuencias. Crea la primera con “+ New sequence”.
        </p>
      )}

      {sequences && sequences.length > 0 && (
        <div className={styles.list}>
          {sequences.map((seq) => (
            <div key={seq.id} className={styles.card}>
              <div className={styles.cardLeft}>
                <div className={styles.seqName}>{seq.name}</div>
                <div className={styles.seqMeta}>
                  {seq.steps.length} step{seq.steps.length !== 1 ? "s" : ""} &middot; created{" "}
                  {new Date(seq.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className={styles.cardRight}>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={seq.isActive}
                    onChange={() => toggle.mutate({ id: seq.id, isActive: !seq.isActive })}
                  />
                  <span className={styles.toggleTrack} />
                </label>
                <span className={styles.toggleLabel}>{seq.isActive ? "Active" : "Paused"}</span>
                <button className={styles.action} onClick={() => setEditing(seq)}>
                  Editar
                </button>
                <button
                  className={`${styles.action} ${styles.danger}`}
                  onClick={() => onDelete(seq)}
                  disabled={remove.isPending}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
