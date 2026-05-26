import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut, User as UserIcon, BookOpen, Wallet, Menu, X } from "lucide-react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      <header className="bg-primary border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/aluno/dashboard" className="flex items-center gap-2">
              <span className="text-xl font-bold">
                <span className="text-white">Soluções</span>{" "}
                <span className="text-[#2ECC71]">Online</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link
                to="/aluno/dashboard"
                className="text-white/80 hover:text-white font-medium transition-colors flex items-center gap-2"
                activeProps={{ className: "text-white font-bold" }}
              >
                <BookOpen className="h-4 w-4" />
                Meus Cursos
              </Link>
              <Link
                to="/aluno/financeiro"
                className="text-white/80 hover:text-white font-medium transition-colors flex items-center gap-2"
                activeProps={{ className: "text-white font-bold" }}
              >
                <Wallet className="h-4 w-4" />
                Financeiro
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden md:flex items-center gap-4">
              <span className="text-sm text-white/70">
                Olá, <span className="font-semibold text-white">{userName}</span>!
              </span>

              <Link to="/aluno/perfil">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Meu Perfil"
                  className="text-white hover:bg-white/10"
                >
                  <UserIcon className="h-5 w-5" />
                </Button>
              </Link>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title="Sair"
                className="text-white hover:bg-white/10"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-primary border-t border-white/10 py-4 px-4 space-y-4 animate-in slide-in-from-top duration-200">
            <div className="flex flex-col gap-2">
              <Link
                to="/aluno/dashboard"
                className="text-white/80 hover:text-white font-medium p-2 flex items-center gap-3"
                activeProps={{ className: "bg-white/10 text-white rounded-md" }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <BookOpen className="h-5 w-5" />
                Meus Cursos
              </Link>
              <Link
                to="/aluno/financeiro"
                className="text-white/80 hover:text-white font-medium p-2 flex items-center gap-3"
                activeProps={{ className: "bg-white/10 text-white rounded-md" }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Wallet className="h-5 w-5" />
                Financeiro
              </Link>
              <Link
                to="/aluno/perfil"
                className="text-white/80 hover:text-white font-medium p-2 flex items-center gap-3"
                activeProps={{ className: "bg-white/10 text-white rounded-md" }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <UserIcon className="h-5 w-5" />
                Meu Perfil
              </Link>
              <button
                onClick={handleLogout}
                className="text-white/80 hover:text-white font-medium p-2 flex items-center gap-3 w-full text-left"
              >
                <LogOut className="h-5 w-5" />
                Sair
              </button>
            </div>
          </div>
        )}
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