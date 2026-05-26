import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Key, User as UserIcon, Mail, ShieldCheck, CreditCard, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_student/aluno/perfil")({
  head: () => ({ meta: [{ title: "Meu Perfil — Soluções Online" }] }),
  component: StudentProfile,
});

function StudentProfile() {
  const { session } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: aluno, isLoading: loadingAluno } = useQuery({
    queryKey: ["student-full-profile", session?.user.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("*")
        .eq("email", session?.user.email ?? "")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user.email,
  });

  const updatePassword = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("As senhas não conferem");
      if (newPassword.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session?.user.email ?? "",
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Senha atual incorreta");
      }

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

  if (loadingAluno) {
    return (
      <div className="flex justify-center py-40 bg-[#141414] min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-[#2ECC71]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-10 text-white font-sans bg-[#141414]">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-center gap-8 bg-[#1e1e1e] p-8 rounded-2xl border border-white/5 shadow-2xl">
        <Avatar className="h-32 w-32 border-4 border-[#2ECC71] shadow-[0_0_30px_rgba(46,204,113,0.2)]">
          <AvatarFallback className="bg-[#141414] text-[#2ECC71] text-4xl font-black">
            {aluno?.nome?.charAt(0).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="text-center md:text-left flex-1 space-y-2">
          <h1 className="text-4xl font-black tracking-tighter text-white">{aluno?.nome}</h1>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-2">
             <div className="flex items-center gap-2 text-[#B3B3B3] bg-black/30 px-3 py-1.5 rounded-full text-sm">
                <Mail className="h-4 w-4 text-[#2ECC71]" />
                {aluno?.email}
             </div>
             <div className="flex items-center gap-2 text-[#B3B3B3] bg-black/30 px-3 py-1.5 rounded-full text-sm">
                <CreditCard className="h-4 w-4 text-[#2ECC71]" />
                CTR: <span className="text-white font-bold">{aluno?.ctr}</span>
             </div>
             <div className="flex items-center gap-2 text-[#B3B3B3] bg-black/30 px-3 py-1.5 rounded-full text-sm">
                <ShieldCheck className="h-4 w-4 text-[#2ECC71]" />
                Conta Ativa
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Password Change Section */}
        <Card className="border-none shadow-2xl bg-[#1e1e1e] text-white">
          <CardHeader className="border-b border-white/5 pb-6">
            <CardTitle className="flex items-center gap-3 text-xl font-bold">
              <Key className="h-6 w-6 text-[#2ECC71]" />
              Segurança
            </CardTitle>
            <CardDescription className="text-[#B3B3B3]">
              Atualize sua senha de acesso periodicamente
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                updatePassword.mutate();
              }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="current-pass" className="text-xs font-black uppercase tracking-widest text-[#B3B3B3]">Senha Atual</Label>
                <Input
                  id="current-pass"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Digite sua senha atual"
                  className="bg-[#2a2a2a] border-none text-white h-12 placeholder:text-[#555] focus-visible:ring-1 focus-visible:ring-[#2ECC71]"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pass" className="text-xs font-black uppercase tracking-widest text-[#B3B3B3]">Nova Senha</Label>
                <Input
                  id="new-pass"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="bg-[#2a2a2a] border-none text-white h-12 placeholder:text-[#555] focus-visible:ring-1 focus-visible:ring-[#2ECC71]"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pass" className="text-xs font-black uppercase tracking-widest text-[#B3B3B3]">Confirmar Nova Senha</Label>
                <Input
                  id="confirm-pass"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="bg-[#2a2a2a] border-none text-white h-12 placeholder:text-[#555] focus-visible:ring-1 focus-visible:ring-[#2ECC71]"
                  required
                />
              </div>

              <div className="pt-4">
                <Button 
                  type="submit" 
                  disabled={updatePassword.isPending || !newPassword || !confirmPassword}
                  className="w-full h-12 bg-[#2ECC71] hover:bg-[#27ae60] text-black font-black uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(46,204,113,0.1)] transition-transform hover:scale-[1.02]"
                >
                  {updatePassword.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Salvar Nova Senha"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info / Tips Card */}
        <div className="space-y-8">
           <div className="bg-gradient-to-br from-[#1e1e1e] to-[#141414] p-8 rounded-2xl border border-white/5 shadow-xl">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                 <ShieldCheck className="h-6 w-6 text-[#2ECC71]" />
                 Dicas de Segurança
              </h3>
              <ul className="space-y-4 text-[#B3B3B3] text-sm leading-relaxed">
                 <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2ECC71] mt-1.5" />
                    Use senhas fortes com letras, números e símbolos.
                 </li>
                 <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2ECC71] mt-1.5" />
                    Nunca compartilhe suas credenciais de acesso com terceiros.
                 </li>
                 <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2ECC71] mt-1.5" />
                    Lembre-se de sair da sua conta ao usar dispositivos públicos.
                 </li>
              </ul>
           </div>
           
           <div className="bg-[#2ECC71]/5 p-8 rounded-2xl border border-[#2ECC71]/20 shadow-xl">
              <h3 className="text-xl font-bold mb-4 text-white">Suporte Premium</h3>
              <p className="text-[#B3B3B3] text-sm leading-relaxed mb-6">
                 Precisa de ajuda com sua conta ou cursos? Nossa equipe está pronta para te atender.
              </p>
              <Button variant="outline" className="w-full border-[#2ECC71] text-[#2ECC71] hover:bg-[#2ECC71] hover:text-black font-bold">
                 Falar com Suporte
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
}
