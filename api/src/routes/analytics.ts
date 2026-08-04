import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";

export const analyticsRouter = Router();

const SummaryQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

analyticsRouter.get("/summary", async (req, res) => {
  const { from, to } = SummaryQuerySchema.parse(req.query);
  const storeId = req.auth.storeId;

  const [cartStats, emailStats, daily] = await Promise.all([
    query<{
      carts_abandoned: string;
      carts_recovered: string;
      revenue_recovered: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('abandoned','in_sequence','recovered','closed')) AS carts_abandoned,
         COUNT(*) FILTER (WHERE status = 'recovered') AS carts_recovered,
         COALESCE(SUM(total_price) FILTER (WHERE status = 'recovered'), 0)   AS revenue_recovered
       FROM carts
       WHERE store_id = $1
         AND created_at BETWEEN $2 AND ($3::date + INTERVAL '1 day')`,
      [storeId, from, to]
    ),
    query<{
      emails_sent: string;
      emails_opened: string;
      emails_clicked: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE channel = 'email' AND status != 'pending') AS emails_sent,
         COUNT(*) FILTER (WHERE channel = 'email' AND status IN ('opened','clicked')) AS emails_opened,
         COUNT(*) FILTER (WHERE channel = 'email' AND status = 'clicked') AS emails_clicked
       FROM messages
       WHERE store_id = $1
         AND created_at BETWEEN $2 AND ($3::date + INTERVAL '1 day')`,
      [storeId, from, to]
    ),
    query<{
      date: string;
      carts_abandoned: string;
      carts_recovered: string;
      revenue_recovered: string;
    }>(
      `SELECT
         created_at::date AS date,
         COUNT(*) FILTER (WHERE status IN ('abandoned','in_sequence','recovered','closed')) AS carts_abandoned,
         COUNT(*) FILTER (WHERE status = 'recovered') AS carts_recovered,
         COALESCE(SUM(total_price) FILTER (WHERE status = 'recovered'), 0) AS revenue_recovered
       FROM carts
       WHERE store_id = $1
         AND created_at BETWEEN $2 AND ($3::date + INTERVAL '1 day')
       GROUP BY created_at::date
       ORDER BY date`,
      [storeId, from, to]
    ),
  ]);

  const cs  = cartStats[0]!;
  const es  = emailStats[0]!;
  const abandoned = parseInt(cs.carts_abandoned, 10);
  const recovered = parseInt(cs.carts_recovered, 10);
  const sent      = parseInt(es.emails_sent, 10);
  const opened    = parseInt(es.emails_opened, 10);
  const clicked   = parseInt(es.emails_clicked, 10);

  res.json({
    period: { from, to },
    cartsAbandoned:   abandoned,
    cartsRecovered:   recovered,
    recoveryRate:     abandoned > 0 ? (recovered / abandoned) * 100 : 0,
    revenueRecovered: parseFloat(cs.revenue_recovered),
    emailsSent:       sent,
    emailOpenRate:    sent > 0 ? (opened / sent) * 100 : 0,
    emailClickRate:   sent > 0 ? (clicked / sent) * 100 : 0,
    dailyBreakdown: daily.map((d) => ({
      date:             d.date,
      cartsAbandoned:   parseInt(d.carts_abandoned, 10),
      cartsRecovered:   parseInt(d.carts_recovered, 10),
      revenueRecovered: parseFloat(d.revenue_recovered),
    })),
  });
});
