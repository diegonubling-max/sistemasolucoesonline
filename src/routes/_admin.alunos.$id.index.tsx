import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Pencil, GraduationCap, Key, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { formatDate } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_admin/alunos/$id/")({
  head: () => ({ meta: [{ title: "Aluno — EduManager" }] }),
  component: AlunoDetalhes,
});

function AlunoDetalhes() {
  const { id } = Route.useParams();
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const resetPassword = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("As senhas não coincidem");
      if (newPassword.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres");

      const { error } = await supabase.functions.invoke("manage-student-access", {
        body: {
          email: aluno?.email,
          action: "reset_password",
          newPassword
        }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso");
      setShowResetModal(false);
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: aluno, isLoading } = useQuery({
    queryKey: ["aluno", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: cursos } = useQuery({
    queryKey: ["aluno-cursos", id],
    queryFn: async () => {
      const { data: ms } = await supabase.from("matriculas").select("id").eq("aluno_id", id);
      const ids = (ms ?? []).map((m) => m.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("matricula_cursos")
        .select("data_liberacao, cursos(id, nome, descricao)")
        .in("matricula_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!aluno) return <p className="text-muted-foreground">Aluno não encontrado.</p>;

  return (
    <div>
      <PageHeader
        title={aluno.nome}
        description={aluno.email}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/alunos">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setShowResetModal(true)}>
              <Key className="h-4 w-4 mr-2" />
              Redefinir Senha
            </Button>
            <Button asChild>
              <Link to="/alunos/$id/editar" params={{ id }}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Dados cadastrais
              {aluno.ativo ? (
                <Badge className="bg-accent text-accent-foreground hover:bg-accent">Ativo</Badge>
              ) : (
                <Badge variant="secondary">Inativo</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Telefone" value={aluno.telefone} />
            <Info label="Sexo" value={aluno.sexo} />
            <Info label="CPF" value={aluno.cpf} />
            <Info label="Nascimento" value={formatDate(aluno.data_nascimento)} />
            <Info label="Menor de idade" value={aluno.menor_de_idade ? "Sim" : "Não"} />
            <Info label="Como nos conheceu" value={aluno.origem_detalhe ? `${aluno.origem} (${aluno.origem_detalhe})` : aluno.origem} />
            <Info label="Vendedora" value={aluno.vendedora} />
            <Info label="Cadastrado em" value={formatDate(aluno.created_at)} />
            {aluno.menor_de_idade && (
              <>
                <div className="col-span-2 mt-4 pt-4 border-t">
                  <h3 className="font-semibold mb-3">Responsável</h3>
                </div>
                <Info label="Nome" value={aluno.responsavel_nome} />
                <Info label="Telefone" value={aluno.responsavel_telefone} />
                <Info label="CPF" value={aluno.responsavel_cpf} />
                <Info label="E-mail" value={aluno.responsavel_email} />
              </>
            )}
          </CardContent>
        </Card>

        {aluno.observacao && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{aluno.observacao}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Cursos liberados
              <Button size="sm" variant="outline" disabled title="Em breve">
                <GraduationCap className="h-4 w-4 mr-2" />
                Matricular
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!cursos || cursos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum curso liberado.</p>
            ) : (
              <ul className="space-y-2">
                {cursos.map((c, i) => {
                  const curso = c.cursos as { id: string; nome: string; descricao: string | null } | null;
                  if (!curso) return null;
                  return (
                    <li key={i} className="p-3 rounded-md border">
                      <p className="font-medium text-sm">{curso.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Liberado em {formatDate(c.data_liberacao)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Digite a nova senha para o aluno <strong>{aluno.nome}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pass">Nova Senha</Label>
              <Input
                id="pass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar Senha</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetModal(false)}>Cancelar</Button>
            <Button 
              onClick={() => resetPassword.mutate()}
              disabled={resetPassword.isPending || !newPassword || !confirmPassword}
            >
              {resetPassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Redefinição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
