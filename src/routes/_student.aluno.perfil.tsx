import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Key, User as UserIcon, Phone, Camera, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useStudentTheme } from "./_student";

export const Route = createFileRoute("/_student/aluno/perfil")({
  head: () => ({ meta: [{ title: "Meu Perfil — Soluções Online" }] }),
  component: StudentProfile,
});

function StudentProfile() {
  const { session } = useAuth();
  const { isDark } = useStudentTheme();
  
  const { data: alunoData, refetch: refetchAluno } = useQuery({
    queryKey: ["student-profile", session?.user.email],
    queryFn: async () => {
      const { data } = await supabase
        .from("alunos")
        .select("nome, ctr, email, telefone, foto_perfil")
        .eq("email", session?.user.email ?? "")
        .single();
      return data;
    },
    enabled: !!session?.user.email,
  });

  const { data: configs } = useQuery({
    queryKey: ["global-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("chave, valor");
      if (error) throw error;
      return data;
    },
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

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      if (!session?.user.email) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('fotos-perfil')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('fotos-perfil')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('alunos')
        .update({ foto_perfil: publicUrl })
        .eq('email', session.user.email);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Foto atualizada com sucesso!");
      refetchAluno();
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar foto: " + error.message);
    }
  });

  const handleWhatsAppSupport = () => {
    const whatsappNumber = configs?.find(c => c.chave === "whatsapp_suporte")?.valor;
    const rawMessage = configs?.find(c => c.chave === "mensagem_whatsapp")?.valor || "";
    
    if (!whatsappNumber) return;

    const nome = alunoData?.nome || "";
    const ctr = alunoData?.ctr || "";
    
    const message = rawMessage
      .replace("[nome]", nome)
      .replace("[ctr]", ctr.toString());

    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row items-center gap-8 bg-white border-gray-100 shadow-sm p-8 rounded-2xl border transition-colors shadow-xl">
        <div className="relative group">
            {alunoData?.foto_perfil ? (
              <img 
                src={alunoData.foto_perfil} 
                alt={alunoData.nome}
                className="h-32 w-32 rounded-full object-cover shadow-2xl border-4 border-white"
              />
            ) : (
              <div className="h-32 w-32 rounded-full bg-[#1E3A5F] flex items-center justify-center text-4xl font-bold text-white shadow-2xl border-4 border-white">
                  {alunoData?.nome?.[0]?.toUpperCase() || session?.user.email?.[0]?.toUpperCase()}
              </div>
            )}
            <label className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-center p-2">
                <Camera className="h-6 w-6 mb-1" />
                <span className="text-[10px] font-bold uppercase">Alterar foto</span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadPhoto.mutate(file);
                  }}
                  disabled={uploadPhoto.isPending}
                />
            </label>
            {uploadPhoto.isPending && (
              <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
        </div>
        <div className="text-center md:text-left space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{alunoData?.nome || "Meu Perfil"}</h1>
          <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <span className="bg-blue-50 text-blue-700 border-blue-100 px-3 py-1 rounded-full text-xs border font-bold transition-colors flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Aluno Verificado
              </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-white border-gray-100 shadow-md border-none shadow-xl border">
            <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-[#2D6ADF]" />
                Dados da Conta
            </CardTitle>
            <CardDescription className="text-gray-500">Informações básicas do seu registro</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-gray-50 border-gray-100 p-4 rounded-lg border transition-colors">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Nome Completo</p>
                    <p className="text-gray-900 font-medium">{alunoData?.nome || "---"}</p>
                </div>
                <div className="bg-gray-50 border-gray-100 p-4 rounded-lg border transition-colors">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Telefone
                    </p>
                    <p className="text-gray-900 font-medium">{alunoData?.telefone || "---"}</p>
                </div>
                <div className="bg-gray-50 border-gray-100 p-4 rounded-lg border transition-colors">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">CTR</p>
                    <p className="text-gray-900 font-medium">{alunoData?.ctr || "---"}</p>
                </div>
            </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="bg-white border-gray-100 shadow-md border-none shadow-xl border">
              <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Key className="h-5 w-5 text-[#2D6ADF]" />
                  Segurança
              </CardTitle>
              <CardDescription className="text-gray-500">
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
                  <Label htmlFor="current-pass" className="text-gray-700">Senha Atual</Label>
                  <Input
                      id="current-pass"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Sua senha atual"
                      className="bg-white border-gray-200 focus-visible:ring-[#2D6ADF] transition-colors"
                      required
                  />
                  </div>
                  <div className="space-y-2">
                  <Label htmlFor="new-pass" className="text-gray-700">Nova Senha</Label>
                  <Input
                      id="new-pass"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="bg-white border-gray-200 focus-visible:ring-[#2D6ADF] transition-colors"
                      required
                  />
                  </div>
                  <div className="space-y-2">
                  <Label htmlFor="confirm-pass" className="text-gray-700">Confirmar Nova Senha</Label>
                  <Input
                      id="confirm-pass"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="bg-white border-gray-200 focus-visible:ring-[#2D6ADF] transition-colors"
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

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 px-1">Suporte</h2>
            <Card className="bg-white border-gray-100 shadow-md border-none shadow-xl border overflow-hidden">
              <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <div className="bg-[#25D366]/10 p-2 rounded-lg">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#25D366]" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </div>
                Precisa de ajuda?
              </CardTitle>
              <CardDescription className="text-gray-500">
                {configs?.find(c => c.chave === "whatsapp_suporte")?.valor 
                  ? "Entre em contato com nossa equipe pelo WhatsApp. Estamos prontos para te ajudar!"
                  : "Suporte temporariamente indisponível"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {configs?.find(c => c.chave === "whatsapp_suporte")?.valor && (
                <Button 
                  onClick={handleWhatsAppSupport}
                  className="w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20 py-6 text-lg transition-all"
                >
                  💬 Chamar no WhatsApp
                </Button>
              )}
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </div>
  );
}