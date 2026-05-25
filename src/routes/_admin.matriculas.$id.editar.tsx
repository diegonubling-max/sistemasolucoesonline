import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/PageHeader";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/matriculas/$id/editar")({
  head: () => ({ meta: [{ title: "Editar Matrícula — EduManager" }] }),
  component: EditarMatricula,
});

function EditarMatricula() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [observation, setObservation] = useState("");

  const { data: matricula, isLoading: loadingMatricula } = useQuery({
    queryKey: ["matricula", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select(`
          id,
          observacao,
          aluno_id,
          alunos (nome),
          matricula_cursos (curso_id)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: courses, isLoading: loadingCourses } = useQuery({
    queryKey: ["courses-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select("id, nome, aulas(count)")
        .eq("ativo", true);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (matricula) {
      setObservation(matricula.observacao || "");
      if (matricula.matricula_cursos) {
        setSelectedCourses(matricula.matricula_cursos.map((mc: any) => mc.curso_id));
      }
    }
  }, [matricula]);

  const update = useMutation({
    mutationFn: async () => {
      // 1. Update observation
      const { error: mError } = await supabase
        .from("matriculas")
        .update({ observacao: observation })
        .eq("id", id);
      if (mError) throw mError;

      // 2. Remove old course links
      const { error: dError } = await supabase
        .from("matricula_cursos")
        .delete()
        .eq("matricula_id", id);
      if (dError) throw dError;

      // 3. Add new course links
      const courseInserts = selectedCourses.map((courseId) => ({
        matricula_id: id,
        curso_id: courseId,
      }));

      const { error: mcError } = await supabase.from("matricula_cursos").insert(courseInserts);
      if (mcError) throw mcError;
    },
    onSuccess: () => {
      toast.success("Matrícula atualizada com sucesso");
      qc.invalidateQueries({ queryKey: ["matriculas"] });
      qc.invalidateQueries({ queryKey: ["matricula", id] });
      navigate({ to: "/matriculas" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleCourse = (id: string) => {
    setSelectedCourses(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  if (loadingMatricula) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/matriculas" })}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para listagem
        </Button>
      </div>

      <PageHeader 
        title={`Editar Matrícula: ${matricula?.alunos?.nome}`} 
        description="Gerencie os cursos liberados para este aluno"
      />

      <Card>
        <CardHeader>
          <CardTitle>Cursos da Matrícula</CardTitle>
          <CardDescription>Adicione ou remova cursos para este acesso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loadingCourses && (
              <div className="col-span-2 flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            {courses?.map((c: any) => {
              const isSelected = selectedCourses.includes(c.id);
              const aulasCount = Array.isArray(c.aulas) ? (c.aulas[0]?.count ?? 0) : 0;
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCourse(c.id)}
                  className={`relative text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                    isSelected 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 h-5 w-5 bg-primary text-white rounded-full flex items-center justify-center animate-in zoom-in">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                  <h5 className="font-bold text-lg mb-1">{c.nome}</h5>
                  <p className="text-sm text-muted-foreground">{aulasCount} aulas</p>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Observação (opcional)</label>
            <Textarea 
              placeholder="Informações adicionais sobre esta matrícula..."
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => navigate({ to: "/matriculas" })}>Cancelar</Button>
            <Button 
              disabled={selectedCourses.length === 0 || update.isPending}
              onClick={() => update.mutate()}
            >
              {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}