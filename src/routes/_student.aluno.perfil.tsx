import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Key, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_student/aluno/perfil")({
  head: () => ({ meta: [{ title: "Meu Perfil — EduManager" }] }),
  component: StudentProfile,
});

function StudentProfile() {
  const { session } = useAuth();
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

      // 2. Atualizar para a nova senha via Supabase Auth diretamente
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <UserIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
          <p className="text-muted-foreground">{session?.user.email}</p>
        </div>
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Alterar Senha
          </CardTitle>
          <CardDescription>
            Mantenha sua conta segura trocando sua senha periodicamente
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
              <Label htmlFor="current-pass">Senha Atual</Label>
              <Input
                id="current-pass"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Sua senha atual"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pass">Nova Senha</Label>
              <Input
                id="new-pass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pass">Confirmar Nova Senha</Label>
              <Input
                id="confirm-pass"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                required
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                disabled={updatePassword.isPending || !newPassword || !confirmPassword}
                className="bg-[#3B82F6] hover:bg-[#3B82F6]/90"
              >
                {updatePassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Nova Senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}