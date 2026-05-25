import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, BookOpen, GraduationCap, Wallet, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, enabled: true },
  { title: "Alunos", url: "/alunos", icon: Users, enabled: true },
  { title: "Cursos", url: "/cursos", icon: BookOpen, enabled: true },
  { title: "Matrículas", url: "#", icon: GraduationCap, enabled: false },
  { title: "Financeiro", url: "#", icon: Wallet, enabled: false },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();

  const isActive = (url: string) => {
    if (url === "/") return path === "/";
    return path === url || path.startsWith(url + "/");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col min-h-screen">
      <div className="px-6 py-6 border-b border-sidebar-border">
        <h1 className="text-2xl font-bold tracking-tight">
          Edu<span className="text-sidebar-primary">Manager</span>
        </h1>
        <p className="text-xs text-sidebar-foreground/60 mt-1">Painel Administrativo</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.enabled && isActive(item.url);
          if (!item.enabled) {
            return (
              <div
                key={item.title}
                className="flex items-center justify-between px-3 py-2.5 rounded-md text-sidebar-foreground/40 cursor-not-allowed"
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{item.title}</span>
                </span>
                <Badge variant="secondary" className="text-[10px] bg-sidebar-accent text-sidebar-accent-foreground/70">
                  Em breve
                </Badge>
              </div>
            );
          }
          return (
            <Link
              key={item.title}
              to={item.url}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
