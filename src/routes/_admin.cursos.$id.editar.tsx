import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/PageHeader";
import { CursoForm, type CursoFormValues } from "@/components/admin/CursoForm";

export const Route = createFileRoute("/_admin/cursos/$id/editar")({
  head: () => ({ meta: [{ title: "Editar curso — EduManager" }] }),
  component: EditarCurso,
});

function EditarCurso() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: curso, isLoading } = useQuery({
    queryKey: ["curso", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cursos").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const mut = useMutation({
    mutationFn: async (v: CursoFormValues) => {
      const { error } = await supabase.from("cursos").update(v).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Curso atualizado!");
      qc.invalidateQueries({ queryKey: ["cursos"] });
      qc.invalidateQueries({ queryKey: ["curso", id] });
      navigate({ to: "/cursos" });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title="Editar curso"
        actions={
          <Button asChild variant="outline">
            <Link to="/cursos">
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Link>
          </Button>
        }
      />
      {isLoading || !curso ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <CursoForm
          initialValues={{ 
            nome: curso.nome, 
            segmento_id: curso.segmento_id || "", 
            descricao: curso.descricao ?? "", 
            thumbnail_url: curso.thumbnail_url,
            ativo: curso.ativo 
          }}
          submitting={mut.isPending}
          submitLabel="Salvar alterações"
          onSubmit={(v) => mut.mutateAsync(v)}
        />
      )}
    </div>
  );
}
