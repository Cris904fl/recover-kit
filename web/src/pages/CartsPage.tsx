import { useState } from "react";
import {
  useCarts,
  useSendRecovery,
  useEnrollCart,
  type RecoveryResult,
  type EnrollResult,
} from "@/hooks/useCarts";
import { CartsTable } from "@/components/dashboard/CartsTable";
import { ApiError } from "@/lib/api";
import type { Cart, CartStatus } from "@/lib/types";
import styles from "./CartsPage.module.css";

const STATUS_OPTIONS: { label: string; value: CartStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Abandoned", value: "abandoned" },
  { label: "In sequence", value: "in_sequence" },
  { label: "Recovered", value: "recovered" },
  { label: "Closed", value: "closed" },
];

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export function CartsPage() {
  const [status, setStatus] = useState<CartStatus | "">("");
  const { data, isLoading } = useCarts({ status: status || undefined, limit: 50 });
  const sendRecovery = useSendRecovery();
  const enroll = useEnrollCart();
  const [result, setResult] = useState<RecoveryResult | null>(null);
  const [enrollResult, setEnrollResult] = useState<EnrollResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function reset() {
    setResult(null);
    setEnrollResult(null);
    setErrorMsg(null);
  }

  async function onSendRecovery(cart: Cart) {
    reset();
    try {
      setResult(await sendRecovery.mutateAsync(cart.id));
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.message : "No se pudo enviar el correo.");
    }
  }

  async function onEnroll(cart: Cart) {
    reset();
    try {
      setEnrollResult(await enroll.mutateAsync(cart.id));
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.message : "No se pudo iniciar la secuencia.");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Carts</h1>
        <div className={styles.filters}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={[styles.filter, status === opt.value ? styles.active : ""].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && <div className={styles.bannerError}>{errorMsg}</div>}

      {enrollResult && (
        <div className={styles.bannerOk}>
          <strong>Secuencia “{enrollResult.sequence}” iniciada</strong> ·{" "}
          {enrollResult.stepsQueued} mensaje(s) programado(s). El despachador los enviará
          al vencer:{" "}
          {enrollResult.schedule
            .map((s) => `#${s.position + 1} ${s.channel} en ${s.dueInMinutes}min`)
            .join(", ")}
          .
        </div>
      )}

      {result && (
        <div className={result.status === "sent" ? styles.bannerOk : styles.bannerError}>
          {result.status === "sent" ? (
            <>
              <strong>
                {result.channel === "email" ? "Correo" : "SMS"} enviado a {result.to}
              </strong>
              {result.subject && <> · Asunto: “{result.subject}”</>}
              {result.previewUrl ? (
                <>
                  {" · "}
                  <a
                    className={styles.bannerLink}
                    href={`${API_BASE}${result.previewUrl}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver correo →
                  </a>
                </>
              ) : (
                <> · enviado vía Resend (id: {result.providerId})</>
              )}
            </>
          ) : (
            <>
              <strong>Fallo el envío</strong>
              {result.error && <> · {result.error}</>}
            </>
          )}
        </div>
      )}

      {isLoading && <p className={styles.loading}>Loading carts…</p>}
      {data && (
        <CartsTable
          carts={data.data}
          onSendRecovery={onSendRecovery}
          onEnroll={onEnroll}
          sendingId={sendRecovery.isPending ? sendRecovery.variables : null}
          enrollingId={enroll.isPending ? enroll.variables : null}
        />
      )}
    </div>
  );
}
