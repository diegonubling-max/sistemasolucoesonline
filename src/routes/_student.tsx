import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut, User as UserIcon, BookOpen, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (error || (data?.role !== 'aluno' && data?.role !== 'admin')) {
        toast.error("Acesso negado. Esta área é apenas para alunos.");
        await supabase.auth.signOut();
        navigate({ to: "/aluno/login" });
        return;
      }

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
      <div className="min-h-screen flex items-center justify-center bg-[#141414]">
        <Loader2 className="h-10 w-10 animate-spin text-[#2D6ADF]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#141414] text-white student-area">
      <header className="bg-[#141414]/90 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/aluno/dashboard" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <span className="text-xl font-bold tracking-tighter">
              <span className="text-white">Soluções</span>{" "}
              <span className="text-[#2D6ADF]">Online</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-sm text-[#B3B3B3]">
              Olá, <span className="font-semibold text-white">{userName}</span>!
            </span>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10 text-white">
                  <div className="w-8 h-8 rounded bg-[#1E3A5F] flex items-center justify-center text-white font-bold text-xs">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-[#1e1e1e] border-white/10 text-white">
                <DropdownMenuItem asChild className="focus:bg-white/10 focus:text-white cursor-pointer">
                  <Link to="/aluno/perfil" className="flex items-center w-full">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Meu Perfil</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={handleLogout} className="focus:bg-white/10 focus:text-white cursor-pointer text-red-400">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="py-10 border-t border-white/10 bg-[#141414]">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-[#B3B3B3]">
          &copy; {new Date().getFullYear()} Soluções Online — Experiência Premium para Alunos
        </div>
      </footer>
    </div>
  );
}
