import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, createContext, useContext } from "react";
import { Loader2, LogOut, User as UserIcon, BookOpen, Wallet, Menu, X, Sun, Moon, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const StudentThemeContext = createContext<{ isDark: boolean }>({ isDark: true });
export const useStudentTheme = () => useContext(StudentThemeContext);

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

      // Get student data
      const { data: aluno } = await supabase
        .from('alunos')
        .select('id, nome, tema')
        .eq('email', session.user.email ?? '')
        .single();
      
      if (aluno) {
        setUserName(aluno.nome);
        setAlunoId(aluno.id);
        if (aluno.tema === 'claro' || aluno.tema === 'escuro') {
          setTema(aluno.tema);
        }
      }
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

  const isDark = tema === "escuro";

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${
      isDark ? "bg-[#141414] text-white" : "bg-[#F5F5F5] text-[#111827]"
    }`}>
      <header className={`${
        isDark ? "bg-[#1e1e1e] border-white/10" : "bg-[#1E3A5F] border-black/5"
      } border-b sticky top-0 z-20 transition-colors duration-300`}>
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
                className={`${isDark ? "text-[#B3B3B3] hover:text-white" : "text-white/80 hover:text-white"} font-medium transition-colors flex items-center gap-2`}
                activeProps={{ className: "text-white font-bold" }}
              >
                Início
              </Link>
              <Link
                to="/aluno/dashboard"
                className={`${isDark ? "text-[#B3B3B3] hover:text-white" : "text-white/80 hover:text-white"} font-medium transition-colors flex items-center gap-2`}
              >
                Meus Cursos
              </Link>
              <Link
                to="/aluno/financeiro"
                className={`${isDark ? "text-[#B3B3B3] hover:text-white" : "text-white/80 hover:text-white"} font-medium transition-colors flex items-center gap-2`}
                activeProps={{ className: "text-white font-bold" }}
              >
                Financeiro
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="h-9 w-9 rounded-full bg-[#2D6ADF] flex items-center justify-center font-bold text-white cursor-pointer hover:scale-105 transition-transform">
                      {userName[0]?.toUpperCase()}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={`${isDark ? "bg-[#1e1e1e] text-white border-white/10" : "bg-white text-gray-900"} w-48 shadow-xl`}>
                  <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                  <DropdownMenuSeparator className={isDark ? "bg-white/10" : ""} />
                  <DropdownMenuItem onClick={() => navigate({ to: "/aluno/perfil" })} className="cursor-pointer">
                    <UserIcon className="h-4 w-4 mr-2" /> Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={toggleTema} className="cursor-pointer">
                    {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                    {isDark ? "Tema Claro" : "Tema Escuro"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className={isDark ? "bg-white/10" : ""} />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-500 focus:text-red-500">
                    <LogOut className="h-4 w-4 mr-2" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className={`md:hidden ${isDark ? "bg-[#1e1e1e] border-white/10" : "bg-[#1E3A5F] border-white/10"} border-t py-4 px-4 space-y-4 animate-in slide-in-from-top duration-200`}>
            <div className="flex flex-col gap-2">
              <Link
                to="/aluno/dashboard"
                className="text-white/80 hover:text-white font-medium p-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Início
              </Link>
              <Link
                to="/aluno/dashboard"
                className="text-white/80 hover:text-white font-medium p-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Meus Cursos
              </Link>
              <Link
                to="/aluno/financeiro"
                className="text-white/80 hover:text-white font-medium p-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Financeiro
              </Link>
              <Link
                to="/aluno/perfil"
                className="text-white/80 hover:text-white font-medium p-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Meu Perfil
              </Link>
              <button
                onClick={handleLogout}
                className="text-white/80 hover:text-white font-medium p-2 text-left"
              >
                Sair
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <StudentThemeContext.Provider value={{ isDark }}>
            <Outlet />
          </StudentThemeContext.Provider>
        </div>
      </main>
    </div>
  );
}