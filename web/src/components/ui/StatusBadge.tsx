import type { CartStatus, MessageStatus } from "@/lib/types";
import styles from "./StatusBadge.module.css";
import { clsx } from "clsx";

type Status = CartStatus | MessageStatus;

const LABELS: Record<Status, string> = {
  idle: "Idle",
  abandoned: "Abandoned",
  in_sequence: "In sequence",
  recovered: "Recovered",
  closed: "Closed",
  pending: "Pending",
  sent: "Sent",
  opened: "Opened",
  clicked: "Clicked",
  failed: "Failed",
};

const VARIANTS: Record<Status, string> = {
  idle: "neutral",
  abandoned: "warning",
  in_sequence: "info",
  recovered: "success",
  closed: "neutral",
  pending: "neutral",
  sent: "info",
  opened: "purple",
  clicked: "success",
  failed: "danger",
};

interface StatusBadgeProps {
  status: Status;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={clsx(styles.badge, styles[VARIANTS[status] ?? "neutral"])}>
      {LABELS[status] ?? status}
    </span>
  );
}
