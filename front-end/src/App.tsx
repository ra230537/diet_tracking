import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/layout/Layout";
import { Toaster } from "./components/ui/toaster";
import Dashboard from "./pages/Dashboard";
import DietPlan from "./pages/DietPlan";
import BodyLog from "./pages/BodyLog";
import FoodAdmin from "./pages/FoodAdmin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/diet" element={<DietPlan />} />
            <Route path="/log" element={<BodyLog />} />
            <Route path="/foods" element={<FoodAdmin />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
