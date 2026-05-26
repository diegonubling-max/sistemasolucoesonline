import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/PageHeader";
import { MatriculaFlow } from "@/components/admin/MatriculaFlow";

export const Route = createFileRoute("/_admin/alunos/novo")({
  head: () => ({ meta: [{ title: "Nova Matrícula — EduManager" }] }),
  component: NovoAlunoMatricula,
});

function NovoAlunoMatricula() {
  return (
    <div>
      <PageHeader
        title="Nova Matrícula"
        actions={
          <Button asChild variant="outline">
            <Link to="/alunos">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        }
      />
      
      <MatriculaFlow />
    </div>
  );
}
