import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Menu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AppSidebar } from "@/components/admin/AppSidebar";
import { ChangePasswordModal } from "@/components/admin/ChangePasswordModal";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_admin")({
  component: AdminLayout,
});

const ADMIN_ONLY_PREFIXES = ["/cursos", "/segmentos", "/pacotes", "/colaboradores"];
const PERM_PREFIXES: Record<string, string> = {
  "/alunos": "ver_alunos",
  "/financeiro": "ver_financeiro",
  "/configuracoes": "ver_configuracoes",
};
const ANY_PERM_PREFIXES: Record<string, string[]> = {
  "/setor-provas": ["ver_setor_provas", "gerenciar_prova_final"],
};

function AdminLayout() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [colaborador, setColaborador] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loadingColab, setLoadingColab] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  useEffect(() => {
    async function checkColab() {
      if (!session?.user) {
        setLoadingColab(false);
        return;
      }

      const [{ data: colab }, { data: roleRow }] = await Promise.all([
        supabase
          .from("colaboradores")
          .select("*, colaborador_permissoes(*)")
          .eq("user_id", session.user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle(),
      ]);

      if (colab) setColaborador(colab);
      setUserRole((roleRow as any)?.role ?? null);
      setLoadingColab(false);
    }

    if (!authLoading) checkColab();
  }, [session, authLoading]);

  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/login" });
  }, [authLoading, session, navigate]);

  // Guard: usuário autenticado precisa ser admin ou colaborador para acessar /admin/*
  useEffect(() => {
    if (authLoading || loadingColab || !session) return;
    const isAdmin = userRole === "admin";
    const isColaborador = !!colaborador;
    if (!isAdmin && !isColaborador) {
      console.warn("[admin guard] usuário sem role admin/colaborador — redirecionando para /login");
      navigate({ to: "/login" });
    }
  }, [authLoading, loadingColab, session, userRole, colaborador, navigate]);

  const isSuperAdmin = session?.user?.email === "diegonubling@gmail.com" || userRole === "admin";

  usePushNotifications(isSuperAdmin, session?.user?.id);

  useEffect(() => {
    if (loadingColab || authLoading || !session) return;
    if (isSuperAdmin) return;

    const isResponsavel = !!colaborador?.responsavel_polo;
    const isVendedor = colaborador?.setor === 'Vendedor';
    const isPosVenda = colaborador?.setor === 'Pós-Venda';
    // Documentação: admin ou setor "Setor de Provas"
    if (path === "/documentacao" || path.startsWith("/documentacao/")) {
      if (colaborador?.setor !== 'Setor de Provas') navigate({ to: "/" });
      return;
    }


    // Pós-Venda: admin ou setor Pós-Venda
    if (path === "/pos-venda" || path.startsWith("/pos-venda/")) {
      const hasPerm = !!colaborador?.colaborador_permissoes?.[0]?.ver_pos_venda;
      if (!isPosVenda && !hasPerm) navigate({ to: "/" });
      return;
    }

    // Minhas Comissões: somente vendedor
    if (path === "/minhas-comissoes" || path.startsWith("/minhas-comissoes/")) {
      if (!isVendedor) navigate({ to: "/" });
      return;
    }

    // Vendedor não acessa Financeiro completo
    if (isVendedor && (path === "/financeiro" || path.startsWith("/financeiro/"))) {
      navigate({ to: "/minhas-comissoes" });
      return;
    }

    // Minha Equipe: somente responsável de polo
    if (path === "/minha-equipe" || path.startsWith("/minha-equipe/")) {
      if (!isResponsavel) navigate({ to: "/" });
      return;
    }

    const matchedAdminOnly = ADMIN_ONLY_PREFIXES.find((p) => path === p || path.startsWith(p + "/"));
    if (matchedAdminOnly) {
      navigate({ to: "/" });
      return;
    }

    // Responsável de polo tem todas permissões
    if (isResponsavel) return;

    const perms = colaborador?.colaborador_permissoes?.[0];
    for (const [prefix, perm] of Object.entries(PERM_PREFIXES)) {
      if (path === prefix || path.startsWith(prefix + "/")) {
        if (!perms?.[perm]) navigate({ to: "/" });
        return;
      }
    }
    for (const [prefix, anyPerm] of Object.entries(ANY_PERM_PREFIXES)) {
      if (path === prefix || path.startsWith(prefix + "/")) {
        if (!anyPerm.some((p) => perms?.[p])) navigate({ to: "/" });
        return;
      }
    }
  }, [path, isSuperAdmin, colaborador, loadingColab, authLoading, session, navigate]);

  if (authLoading || loadingColab) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return null;

  const mustChangePassword = false;

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar colaborador={colaborador} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="flex-1 overflow-auto w-full md:w-auto">
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-4 h-14 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-bold truncate">Soluções Online</h1>
          <div className="w-9 h-9" />
        </header>
        <div className="w-full px-4 py-4 md:px-6 md:py-6">
          <Outlet />
        </div>
      </main>
      {mustChangePassword && (
        <ChangePasswordModal
          open
          forced
          colaboradorId={colaborador.id}
          onSuccess={() => setColaborador({ ...colaborador, primeiro_acesso: false })}
        />
      )}
    </div>
  );
}
