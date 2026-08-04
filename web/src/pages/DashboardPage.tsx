import { useAnalyticsSummary } from "@/hooks/useAnalytics";
import { useCarts } from "@/hooks/useCarts";
import { MetricCard } from "@/components/ui/MetricCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { CartsTable } from "@/components/dashboard/CartsTable";
import { fmt } from "@/lib/formatters";
import styles from "./DashboardPage.module.css";

const PERIOD = {
  from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!,
  to: new Date().toISOString().split("T")[0]!,
};

const EMPTY_SUMMARY = {
  revenueRecovered: 0,
  cartsAbandoned: 0,
  recoveryRate: 0,
  emailOpenRate: 0,
  emailsSent: 0,
  dailyBreakdown: [],
};

export function DashboardPage() {
  const summary = useAnalyticsSummary(PERIOD);
  const carts = useCarts({ limit: 10 });
  const data = summary.data ?? EMPTY_SUMMARY;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Last 30 days</p>
        </div>
      </div>
      <div className={styles.metrics}>
        <MetricCard
          label="Revenue recovered"
          value={fmt.currency(data.revenueRecovered)}
          sub="+18% vs last month"
          trend="up"
        />
        <MetricCard
          label="Carts abandoned"
          value={fmt.number(data.cartsAbandoned)}
          sub="+7% vs last month"
          trend="down"
        />
        <MetricCard
          label="Recovery rate"
          value={fmt.percent(data.recoveryRate)}
          sub="+2.1 pts"
          trend="up"
        />
        <MetricCard
          label="Email open rate"
          value={fmt.percent(data.emailOpenRate)}
          sub={`${fmt.number(data.emailsSent)} sent`}
          trend="up"
        />
      </div>
      {summary.data && <RevenueChart data={summary.data.dailyBreakdown} />}
      {carts.data && <CartsTable carts={carts.data.data} />}
    </div>
  );
}
