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
      // 1. Buscar o email do aluno pelo CTR
      const ctrValue = ctr.trim();
      const { data: aluno, error: alunoError } = await supabase
        .from('alunos')
        .select('email, nome')
        .or(`ctr.eq.${ctrValue},ctr.eq.${parseInt(ctrValue) || 0}`)
        .maybeSingle();

      if (alunoError) throw alunoError;
      
      if (!aluno || !aluno.email) {
        throw new Error('CTR não encontrado');
      }

      // Tentar login. Se falhar por "Invalid login credentials", 
      // verificamos se o usuário existe no auth.users.
      // Se não existir, tentamos criar via RPC (autorreparo).

      // 2. Autenticar com o email encontrado
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: aluno.email,
          password,
        });

        if (error) {
          if (error.message === "Invalid login credentials") {
            // Verificar se o usuário existe no public.user_roles ou auth.users
            // Como não temos acesso direto a auth.users do cliente sem ser admin, 
            // tentamos o RPC de criação que já lida com o "IF NOT EXISTS"
            const primeiroNome = aluno.nome.split(' ')[0];
            const senhaPadrao = '123' + primeiroNome
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .split(' ')[0];

            if (password === senhaPadrao) {
              console.log("Tentando recriar acesso para:", aluno.email);
              const { error: rpcError } = await supabase.rpc('criar_acesso_aluno', {
                p_email: aluno.email,
                p_senha: password,
                p_ctr: parseInt(ctrValue) || 0
              });

              if (!rpcError) {
                // Tentar login novamente após criar
                const retry = await supabase.auth.signInWithPassword({
                  email: aluno.email,
                  password,
                });
                if (retry.error) throw retry.error;
                return retry.data;
              }
            }
          }
          throw error;
        }
        return data;
      } catch (err: any) {
        throw err;
      }
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F5] px-4 py-8">
      <div className="w-full max-w-[440px] flex flex-col gap-6">
        {/* Card Superior Azul */}
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

        {/* Card Inferior Branco */}
        <Card className="border-none shadow-xl bg-white rounded-[24px] overflow-hidden">
          <CardContent className="p-8">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                login.mutate();
              }}
              className="space-y-6"
            >
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
                  placeholder="" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-[#1E3A5F] rounded-xl"
                  required
                />
              </div>

              <div className="space-y-4">
                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg font-bold bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white transition-all shadow-md rounded-xl"
                  disabled={login.isPending}
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