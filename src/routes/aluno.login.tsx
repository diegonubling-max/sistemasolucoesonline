import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { sendBoasVindasPrimeiroAcesso } from "@/services/zApiService";
import { creditarPrimeiroLogin, checar7DiasLogin } from "@/lib/milhas-eja";

export const Route = createFileRoute("/aluno/login")({
  component: AlunoLogin,
});

function AlunoLogin() {
  const navigate = useNavigate();
  const [ctr, setCtr] = useState("");
  const [password, setPassword] = useState("");
  const [nomeEscola, setNomeEscola] = useState("Soluções Online");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const msg = sessionStorage.getItem("session_expired_message");
    if (msg) {
      sessionStorage.removeItem("session_expired_message");
      toast.error(msg);
    }
  }, []);



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

      if (!passwordValue) {
        throw new Error('A senha é obrigatória');
      }

      // Aluno externo: CTR começa com "P"
      if (ctrValue.toUpperCase().startsWith('P')) {
        const ctrUpper = ctrValue.toUpperCase();
        const { data, error } = await supabase.rpc('login_aluno_externo', {
          p_ctr: ctrUpper,
          p_senha: passwordValue,
        });
        if (error) throw new Error('Erro ao autenticar: ' + error.message);
        if (!data || (Array.isArray(data) && data.length === 0)) {
          throw new Error('CTR ou senha incorretos');
        }
        const externo = Array.isArray(data) ? data[0] : data;
        if (!externo.tem_acesso) {
          throw new Error('Seu acesso está liberado apenas no dia da prova. Se a data já passou, procure a secretaria para reagendar.');
        }
        sessionStorage.setItem('externo_ctr', ctrUpper);
        sessionStorage.setItem('externo_id', externo.id);
        sessionStorage.setItem('externo_nome', externo.nome ?? '');
        return { externo: true } as any;
      }

      // CTR interno: apenas números
      if (!/^\d+$/.test(ctrValue)) {
        throw new Error('CTR inválido');
      }
      const ctrNum = parseInt(ctrValue, 10);

      // 1. Buscar email do aluno pelo CTR numérico
      const { data: email, error: alunoError } = await supabase.rpc('buscar_email_por_ctr', {
        p_ctr: ctrNum,
      });

      console.log('[login aluno] CTR:', ctrNum, '→ email:', email, 'err:', alunoError);

      if (alunoError) throw new Error('Erro ao buscar aluno: ' + alunoError.message);

      if (!email) {
        throw new Error('CTR inválido');
      }

      // 2. Garantir que o usuário existe no Supabase Auth
      const { error: rpcError } = await supabase.rpc('criar_acesso_aluno', {
        p_email: email,
        p_senha: passwordValue,
        p_ctr: ctrNum,
      });

      if (rpcError) {
        console.error('[login aluno] erro criar_acesso_aluno:', rpcError);
      }

      // 3. Autenticar
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: passwordValue,
      });

      console.log('[login aluno] authError:', authError);

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          throw new Error('Senha incorreta');
        }
        throw new Error(authError.message);
      }

      return data;
    },
    onSuccess: async (data: any) => {
      if (data?.externo) {
        toast.success('Bem-vindo! Sua prova está liberada.');
        navigate({ to: '/externo/prova' });
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .single();
      
      if (roleData?.role === 'aluno' || roleData?.role === 'admin') {
        // Registrar início da sessão para alunos
        if (roleData?.role === 'aluno') {
          const { data: aluno } = await supabase
            .from('alunos')
            .select('id, nome, telefone, primeiro_acesso')
            .eq('email', data.user.email ?? '')
            .maybeSingle();

          if (aluno) {
            // Verificar se já existe uma sessão ativa no sessionStorage
            const existingSessaoId = sessionStorage.getItem('aluno_sessao_id');
            
            if (!existingSessaoId) {
              const { data: sessao } = await supabase
                .from('aluno_sessoes')
                .insert({ aluno_id: aluno.id })
                .select('id')
                .single();
              
              if (sessao) {
                sessionStorage.setItem('aluno_sessao_id', sessao.id);
              }
            }

            // Milhas EJA: primeiro login (idempotente) + checar streak de 7 dias
            void creditarPrimeiroLogin(aluno.id);
            void checar7DiasLogin(aluno.id);

            // Primeiro acesso: enviar WhatsApp de boas-vindas
            console.log('[primeiro_acesso] Verificando primeiro acesso do aluno...', {
              aluno_id: aluno.id,
              primeiro_acesso: aluno.primeiro_acesso,
              telefone: aluno.telefone,
            });
            if (aluno.primeiro_acesso) {
              console.log('[primeiro_acesso] Primeiro acesso detectado, enviando mensagem...');
              try {
                await sendBoasVindasPrimeiroAcesso({
                  telefone: aluno.telefone ?? '',
                  nome: aluno.nome ?? '',
                  alunoId: aluno.id,
                });

              } catch (e) {
                console.error('[primeiro_acesso] erro ao enviar WhatsApp:', e);
              }
              const { error: updErr } = await supabase
                .from('alunos')
                .update({ primeiro_acesso: false })
                .eq('id', aluno.id);
              if (updErr) {
                console.error('[primeiro_acesso] erro ao atualizar flag:', updErr);
              } else {
                console.log('[primeiro_acesso] Mensagem enviada e primeiro_acesso atualizado');
              }
            } else {
              console.log('[primeiro_acesso] Não é primeiro acesso, pulando envio.');
            }
          }
        }

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

    const ctrTrim = ctr.trim();
    if (!/^\d+$/.test(ctrTrim)) {
      toast.error("CTR inválido");
      return;
    }
    const ctrNum = parseInt(ctrTrim, 10);

    const { data: email, error: alunoError } = await supabase.rpc('buscar_email_por_ctr', {
      p_ctr: ctrNum,
    });

    if (alunoError || !email) {
      toast.error("CTR não encontrado");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `https://sistemasolucoesonline.lovable.app/aluno/perfil`,
    });
    if (error) toast.error(error.message);
    else toast.success("E-mail de recuperação enviado para " + email);
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
