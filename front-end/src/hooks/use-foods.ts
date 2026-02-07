import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { FoodItemResponse, FoodItemCreate, ImportResult } from "@/lib/types";

export function useFoods(search = "", skip = 0, limit = 50) {
  return useQuery<FoodItemResponse[]>({
    queryKey: ["foods", search, skip, limit],
    queryFn: async () => {
      const { data } = await api.get("/foods/", {
        params: { search: search || undefined, skip, limit },
      });
      return data;
    },
  });
}

export function useCreateFood() {
  const queryClient = useQueryClient();

  return useMutation<FoodItemResponse, Error, FoodItemCreate>({
    mutationFn: async (payload) => {
      const { data } = await api.post("/foods/", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foods"] });
    },
  });
}

export function useImportTaco() {
  const queryClient = useQueryClient();

  return useMutation<ImportResult, Error, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/foods/import-taco", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foods"] });
    },
  });
}
