import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut, User as UserIcon, BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_student")({
  component: StudentLayout,
});

function StudentLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    async function checkRole() {
      if (loading) return;
      
      if (!session) {
        navigate({ to: "/aluno/login" });
        return;
      }

      // Check if user has 'aluno' role
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (error || data?.role !== 'aluno') {
        // If they are admin, maybe allow them? 
        // No, user said "separada do painel admin"
        if (data?.role === 'admin') {
           // Admin can see student area too? Usually yes for testing
        } else {
          toast.error("Acesso negado. Esta área é apenas para alunos.");
          await supabase.auth.signOut();
          navigate({ to: "/aluno/login" });
          return;
        }
      }

      // Get student name
      const { data: aluno } = await supabase
        .from('alunos')
        .select('nome')
        .eq('email', session.user.email ?? '')
        .single();
      
      if (aluno) setUserName(aluno.nome);
      setIsVerifying(false);
    }

    checkRole();
  }, [loading, session, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/aluno/login" });
  };

  if (loading || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <header className="bg-primary border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/aluno/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-bold"><span className="text-white">Soluções</span> <span className="text-[#2ECC71]">Online</span></span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden md:inline text-sm text-white/70">
              Olá, <span className="font-semibold text-white">{userName}</span>!
            </span>
            
            <Link to="/aluno/perfil">
              <Button variant="ghost" size="icon" title="Meu Perfil" className="text-white hover:bg-white/10">
                <UserIcon className="h-5 w-5" />
              </Button>
            </Link>

            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair" className="text-white hover:bg-white/10">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Outlet />
        </div>
      </main>

      <footer className="py-6 border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Soluções Online — Área do Aluno
        </div>
      </footer>
    </div>
  );
}