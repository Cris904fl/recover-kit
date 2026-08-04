import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Sequence, MessageChannel } from "@/lib/types";

export interface CreateSequenceStepInput {
  position: number;
  delayMinutes: number;
  channel: MessageChannel;
  subject?: string;
  body: string;
}

export interface CreateSequenceInput {
  name: string;
  steps: CreateSequenceStepInput[];
}

export interface UpdateSequenceInput {
  name?: string;
  isActive?: boolean;
  steps?: CreateSequenceStepInput[];
}

export function useSequences() {
  return useQuery({
    queryKey: ["sequences"],
    queryFn: () => api.get<Sequence[]>("/api/sequences"),
  });
}

export function useSequence(id: string) {
  return useQuery({
    queryKey: ["sequences", id],
    queryFn: () => api.get<Sequence>(`/api/sequences/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSequenceInput) =>
      api.post<Sequence>("/api/sequences", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sequences"] }),
  });
}

export function useUpdateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateSequenceInput & { id: string }) =>
      api.patch<Sequence>(`/api/sequences/${id}`, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["sequences"] });
      qc.invalidateQueries({ queryKey: ["sequences", id] });
    },
  });
}

export function useDeleteSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/sequences/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sequences"] }),
  });
}

export function useToggleSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<Sequence>(`/api/sequences/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sequences"] }),
  });
}
