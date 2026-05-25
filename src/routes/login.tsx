import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login — EduManager" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/" });
  }, [session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Falha no login", { description: error.message });
      return;
    }
    toast.success("Bem-vindo ao EduManager!");
    navigate({ to: "/" });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground mb-4">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Edu<span className="text-accent">Manager</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Acesse o painel administrativo</p>
        </div>

        <div className="bg-card rounded-xl shadow-sm border p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
            <div className="pt-2 text-center">
              <p className="text-xs text-muted-foreground">
                Não tem uma conta?{" "}
                <button
                  type="button"
                  onClick={async () => {
                    if (!email || !password) {
                      toast.error("Preencha e-mail e senha para criar conta admin");
                      return;
                    }
                    setLoading(true);
                    const { data, error } = await supabase.auth.signUp({ email, password });
                    if (error) {
                      toast.error("Erro ao criar conta", { description: error.message });
                    } else if (data.user) {
                      const { error: roleError } = await supabase
                        .from("user_roles")
                        .insert({ user_id: data.user.id, role: "admin" });
                      
                      if (roleError) {
                        toast.error("Erro ao atribuir perfil admin", { description: roleError.message });
                      } else {
                        toast.success("Conta admin criada e logada com sucesso!");
                        navigate({ to: "/" });
                      }
                    }
                    setLoading(false);
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Criar conta Admin
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
