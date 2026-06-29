import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/PageHeader";
import { MatriculaFlow } from "@/components/admin/MatriculaFlow";

const searchSchema = z.object({
  aluno: z.string().optional(),
  matricula: z.string().optional(),
  step: z.coerce.number().min(1).max(5).optional(),
});

export const Route = createFileRoute("/_admin/alunos/novo")({
  head: () => ({ meta: [{ title: "Nova Matrícula — Soluções Online" }] }),
  validateSearch: searchSchema,
  component: NovoAlunoMatricula,
});

function NovoAlunoMatricula() {
  const { aluno, matricula, step } = Route.useSearch();
  return (
    <div>
      <PageHeader
        title={aluno ? "Continuar Matrícula" : "Nova Matrícula"}
        actions={
          <Button asChild variant="outline">
            <Link to="/alunos">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        }
      />

      <MatriculaFlow
        initialAlunoId={aluno}
        initialMatriculaId={matricula}
        initialStep={step as 1 | 2 | 3 | 4 | 5 | undefined}
      />
    </div>
  );
}
