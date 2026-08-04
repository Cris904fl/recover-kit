import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Cart, CartStatus } from "@/lib/types";

interface CartsParams {
  status?: CartStatus;
  page?: number;
  limit?: number;
}

interface CartsResponse {
  data: Cart[];
  total: number;
  page: number;
  limit: number;
}

export function useCarts(params: CartsParams = {}) {
  const search = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();

  return useQuery({
    queryKey: ["carts", params],
    queryFn: () => api.get<CartsResponse>(`/api/carts?${search}`),
  });
}

export function useCart(id: string) {
  return useQuery({
    queryKey: ["carts", id],
    queryFn: () => api.get<Cart>(`/api/carts/${id}`),
    enabled: Boolean(id),
  });
}

export function useMarkRecovered() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cartId: string) =>
      api.patch<Cart>(`/api/carts/${cartId}`, { status: "recovered" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["carts"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export interface RecoveryResult {
  messageId: string;
  cartId: string;
  to: string;
  channel: string;
  subject: string | null;
  status: string;
  providerId: string | null;
  error: string | null;
  previewUrl: string | null;
}

export function useSendRecovery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cartId: string) =>
      api.post<RecoveryResult>(`/api/carts/${cartId}/send-recovery`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["carts"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export interface EnrollResult {
  cartId: string;
  sequence: string;
  stepsQueued: number;
  schedule: { position: number; channel: string; dueInMinutes: number }[];
}

export function useEnrollCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cartId: string) =>
      api.post<EnrollResult>(`/api/carts/${cartId}/enroll`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["carts"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
