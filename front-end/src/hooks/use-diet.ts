import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type {
  DietPlanFullResponse,
  MealCreate,
  MealResponse,
  MealItemCreate,
  MealItemResponse,
  DietPlanCreate,
  DietPlanResponse,
  MessageResponse,
} from "@/lib/types";

export function useCurrentDietPlan(userId = "default_user") {
  return useQuery<DietPlanFullResponse>({
    queryKey: ["diet-current", userId],
    queryFn: async () => {
      const { data } = await api.get("/diet/current", {
        params: { user_id: userId },
      });
      return data;
    },
    retry: false,
  });
}

export function useCreateDietPlan() {
  const queryClient = useQueryClient();

  return useMutation<DietPlanResponse, Error, DietPlanCreate>({
    mutationFn: async (payload) => {
      const { data } = await api.post("/diet/plans", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diet-current"] });
    },
  });
}

export function useAddMeal() {
  const queryClient = useQueryClient();

  return useMutation<MealResponse, Error, { planId: number; meal: MealCreate }>({
    mutationFn: async ({ planId, meal }) => {
      const { data } = await api.post(`/diet/plans/${planId}/meals`, meal);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diet-current"] });
    },
  });
}

export function useAddMealItem() {
  const queryClient = useQueryClient();

  return useMutation<MealItemResponse, Error, { mealId: number; item: MealItemCreate }>({
    mutationFn: async ({ mealId, item }) => {
      const { data } = await api.post(`/diet/meals/${mealId}/add_item`, item);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diet-current"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useRemoveMealItem() {
  const queryClient = useQueryClient();

  return useMutation<MessageResponse, Error, number>({
    mutationFn: async (itemId) => {
      const { data } = await api.delete(`/diet/meal-items/${itemId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diet-current"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUpdateDietPlanTargets() {
  const queryClient = useQueryClient();

  return useMutation<
    DietPlanResponse,
    Error,
    { planId: number; targets: Partial<Pick<DietPlanResponse, "target_calories" | "target_protein" | "target_carbs" | "target_fat">> }
  >({
    mutationFn: async ({ planId, targets }) => {
      const { data } = await api.put(`/diet/plans/${planId}/targets`, targets);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diet-current"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUpdateMealItem() {
  const queryClient = useQueryClient();

  return useMutation<MealItemResponse, Error, { itemId: number; quantity_grams: number }>({
    mutationFn: async ({ itemId, quantity_grams }) => {
      const { data } = await api.put(`/diet/meal-items/${itemId}`, { quantity_grams });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diet-current"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
