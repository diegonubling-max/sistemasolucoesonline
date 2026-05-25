import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/PageHeader";
import { AlunoForm, type AlunoFormValues } from "@/components/admin/AlunoForm";

export const Route = createFileRoute("/_admin/alunos/novo")({
  head: () => ({ meta: [{ title: "Novo aluno — EduManager" }] }),
  component: NovoAluno,
});

function NovoAluno() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const mut = useMutation({
    mutationFn: async (v: AlunoFormValues) => {
      const { error } = await supabase.from("alunos").insert({
        ...v,
        responsavel_email: v.responsavel_email || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aluno cadastrado com sucesso!");
      qc.invalidateQueries({ queryKey: ["alunos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["alunos-recentes"] });
      navigate({ to: "/alunos" });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title="Novo aluno"
        actions={
          <Button asChild variant="outline">
            <Link to="/alunos">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        }
      />
      <AlunoForm
        submitting={submitting || mut.isPending}
        onSubmit={async (v) => {
          setSubmitting(true);
          try {
            await mut.mutateAsync(v);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </div>
  );
}
