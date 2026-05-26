import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, BookOpen, GraduationCap, Wallet, LogOut, ShieldPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, enabled: true },
  { title: "Alunos", url: "/alunos", icon: Users, enabled: true },
  { title: "Cursos", url: "/cursos", icon: BookOpen, enabled: true },
  { title: "Pacotes", url: "/pacotes", icon: Wallet, enabled: true },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const [recreating, setRecreating] = useState(false);

  const isActive = (url: string) => {
    if (url === "/") return path === "/";
    return path === url || path.startsWith(url + "/");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const handleRecreateAdmin = async () => {
    if (!confirm("Recriar/resetar o usuário admin com as credenciais configuradas nas variáveis do projeto?")) return;
    setRecreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-student-access", {
        body: { action: "recreate_admin" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success((data as any)?.message ?? "Admin recriado", {
        description: (data as any)?.email,
      });
    } catch (e: any) {
      toast.error("Falha ao recriar admin", { description: e?.message ?? String(e) });
    } finally {
      setRecreating(false);
    }
  };

  return (
    <aside className="w-64 bg-[#1E3A5F] text-white flex flex-col min-h-screen">
      <div className="px-6 py-6 border-b border-white/10">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-white">Soluções</span> <span className="text-[#2ECC71]">Online</span>
        </h1>
        <p className="text-xs text-white/60 mt-1">Painel Administrativo</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.enabled && isActive(item.url);
          if (!item.enabled) {
            return (
              <div
                key={item.title}
                className="flex items-center justify-between px-3 py-2.5 rounded-md text-white/40 cursor-not-allowed"
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{item.title}</span>
                </span>
                <Badge variant="secondary" className="text-[10px] bg-[#2ECC71]/20 text-[#2ECC71]">
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
                  : "hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10 space-y-1">
        <Button
          variant="ghost"
          className="w-full justify-start text-white hover:bg-white/10 hover:text-white"
          onClick={handleRecreateAdmin}
          disabled={recreating}
        >
          {recreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldPlus className="h-4 w-4 mr-2" />}
          Recriar Admin
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start text-white hover:bg-white/10 hover:text-white"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
