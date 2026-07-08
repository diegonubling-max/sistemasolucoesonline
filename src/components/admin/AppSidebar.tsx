import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Users, BookOpen, GraduationCap, Wallet, LogOut, ShieldPlus, Loader2, Tags, Settings, ChevronDown, Check, KeyRound, ClipboardCheck, Crown, UsersRound, HeartHandshake, CalendarCheck, FileText } from "lucide-react";
import { ChangePasswordModal } from "@/components/admin/ChangePasswordModal";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

type SidebarItem = {
  title: string;
  url: string;
  icon: any;
  enabled: boolean;
  perm?: string;
  anyPerm?: string[];
  adminOnly?: boolean;
  responsavelOnly?: boolean;
  vendedorOnly?: boolean;
  hideForVendedor?: boolean;
  posVendaOrAdmin?: boolean;
  documentacaoAccess?: boolean;
};

const items: SidebarItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, enabled: true },
  { title: "Alunos", url: "/alunos", icon: Users, enabled: true, perm: 'ver_alunos' },
  { title: "Cursos", url: "/cursos", icon: BookOpen, enabled: true, adminOnly: true },
  { title: "Segmentos", url: "/segmentos", icon: Tags, enabled: true, adminOnly: true },
  { title: "Pacotes", url: "/pacotes", icon: GraduationCap, enabled: true, adminOnly: true },
  { title: "Colaboradores", url: "/colaboradores", icon: Users, enabled: true, adminOnly: true },
  { title: "Minha Equipe", url: "/minha-equipe", icon: UsersRound, enabled: true, responsavelOnly: true },
  { title: "Setor de Provas", url: "/setor-provas", icon: ClipboardCheck, enabled: true, anyPerm: ['ver_setor_provas', 'gerenciar_prova_final'] },
  { title: "Documentação", url: "/documentacao", icon: FileText, enabled: true, documentacaoAccess: true },
  { title: "Provas Agendadas", url: "/provas-agendadas", icon: CalendarCheck, enabled: true, anyPerm: ['ver_provas_agendadas', 'gerenciar_prova_final'] },
  { title: "Pós-Venda", url: "/pos-venda", icon: HeartHandshake, enabled: true, posVendaOrAdmin: true },
  { title: "Financeiro", url: "/financeiro", icon: Wallet, enabled: true, perm: 'ver_financeiro', hideForVendedor: true },
  { title: "Minhas Comissões", url: "/minhas-comissoes", icon: Wallet, enabled: true, vendedorOnly: true },
];

export function AppSidebar({ colaborador, mobileOpen = false, onClose }: { colaborador?: any; mobileOpen?: boolean; onClose?: () => void }) {
  const { session } = useAuth();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const [recreating, setRecreating] = useState(false);
  const [nomeEscola, setNomeEscola] = useState("Soluções Online");
  const [changePwdOpen, setChangePwdOpen] = useState(false);

  
  const [selectedPoloId, setSelectedPoloId] = useState<string>(() => {
    return sessionStorage.getItem("selected_polo_id") || "all";
  });

  const { data: userRole } = useQuery({
    queryKey: ["user-role", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.role;
    },
    enabled: !!session?.user?.id,
  });

  const { data: polos } = useQuery({
    queryKey: ["polos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("polos")
        .select("id, nome")
        .eq("ativo", true)
        .ilike("nome", "%florian%")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });


  const { data: config } = useQuery({
    queryKey: ["admin-sidebar-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'nome_escola')
        .single();
      if (data?.valor) setNomeEscola(data.valor);
      return data;
    },
  });

  const isSuperAdmin = session?.user?.email === 'diegonubling@gmail.com' || userRole === 'admin';
  const isAdminPolo = colaborador?.setor === 'Admin Polo' || (colaborador?.colaborador_permissoes?.[0]?.ver_configuracoes);
  const isResponsavel = !!colaborador?.responsavel_polo;
  const responsavelPoloNome = polos?.find(p => p.id === colaborador?.polo_id)?.nome;

  useEffect(() => {
    if (!isSuperAdmin && colaborador?.polo_id) {
      sessionStorage.setItem("selected_polo_id", colaborador.polo_id);
      setSelectedPoloId(colaborador.polo_id);
    }
  }, [isSuperAdmin, colaborador]);

  const handlePoloChange = (id: string) => {
    setSelectedPoloId(id);
    sessionStorage.setItem("selected_polo_id", id);
    console.log("DEBUG [AppSidebar]: Novo polo selecionado no seletor:", id);
    window.dispatchEvent(new Event("polo-changed"));
    toast.success(`Polo selecionado: ${id === 'all' ? 'Todos os Polos' : polos?.find(p => p.id === id)?.nome}`);
    onClose?.();
  };

  const isActive = (url: string) => {
    if (url === "/") return path === "/";
    return path === url || path.startsWith(url + "/");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem("selected_polo_id");
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
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
    <aside className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:sticky top-0 left-0 z-50 w-64 h-screen md:h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border shadow-lg transition-transform duration-200 ease-in-out`}>
      <div className="px-6 py-6 border-b border-sidebar-border">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-white">{nomeEscola.split(' ')[0]}</span> <span className="text-[#2ECC71]">{nomeEscola.split(' ').slice(1).join(' ')}</span>
        </h1>
        <p className="text-xs text-sidebar-foreground/60 mt-1 uppercase tracking-wider font-semibold">Painel Administrativo</p>
      </div>

      {isResponsavel && responsavelPoloNome && (
        <div className="px-6 py-2 border-b border-sidebar-border bg-amber-500/10 flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-400" />
          <p className="text-xs font-semibold text-amber-400">Responsável — {responsavelPoloNome}</p>
        </div>
      )}

      {false && isSuperAdmin && (
        <div className="px-3 py-4 border-b border-sidebar-border">
          {/* Seletor de polo oculto temporariamente - lógica preservada */}
        </div>
      )}


      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const isAdmin = session?.user?.email === 'admin@admin.com' || isSuperAdmin;
          const isVendedor = colaborador?.setor === 'Vendedor' && !isAdmin;

          if (item.adminOnly && !isAdmin) return null;
          if (item.responsavelOnly && !isResponsavel) return null;
          if (item.vendedorOnly && !isVendedor) return null;
          if (item.hideForVendedor && isVendedor) return null;
          if (item.posVendaOrAdmin && !isAdmin && colaborador?.setor !== 'Pós-Venda' && !colaborador?.colaborador_permissoes?.[0]?.ver_pos_venda) return null;

          if (colaborador && !isResponsavel && (item.perm || item.anyPerm)) {
            const perms = colaborador.colaborador_permissoes?.[0];
            if (item.perm && !perms?.[item.perm]) return null;
            if (item.anyPerm && !item.anyPerm.some((p) => perms?.[p])) return null;
          }

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
              onClick={() => onClose?.()}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200 ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-md scale-[1.02]"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1 bg-sidebar-accent/30">
        {isSuperAdmin && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-xs"
            onClick={handleRecreateAdmin}
            disabled={recreating}
          >
            {recreating ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <ShieldPlus className="h-3 w-3 mr-2" />}
            Recriar Admin
          </Button>
        )}
        {(isSuperAdmin || colaborador?.colaborador_permissoes?.[0]?.ver_configuracoes) && (
          <Link
            to="/configuracoes"
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              isActive("/configuracoes")
                ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
        )}
        {colaborador && !isSuperAdmin && (
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => setChangePwdOpen(true)}
          >
            <KeyRound className="h-4 w-4 mr-2" />
            Alterar Senha
          </Button>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-red-500 hover:text-white transition-colors"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
      <ChangePasswordModal open={changePwdOpen} onOpenChange={setChangePwdOpen} />
    </aside>
    </>
  );
}
