import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { StagnationResult, ApplySuggestionRequest, DietPlanResponse } from "@/lib/types";

export function useCheckStagnation() {
  return useMutation<StagnationResult, Error, { user_id: string }>({
    mutationFn: async (payload) => {
      const { data } = await api.post("/coach/check-stagnation", payload);
      return data;
    },
  });
}

export function useApplySuggestion() {
  const queryClient = useQueryClient();

  return useMutation<DietPlanResponse, Error, ApplySuggestionRequest>({
    mutationFn: async (payload) => {
      const { data } = await api.post("/coach/apply-suggestion", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["diet-current"] });
    },
  });
}
