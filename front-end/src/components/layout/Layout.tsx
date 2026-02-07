import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="md:pl-64">
        <div className="p-4 md:p-8 pb-20 md:pb-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
