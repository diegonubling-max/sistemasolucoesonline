import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AppSidebar } from "@/components/admin/AppSidebar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [colaborador, setColaborador] = useState<any>(null);
  const [loadingColab, setLoadingColab] = useState(true);

  useEffect(() => {
    async function checkColab() {
      if (!session?.user) {
        setLoadingColab(false);
        return;
      }

      const { data, error } = await supabase
        .from('colaboradores')
        .select('*, colaborador_permissoes(*)')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      if (data) setColaborador(data);
      setLoadingColab(false);
    }
    
    if (!authLoading) checkColab();
  }, [session, authLoading]);

  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/login" });
  }, [authLoading, session, navigate]);

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
          <Outlet context={{ colaborador }} />
        </div>
      </main>
    </div>
  );
}
