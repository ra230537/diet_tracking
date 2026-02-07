import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { BodyLogCreate, BodyLogResponse, MessageResponse } from "@/lib/types";

export function useBodyLogs(
  userId = "default_user",
  startDate?: string,
  endDate?: string,
  skip = 0,
  limit = 50
) {
  return useQuery<BodyLogResponse[]>({
    queryKey: ["body-logs", userId, startDate, endDate, skip, limit],
    queryFn: async () => {
      const { data } = await api.get("/body-logs/", {
        params: {
          user_id: userId,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          skip,
          limit,
        },
      });
      return data;
    },
  });
}

export function useCreateBodyLog() {
  const queryClient = useQueryClient();

  return useMutation<BodyLogResponse, Error, BodyLogCreate>({
    mutationFn: async (payload) => {
      const { data } = await api.post("/body-logs/", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUpdateBodyLog() {
  const queryClient = useQueryClient();

  return useMutation<BodyLogResponse, Error, { id: number; data: Partial<BodyLogCreate> }>({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.put(`/body-logs/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useDeleteBodyLog() {
  const queryClient = useQueryClient();

  return useMutation<MessageResponse, Error, number>({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/body-logs/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
