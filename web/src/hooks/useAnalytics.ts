import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AnalyticsSummary } from "@/lib/types";

interface AnalyticsParams {
  from: string;
  to: string;
}

export function useAnalyticsSummary(params: AnalyticsParams) {
  const search = new URLSearchParams({
    from: params.from,
    to: params.to,
  }).toString();

  return useQuery({
    queryKey: ["analytics", "summary", params],
    queryFn: () => api.get<AnalyticsSummary>(`/api/analytics/summary?${search}`),
  });
}
