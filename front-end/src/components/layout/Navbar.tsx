import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Utensils,
  Dumbbell,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/diet", label: "Dieta", icon: Utensils },
  { to: "/log", label: "Registro Corporal", icon: Dumbbell },
  { to: "/foods", label: "Alimentos", icon: Database },
];

export function Navbar() {
  const location = useLocation();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-50">
        <div className="flex flex-col flex-grow bg-card border-r overflow-y-auto">
          <div className="flex items-center gap-3 px-6 py-5 border-b">
            <Dumbbell className="h-7 w-7 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">Bulking Control</h1>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-6 py-4 border-t text-xs text-muted-foreground">
            Bulking Control v1.0
          </div>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1 text-xs transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
