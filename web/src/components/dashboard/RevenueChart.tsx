import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DailyBreakdown } from "@/lib/types";
import { fmt } from "@/lib/formatters";
import styles from "./RevenueChart.module.css";

interface RevenueChartProps {
  data: DailyBreakdown[];
}

function formatDay(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function RevenueChart({ data }: RevenueChartProps) {
  const chartData = data.map((d) => ({
    date: formatDay(d.date),
    recovered: d.revenueRecovered,
    abandoned: d.cartsAbandoned,
  }));

  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>Revenue recovered — daily</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#888780" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#888780" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              name === "recovered" ? fmt.currency(value) : fmt.number(value),
              name === "recovered" ? "Recovered revenue" : "Carts abandoned",
            ]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          />
          <Legend
            formatter={(v) => (v === "recovered" ? "Revenue recovered" : "Carts abandoned")}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="recovered" fill="#7F77DD" radius={[3, 3, 0, 0]} />
          <Bar dataKey="abandoned" fill="#D3D1C7" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
