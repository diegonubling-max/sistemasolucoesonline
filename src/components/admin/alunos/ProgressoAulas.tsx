import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, CheckCircle2, Loader2 } from "lucide-react";

interface ProgressoAulasProps {
  alunoId: string;
}

export function ProgressoAulas({ alunoId }: ProgressoAulasProps) {
  const { data: progresso, isLoading } = useQuery({
    queryKey: ["aluno-progresso-aulas", alunoId],
    queryFn: async () => {
      // 1. Buscar cursos matriculados
      const { data: matriculas } = await supabase
        .from("matriculas")
        .select("id")
        .eq("aluno_id", alunoId);

      const matriculaIds = (matriculas ?? []).map(m => m.id);
      if (matriculaIds.length === 0) return [];

      const { data: matriculaCursos, error: coursesError } = await supabase
        .from("matricula_cursos")
        .select("curso_id, cursos(nome)")
        .in("matricula_id", matriculaIds);

      if (coursesError) throw coursesError;

      const cursos = matriculaCursos?.map(mc => ({
        id: mc.curso_id,
        nome: (mc.cursos as any)?.nome || "Curso sem nome"
      })) || [];

      // 2. Para cada curso, buscar total de aulas e aulas assistidas
      const cursoIds = cursos.map(c => c.id);
      
      // Total de aulas por curso
      const { data: totalAulasData } = await supabase
        .from("aulas")
        .select("curso_id")
        .in("curso_id", cursoIds);

      // Aulas assistidas por curso
      const { data: assistidasData } = await supabase
        .from("aluno_aulas_assistidas")
        .select("curso_id")
        .eq("aluno_id", alunoId)
        .in("curso_id", cursoIds);

      // Processar dados
      return cursos.map(curso => {
        const total = totalAulasData?.filter(a => a.curso_id === curso.id).length || 0;
        const assistidas = assistidasData?.filter(a => a.curso_id === curso.id).length || 0;
        const percentual = total > 0 ? Math.round((assistidas / total) * 100) : 0;

        return {
          ...curso,
          total,
          assistidas,
          percentual
        };
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!progresso || progresso.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Nenhum curso matriculado encontrado para este aluno.
        </CardContent>
      </Card>
    );
  }

  const totalGeralAulas = progresso.reduce((acc, curr) => acc + curr.total, 0);
  const totalGeralAssistidas = progresso.reduce((acc, curr) => acc + curr.assistidas, 0);
  const percentualGeral = totalGeralAulas > 0 ? Math.round((totalGeralAssistidas / totalGeralAulas) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Resumo Geral de Progresso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Progresso Total</p>
              <p className="text-2xl font-bold">
                {totalGeralAssistidas} de {totalGeralAulas} aulas assistidas
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Percentual Geral</p>
              <p className="text-2xl font-bold text-primary">{percentualGeral}%</p>
            </div>
          </div>
          <Progress value={percentualGeral} className="h-3" />
        </CardContent>
      </Card>

      {/* Lista de Cursos */}
      <div className="grid gap-4 md:grid-cols-2">
        {progresso.map((curso) => (
          <Card key={curso.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-md flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                {curso.nome}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm text-muted-foreground">
                  {curso.assistidas} de {curso.total} aulas
                </span>
                <span className="font-semibold">{curso.percentual}%</span>
              </div>
              <Progress value={curso.percentual} className="h-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
