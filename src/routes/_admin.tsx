import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AppSidebar } from "@/components/admin/AppSidebar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_admin")({
  component: AdminLayout,
});

const ADMIN_ONLY_PREFIXES = ["/cursos", "/segmentos", "/pacotes", "/colaboradores"];
const PERM_PREFIXES: Record<string, string> = {
  "/alunos": "ver_alunos",
  "/financeiro": "ver_financeiro",
  "/configuracoes": "ver_configuracoes",
};

function AdminLayout() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [colaborador, setColaborador] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loadingColab, setLoadingColab] = useState(true);

  useEffect(() => {
    async function checkColab() {
      if (!session?.user) {
        setLoadingColab(false);
        return;
      }

      const [{ data: colab }, { data: roleRow }] = await Promise.all([
        supabase
          .from('colaboradores')
          .select('*, colaborador_permissoes(*)')
          .eq('user_id', session.user.id)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle(),
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

  const isSuperAdmin = session?.user?.email === 'diegonubling@gmail.com' || userRole === 'admin';

  useEffect(() => {
    if (loadingColab || authLoading || !session) return;
    if (isSuperAdmin) return;

    const matchedAdminOnly = ADMIN_ONLY_PREFIXES.find(p => path === p || path.startsWith(p + "/"));
    if (matchedAdminOnly) {
      navigate({ to: "/" });
      return;
    }

    const perms = colaborador?.colaborador_permissoes?.[0];
    for (const [prefix, perm] of Object.entries(PERM_PREFIXES)) {
      if (path === prefix || path.startsWith(prefix + "/")) {
        if (!perms?.[perm]) navigate({ to: "/" });
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

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar colaborador={colaborador} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
