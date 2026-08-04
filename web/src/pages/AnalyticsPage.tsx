import { useState } from "react";
import { useAnalyticsSummary } from "@/hooks/useAnalytics";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { MetricCard } from "@/components/ui/MetricCard";
import { fmt } from "@/lib/formatters";
import styles from "./AnalyticsPage.module.css";

const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

function periodFor(days: number) {
  return {
    from: new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0]!,
    to: new Date().toISOString().split("T")[0]!,
  };
}

export function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useAnalyticsSummary(periodFor(days));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Analytics</h1>
        <div className={styles.ranges}>
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={[styles.range, days === r.days ? styles.active : ""].join(" ")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className={styles.loading}>Loading analytics…</p>}

      {data && (
        <>
          <div className={styles.metrics}>
            <MetricCard label="Revenue recovered" value={fmt.currency(data.revenueRecovered)} />
            <MetricCard label="Recovery rate" value={fmt.percent(data.recoveryRate)} trend="up" />
            <MetricCard label="Emails sent" value={fmt.number(data.emailsSent)} />
            <MetricCard label="Open rate" value={fmt.percent(data.emailOpenRate)} trend="up" />
            <MetricCard label="Click rate" value={fmt.percent(data.emailClickRate)} trend="up" />
            <MetricCard label="Carts recovered" value={fmt.number(data.cartsRecovered)} />
          </div>
          <RevenueChart data={data.dailyBreakdown} />
        </>
      )}
    </div>
  );
}
