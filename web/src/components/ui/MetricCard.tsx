import styles from "./MetricCard.module.css";
import { clsx } from "clsx";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
}

export function MetricCard({ label, value, sub, trend = "neutral" }: MetricCardProps) {
  return (
    <div className={styles.card}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {sub && (
        <span className={clsx(styles.sub, trend && styles[trend])}>{sub}</span>
      )}
    </div>
  );
}
