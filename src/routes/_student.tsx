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
  const [tema, setTema] = useState<"claro" | "escuro">("escuro");
  const [alunoId, setAlunoId] = useState<string | null>(null);

  const toggleTema = async () => {
    const novoTema = tema === "escuro" ? "claro" : "escuro";
    setTema(novoTema);
    
    if (alunoId) {
      await supabase
        .from('alunos')
        .update({ tema: novoTema })
        .eq('id', alunoId);
    }
  };

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
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${userName ? 'bg-[#141414] text-white' : 'bg-background text-foreground'}`}>
      <header className="bg-[#1e1e1e] border-b border-white/10 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/aluno/dashboard" className="flex items-center gap-2">
              <span className="text-xl font-bold">
                <span className="text-white">Soluções</span>{" "}
                <span className="text-[#2D6ADF]">Online</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link
                to="/aluno/dashboard"
                className="text-[#B3B3B3] hover:text-white font-medium transition-colors flex items-center gap-2"
                activeProps={{ className: "text-white font-bold" }}
              >
                <BookOpen className="h-4 w-4" />
                Início
              </Link>
              <Link
                to="/aluno/dashboard"
                className="text-[#B3B3B3] hover:text-white font-medium transition-colors flex items-center gap-2"
              >
                <BookOpen className="h-4 w-4" />
                Meus Cursos
              </Link>
              <Link
                to="/aluno/financeiro"
                className="text-[#B3B3B3] hover:text-white font-medium transition-colors flex items-center gap-2"
                activeProps={{ className: "text-white font-bold" }}
              >
                <Wallet className="h-4 w-4" />
                Financeiro
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Button
                variant="ghost"
                size="icon"
                className="text-[#B3B3B3] hover:text-white"
            >
                🌙
            </Button>
            <div className="flex items-center gap-4">
              <Link to="/aluno/perfil">
                <div className="h-8 w-8 rounded-full bg-[#2D6ADF] flex items-center justify-center font-bold text-white">
                    {userName[0]?.toUpperCase()}
                </div>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}