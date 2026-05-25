import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/PageHeader";
import { AlunoForm, type AlunoFormValues } from "@/components/admin/AlunoForm";

export const Route = createFileRoute("/_admin/alunos/$id/editar")({
  head: () => ({ meta: [{ title: "Editar aluno — EduManager" }] }),
  component: EditarAluno,
});

function EditarAluno() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const { data: aluno, isLoading } = useQuery({
    queryKey: ["aluno", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const mut = useMutation({
    mutationFn: async (v: AlunoFormValues) => {
      const { error } = await supabase
        .from("alunos")
        .update({ ...v, responsavel_email: v.responsavel_email || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aluno atualizado!");
      qc.invalidateQueries({ queryKey: ["alunos"] });
      qc.invalidateQueries({ queryKey: ["aluno", id] });
      navigate({ to: "/alunos/$id", params: { id } });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title="Editar aluno"
        actions={
          <Button asChild variant="outline">
            <Link to="/alunos/$id" params={{ id }}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        }
      />
      {isLoading || !aluno ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <AlunoForm
          initialValues={{
            nome: aluno.nome,
            telefone: aluno.telefone,
            email: aluno.email,
            data_nascimento: aluno.data_nascimento,
            cpf: aluno.cpf,
            endereco: aluno.endereco ?? "",
            bairro: aluno.bairro ?? "",
            cidade: aluno.cidade ?? "",
            estado: aluno.estado ?? "",
            ativo: aluno.ativo,
            origem: aluno.origem as any,
            origem_detalhe: aluno.origem_detalhe ?? "",
            vendedora: aluno.vendedora,
            observacao: aluno.observacao ?? "",
            responsavel_nome: aluno.responsavel_nome ?? "",
            responsavel_telefone: aluno.responsavel_telefone ?? "",
            responsavel_cpf: aluno.responsavel_cpf ?? "",
            responsavel_email: aluno.responsavel_email ?? "",
          }}
          submitting={submitting || mut.isPending}
          submitLabel="Salvar alterações"
          onSubmit={async (v) => {
            setSubmitting(true);
            try {
              await mut.mutateAsync(v);
            } finally {
              setSubmitting(false);
            }
          }}
        />
      )}
    </div>
  );
}
