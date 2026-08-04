import type { Cart } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmt } from "@/lib/formatters";
import styles from "./CartsTable.module.css";

interface CartsTableProps {
  carts: Cart[];
  onSelect?: (cart: Cart) => void;
  onSendRecovery?: (cart: Cart) => void;
  onEnroll?: (cart: Cart) => void;
  sendingId?: string | null;
  enrollingId?: string | null;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function CartsTable({
  carts,
  onSelect,
  onSendRecovery,
  onEnroll,
  sendingId,
  enrollingId,
}: CartsTableProps) {
  const canSend = Boolean(onSendRecovery);
  const canEnroll = Boolean(onEnroll);
  const hasActions = canSend || canEnroll;
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.title}>Recent carts</h3>
        <span className={styles.count}>{fmt.number(carts.length)} carts</span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Cart value</th>
            <th>Abandoned</th>
            <th>Status</th>
            {hasActions && <th></th>}
          </tr>
        </thead>
        <tbody>
          {carts.map((cart) => (
            <tr
              key={cart.id}
              onClick={() => onSelect?.(cart)}
              className={onSelect ? styles.clickable : undefined}
            >
              <td>
                <div className={styles.customer}>
                  <div className={styles.avatar}>{initials(cart.customerName)}</div>
                  <div>
                    <div className={styles.name}>{cart.customerName}</div>
                    <div className={styles.email}>{cart.customerEmail}</div>
                  </div>
                </div>
              </td>
              <td>{fmt.currency(cart.totalPrice)}</td>
              <td>{cart.abandonedAt ? fmt.relativeTime(cart.abandonedAt) : "—"}</td>
              <td><StatusBadge status={cart.status} /></td>
              {hasActions && (
                <td>
                  <div className={styles.actions}>
                    {canSend && (
                      <button
                        className={styles.sendBtn}
                        disabled={sendingId === cart.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSendRecovery?.(cart);
                        }}
                      >
                        {sendingId === cart.id ? "Enviando…" : "Enviar correo"}
                      </button>
                    )}
                    {canEnroll && (
                      <button
                        className={styles.sendBtn}
                        disabled={enrollingId === cart.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEnroll?.(cart);
                        }}
                      >
                        {enrollingId === cart.id ? "Iniciando…" : "Iniciar secuencia"}
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
