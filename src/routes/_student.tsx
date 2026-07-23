import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, createContext, useContext } from "react";
import { Loader2, LogOut, User as UserIcon, BookOpen, Wallet, Menu, X, Sun, Moon, Settings, MessageSquare, School } from "lucide-react";
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
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { InadimplenciaAlerts } from "@/components/student/InadimplenciaAlerts";
import { PerfilVocacionalModal } from "@/components/student/PerfilVocacionalModal";
import { verificarInadimplenciaAuto } from "@/lib/aluno-status";
import { MilhasEjaBadge, MilhasEjaListener } from "@/components/student/MilhasEja";

const StudentThemeContext = createContext<{ isDark: boolean }>({ isDark: true });
export const useStudentTheme = () => useContext(StudentThemeContext);

export const Route = createFileRoute("/_student")({
  component: StudentLayout,
});

export const PROVA_FINAL_HABILITADA = true; // Reativado a pedido do Diego (23/07/2026) — matéria Prova de volta ao dashboard

function StudentLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(true);
  const [userName, setUserName] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tema, setTema] = useState<"claro" | "escuro">("claro");
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [alunoStatus, setAlunoStatus] = useState<string | null>(null);
  const [acessoBloqueado, setAcessoBloqueado] = useState(false);
  const [nomeEscola, setNomeEscola] = useState("Soluções Online");
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [showPerfilModal, setShowPerfilModal] = useState(false);

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

  const encerrarSessao = async (id: string) => {
    const logoutEm = new Date();
    const { data: sessao } = await supabase
      .from('aluno_sessoes')
      .select('login_em')
      .eq('id', id)
      .single();

    if (sessao) {
      const loginEm = new Date(sessao.login_em);
      const duracaoMinutos = Math.round((logoutEm.getTime() - loginEm.getTime()) / 60000);
      
      await supabase
        .from('aluno_sessoes')
        .update({ 
          logout_em: logoutEm.toISOString(),
          duracao_minutos: Math.max(1, duracaoMinutos)
        })
        .eq('id', id);
    }
  };

  useEffect(() => {
    const sessaoIdLocal = sessionStorage.getItem('aluno_sessao_id');
    if (sessaoIdLocal) {
      setSessaoId(sessaoIdLocal);
    }
  }, []);

  useEffect(() => {
    if (!sessaoId) return;

    const handleBeforeUnload = () => {
      const logoutEm = new Date().toISOString();
      // Usar fetch com keepalive para garantir o registro ao fechar a aba
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/aluno_sessoes?id=eq.${sessaoId}`, {
        method: 'PATCH',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ logout_em: logoutEm }),
        keepalive: true
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessaoId, session]);

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
        .select('id, nome, tema, status')
        .eq('email', session.user.email ?? '')
        .single();
      
      if (aluno) {
        setUserName(aluno.nome);
        setAlunoId(aluno.id);
        setAlunoStatus((aluno as any).status ?? 'ativo');
        if (aluno.tema === 'claro' || aluno.tema === 'escuro') {
          setTema(aluno.tema);
        }
        if ((aluno as any).status === 'inativo') {
          setAcessoBloqueado(true);
          setIsVerifying(false);
          return;
        }
        // Verifica inadimplência automática
        verificarInadimplenciaAuto(aluno.id, (aluno as any).status).catch(() => {});

        // Checa se já preencheu o questionário vocacional
        const { data: perfilVoc } = await supabase
          .from('aluno_perfil_vocacional')
          .select('id')
          .eq('aluno_id', aluno.id)
          .maybeSingle();
        if (!perfilVoc) setShowPerfilModal(true);
      }
      // Get Polo Data (School Name and Logo)
      const { data: alunoPolo } = await supabase
        .from('alunos')
        .select('polos(nome_escola, logo_url)')
        .eq('email', session.user.email ?? '')
        .single();
      
      const poloData = (alunoPolo as any)?.polos;
      if (poloData?.nome_escola) {
        setNomeEscola(poloData.nome_escola);
      }

      setIsVerifying(false);
    }

    checkRole();
  }, [loading, session, navigate]);

  const handleLogout = async () => {
    const currentSessaoId = sessaoId || sessionStorage.getItem('aluno_sessao_id');
    if (currentSessaoId) {
      await encerrarSessao(currentSessaoId);
      sessionStorage.removeItem('aluno_sessao_id');
    }
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

  if (acessoBloqueado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-4 border">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
            <LogOut className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Acesso bloqueado</h1>
          <p className="text-gray-600">Sua conta está inativa. Entre em contato com a secretaria para mais informações.</p>
          <Button onClick={handleLogout} className="w-full">Sair</Button>
        </div>
      </div>
    );
  }

  const isDark = false; // Tema sempre claro conforme solicitado
  void alunoStatus;

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300 bg-gray-50 text-gray-900">
      <header className="bg-[#1E3A5F] border-b border-black/5 sticky top-0 z-20 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-8 min-w-0 flex-1">
            <Link to="/aluno/dashboard" className="flex items-center gap-2 min-w-0">
              <div className="bg-[#2D6ADF]/10 p-1.5 rounded-lg mr-1 shrink-0">
                <School className="h-5 w-5 text-[#2D6ADF]" />
              </div>
              <span className="text-base sm:text-xl font-bold truncate">
                <span className="text-white">{nomeEscola.split(' ')[0]}</span>{" "}
                <span className="text-[#2D6ADF]">{nomeEscola.split(' ').slice(1).join(' ')}</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link
                to="/aluno/dashboard"
                className="text-white/80 hover:text-white font-medium transition-colors flex items-center gap-2"
                activeProps={{ className: "text-white font-bold" }}
              >
                Início
              </Link>
              <Link
                to="/aluno/dashboard"
                className="text-white/80 hover:text-white font-medium transition-colors flex items-center gap-2"
              >
                Meus Cursos
              </Link>
              <Link
                to="/aluno/financeiro"
                className="text-white/80 hover:text-white font-medium transition-colors flex items-center gap-2"
                activeProps={{ className: "text-white font-bold" }}
              >
                Financeiro
              </Link>
              {PROVA_FINAL_HABILITADA && (
                <Link
                  to="/aluno/prova-final"
                  className="text-white/80 hover:text-white font-medium transition-colors flex items-center gap-2"
                  activeProps={{ className: "text-white font-bold" }}
                >
                  Prova Final
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              {alunoId && <MilhasEjaBadge alunoId={alunoId} />}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="h-9 w-9 rounded-full bg-[#2D6ADF] flex items-center justify-center font-bold text-white cursor-pointer hover:scale-105 transition-transform">
                      {userName[0]?.toUpperCase()}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white text-gray-900 w-48 shadow-xl border-gray-200">
                  <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate({ to: "/aluno/perfil" })} className="cursor-pointer">
                    <UserIcon className="h-4 w-4 mr-2" /> Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
          <div className="md:hidden bg-[#1E3A5F] border-t border-white/10 py-4 px-4 space-y-4 animate-in slide-in-from-top duration-200">
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
              {PROVA_FINAL_HABILITADA && (
                <Link
                  to="/aluno/prova-final"
                  className="text-white/80 hover:text-white font-medium p-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Prova Final
                </Link>
              )}
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

      <InadimplenciaAlerts alunoId={alunoId} nomeAluno={userName} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
          <StudentThemeContext.Provider value={{ isDark }}>
            <Outlet />
          </StudentThemeContext.Provider>
        </div>
      </main>
      <WhatsAppButton />
      {alunoId && (
        <PerfilVocacionalModal
          alunoId={alunoId}
          open={showPerfilModal}
          onClose={() => setShowPerfilModal(false)}
        />
      )}
      <MilhasEjaListener />
    </div>
  );
}