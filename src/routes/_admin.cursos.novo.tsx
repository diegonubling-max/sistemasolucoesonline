import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/PageHeader";
import { CursoForm, type CursoFormValues } from "@/components/admin/CursoForm";

export const Route = createFileRoute("/_admin/cursos/novo")({
  head: () => ({ meta: [{ title: "Novo curso — Soluções Online" }] }),
  component: NovoCurso,
});

function NovoCurso() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async (v: CursoFormValues) => {
      const { error } = await supabase.from("cursos").insert(v);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Curso cadastrado!");
      qc.invalidateQueries({ queryKey: ["cursos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      navigate({ to: "/cursos" });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title="Novo curso"
        actions={
          <Button asChild variant="outline">
            <Link to="/cursos">
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Link>
          </Button>
        }
      />
      <CursoForm submitting={mut.isPending} onSubmit={(v) => mut.mutateAsync(v)} />
    </div>
  );
}
