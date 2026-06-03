import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { WhatsAppButton } from "@/components/WhatsAppButton";

export const Route = createFileRoute("/aluno/login")({
  component: AlunoLogin,
});

function AlunoLogin() {
  const navigate = useNavigate();
  const [ctr, setCtr] = useState("");
  const [password, setPassword] = useState("");
  const [nomeEscola, setNomeEscola] = useState("Soluções Online");

  useQuery({
    queryKey: ["global-configs-login"],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'nome_escola')
        .single();
      if (data?.valor) setNomeEscola(data.valor);
      return data;
    },
  });

  const login = useMutation({
    mutationFn: async () => {
      const ctrValue = ctr.trim();
      const passwordValue = password.trim();
      const ctrInt = parseInt(ctrValue);
      
      if (isNaN(ctrInt)) {
        throw new Error('CTR deve ser um número');
      }

      if (!passwordValue) {
        throw new Error('A senha é obrigatória');
      }

      // 1. Buscar o aluno pelo CTR
      const { data: aluno, error: alunoError } = await supabase
        .from('alunos')
        .select('email, nome, ctr')
        .eq('ctr', ctrInt)
        .maybeSingle();

      if (alunoError) throw new Error('Erro ao buscar aluno: ' + alunoError.message);
      
      if (!aluno) {
        throw new Error('CTR inválido');
      }

      if (!aluno.email) {
        throw new Error('Aluno sem e-mail cadastrado. Procure a secretaria.');
      }

      // 2. Chamar a RPC para garantir que o usuário existe no Supabase Auth
      // Passamos a senha digitada - se for a primeira vez, ela será definida
      const { error: rpcError } = await supabase.rpc('criar_acesso_aluno', {
        p_email: aluno.email,
        p_senha: passwordValue,
        p_ctr: aluno.ctr
      });

      if (rpcError) {
        console.error('Erro ao preparar acesso:', rpcError);
        // Não lançamos erro aqui pois o usuário pode já existir
      }

      // 3. Autenticar com o email encontrado e a senha digitada
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: aluno.email,
        password: passwordValue,
      });

      if (authError) {
        if (authError.message === "Invalid login credentials") {
          throw new Error('Senha incorreta');
        }
        throw new Error(authError.message);
      }

      return data;
    },
    onSuccess: async (data) => {
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
    onError: (e: Error) => toast.error(e.message),
  });

  const handleResetPassword = async () => {
    if (!ctr) {
      toast.error("Informe seu CTR para recuperar a senha");
      return;
    }

    const { data: aluno, error: alunoError } = await supabase
      .from('alunos')
      .select('email')
      .or(`ctr.eq.${ctr.trim()},ctr.eq.${parseInt(ctr.trim()) || 0}`)
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F5] px-4 py-8">
      <div className="w-full max-w-[440px] flex flex-col gap-6">
        <div className="bg-[#1E3A5F] rounded-[24px] pt-10 pb-8 px-6 text-center shadow-xl relative overflow-hidden">
          <div className="flex justify-center mb-6">
            <div className="bg-[#3D5270] p-4 rounded-2xl">
              <GraduationCap className="h-10 w-10 text-white" />
            </div>
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
            <span className="text-white">{nomeEscola.split(' ')[0]}</span>{" "}
            <span className="text-[#2ECC71]">{nomeEscola.split(' ').slice(1).join(' ')}</span>
          </h1>
          <p className="text-white/70 font-medium text-lg">
            Acesse sua área de estudos
          </p>
        </div>

        <Card className="border-none shadow-xl bg-white rounded-[24px] overflow-hidden">
          <CardContent className="p-8">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                login.mutate();
              }}
              className="space-y-6"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-900 ml-1">Login (seu CTR)</label>
                  <Input 
                    type="text" 
                    placeholder="Digite seu CTR" 
                    value={ctr}
                    onChange={(e) => setCtr(e.target.value)}
                    className="h-12 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-[#1E3A5F] rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-900 ml-1">Senha</label>
                  <Input 
                    type="password" 
                    placeholder="Digite sua senha" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-[#1E3A5F] rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg font-bold bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white transition-all shadow-md rounded-xl"
                  disabled={login.isPending || !ctr.trim() || !password.trim()}
                >
                  {login.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Entrar"
                  )}
                </Button>

                <div className="text-center">
                  <button 
                    type="button"
                    onClick={handleResetPassword}
                    className="text-sm font-medium text-gray-500 hover:text-[#1E3A5F] transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      <WhatsAppButton />
    </div>
  );
}
