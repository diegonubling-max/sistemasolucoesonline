import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Lock, User, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/aluno/login")({
  component: AlunoLogin,
});

function AlunoLogin() {
  const navigate = useNavigate();
  const [ctr, setCtr] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: async () => {
      // 1. Buscar o email do aluno pelo CTR
      const { data: aluno, error: alunoError } = await supabase
        .from('alunos')
        .select('email')
        .eq('ctr', parseInt(ctr))
        .maybeSingle();

      if (alunoError || !aluno || !aluno.email) {
        throw new Error('CTR não encontrado');
      }

      // 2. Autenticar com o email encontrado
      const { data, error } = await supabase.auth.signInWithPassword({
        email: aluno.email,
        password,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      // Check role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .single();
      
      if (roleData?.role === 'aluno' || roleData?.role === 'admin') {
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/aluno/dashboard" });
      } else {
        toast.error("Acesso negado.");
        await supabase.auth.signOut();
      }
    },
    onError: (e: Error) => toast.error(e.message === "Invalid login credentials" ? "Senha incorreta" : e.message),
  });

  const handleResetPassword = async () => {
    if (!ctr) {
      toast.error("Informe seu CTR para recuperar a senha");
      return;
    }

    const { data: aluno, error: alunoError } = await supabase
      .from('alunos')
      .select('email')
      .eq('ctr', parseInt(ctr))
      .maybeSingle();

    if (alunoError || !aluno || !aluno.email) {
      toast.error("CTR não encontrado");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(aluno.email, {
      redirectTo: `https://sistemasolucoesonline.lovable.app/aluno/perfil`,
    });
    if (error) toast.error(error.message);
    else toast.success("E-mail de recuperação enviado para " + aluno.email);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-[#1E3A5F]">Soluções</span> <span className="text-[#2D6ADF]">Online</span>
          </h1>
          <p className="text-[#6B7280] mt-2 font-medium">Área do Aluno</p>
        </div>

        <Card className="border-none shadow-xl bg-white border border-[#E5E7EB]">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-[#111827]">Entrar</CardTitle>
            <CardDescription className="text-[#6B7280]">
              Acesse sua plataforma de estudos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                login.mutate();
              }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#111827]">Seu CTR</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                  <Input 
                    type="text" 
                    placeholder="Ex: 1627" 
                    value={ctr}
                    onChange={(e) => setCtr(e.target.value)}
                    className="pl-10 h-12 bg-white border-[#E5E7EB] text-[#111827] placeholder:text-[#6B7280] focus-visible:ring-1 focus-visible:ring-[#2D6ADF]"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#111827]">Sua senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                  <Input 
                    type="password" 
                    placeholder="Sua senha" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12 bg-white border-[#E5E7EB] text-[#111827] placeholder:text-[#6B7280] focus-visible:ring-1 focus-visible:ring-[#2D6ADF]"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button 
                  type="button"
                  onClick={handleResetPassword}
                  className="text-xs font-semibold text-[#6B7280] hover:text-[#111827] transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-bold bg-[#2D6ADF] hover:bg-[#2D6ADF]/90 text-white transition-all shadow-md"
                disabled={login.isPending}
              >
                {login.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <p className="text-center mt-8 text-sm text-[#6B7280]">
          Problemas com o acesso? Entre em contato com o suporte.
        </p>
      </div>
    </div>
  );
}