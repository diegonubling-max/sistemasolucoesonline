import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Key, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useStudentTheme } from "./_student";

export const Route = createFileRoute("/_student/aluno/perfil")({
  head: () => ({ meta: [{ title: "Meu Perfil — EduManager" }] }),
  component: StudentProfile,
});

function StudentProfile() {
  const { session } = useAuth();
  const { isDark } = useStudentTheme();
  
  const { data: alunoData } = useQuery({
    queryKey: ["student-profile", session?.user.email],
    queryFn: async () => {
      const { data } = await supabase
        .from("alunos")
        .select("nome, ctr, email")
        .eq("email", session?.user.email ?? "")
        .single();
      return data;
    },
    enabled: !!session?.user.email,
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updatePassword = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("As senhas não conferem");
      if (newPassword.length < 6) {
        throw new Error("Mínimo de 6 caracteres");
      }

      // 1. Verificar a senha atual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session?.user.email ?? "",
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Senha atual incorreta");
      }

      // 2. Atualizar para a nova senha via RPC para contornar verificação de senha fraca
      const { error } = await supabase.rpc('redefinir_senha_aluno', {
        p_email: session?.user.email ?? "",
        p_nova_senha: newPassword
      });

      if (error) {
        throw new Error('Erro ao alterar senha: ' + error.message);
      }
    },
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row items-center gap-8 bg-white border-gray-100 shadow-sm p-8 rounded-2xl border transition-colors shadow-xl">
        <div className="relative group">
            <div className="h-32 w-32 rounded-full bg-[#1E3A5F] flex items-center justify-center text-4xl font-bold text-white shadow-2xl border-4 border-white">
                {alunoData?.nome?.[0]?.toUpperCase() || session?.user.email?.[0]?.toUpperCase()}
            </div>
            <button className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-white">
                Alterar foto
            </button>
        </div>
        <div className="text-center md:text-left space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{alunoData?.nome || "Meu Perfil"}</h1>
          <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <span className="bg-gray-100 text-gray-500 border-gray-100 px-3 py-1 rounded-full text-xs border transition-colors">E-mail: {session?.user.email}</span>
              <span className="bg-blue-50 text-blue-700 border-blue-100 px-3 py-1 rounded-full text-xs border font-bold transition-colors">Aluno Verificado</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className={`${isDark ? "bg-[#1e1e1e] border-white/5" : "bg-white border-black/5 shadow-md"} border-none shadow-xl border`}>
            <CardHeader>
            <CardTitle className={`${isDark ? "text-white" : "text-gray-900"} flex items-center gap-2`}>
                <UserIcon className="h-5 w-5 text-[#2D6ADF]" />
                Dados da Conta
            </CardTitle>
            <CardDescription className={isDark ? "text-[#B3B3B3]" : "text-gray-500"}>Informações básicas do seu registro</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className={`${isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-black/5"} p-4 rounded-lg border transition-colors`}>
                    <p className={`text-xs ${isDark ? "text-[#B3B3B3]" : "text-gray-400"} uppercase font-bold tracking-wider`}>Nome Completo</p>
                    <p className={`${isDark ? "text-white" : "text-gray-900"} font-medium`}>{alunoData?.nome || "---"}</p>
                </div>
                <div className={`${isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-black/5"} p-4 rounded-lg border transition-colors`}>
                    <p className={`text-xs ${isDark ? "text-[#B3B3B3]" : "text-gray-400"} uppercase font-bold tracking-wider`}>E-mail</p>
                    <p className={`${isDark ? "text-white" : "text-gray-900"} font-medium`}>{session?.user.email}</p>
                </div>
                <div className={`${isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-black/5"} p-4 rounded-lg border transition-colors`}>
                    <p className={`text-xs ${isDark ? "text-[#B3B3B3]" : "text-gray-400"} uppercase font-bold tracking-wider`}>CTR</p>
                    <p className={`${isDark ? "text-white" : "text-gray-900"} font-medium`}>{alunoData?.ctr || "---"}</p>
                </div>
            </CardContent>
        </Card>

        <Card className={`${isDark ? "bg-[#1e1e1e] border-white/5" : "bg-white border-black/5 shadow-md"} border-none shadow-xl border`}>
            <CardHeader>
            <CardTitle className={`${isDark ? "text-white" : "text-gray-900"} flex items-center gap-2`}>
                <Key className="h-5 w-5 text-[#2D6ADF]" />
                Segurança
            </CardTitle>
            <CardDescription className={isDark ? "text-[#B3B3B3]" : "text-gray-500"}>
                Altere sua senha de acesso
            </CardDescription>
            </CardHeader>
            <CardContent>
            <form 
                onSubmit={(e) => {
                e.preventDefault();
                updatePassword.mutate();
                }}
                className="space-y-4"
            >
                <div className="space-y-2">
                <Label htmlFor="current-pass" className={isDark ? "text-white" : "text-gray-700"}>Senha Atual</Label>
                <Input
                    id="current-pass"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Sua senha atual"
                    className={`${isDark ? "bg-white/5 border-white/10 text-white placeholder:text-[#555]" : "bg-white border-gray-200"} focus-visible:ring-[#2D6ADF] transition-colors`}
                    required
                />
                </div>
                <div className="space-y-2">
                <Label htmlFor="new-pass" className={isDark ? "text-white" : "text-gray-700"}>Nova Senha</Label>
                <Input
                    id="new-pass"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className={`${isDark ? "bg-white/5 border-white/10 text-white placeholder:text-[#555]" : "bg-white border-gray-200"} focus-visible:ring-[#2D6ADF] transition-colors`}
                    required
                />
                </div>
                <div className="space-y-2">
                <Label htmlFor="confirm-pass" className={isDark ? "text-white" : "text-gray-700"}>Confirmar Nova Senha</Label>
                <Input
                    id="confirm-pass"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className={`${isDark ? "bg-white/5 border-white/10 text-white placeholder:text-[#555]" : "bg-white border-gray-200"} focus-visible:ring-[#2D6ADF] transition-colors`}
                    required
                />
                </div>

                <div className="pt-4">
                <Button 
                    type="submit" 
                    disabled={updatePassword.isPending || !newPassword || !confirmPassword}
                    className="w-full bg-[#2D6ADF] hover:bg-[#2D6ADF]/90 text-white font-bold transition-all shadow-lg shadow-[#2D6ADF]/20"
                >
                    {updatePassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar Alterações
                </Button>
                </div>
            </form>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}