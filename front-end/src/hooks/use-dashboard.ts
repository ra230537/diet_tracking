import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { DashboardStats } from "@/lib/types";

export function useDashboardStats(days = 30) {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", days],
    queryFn: async () => {
      const { data } = await api.get("/dashboard/stats", {
        params: { days },
      });
      return data;
    },
  });
}
