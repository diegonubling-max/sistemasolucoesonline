import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, CheckCircle2, Loader2, PlayCircle, Circle } from "lucide-react";
import { formatSeconds } from "@/hooks/use-video-progress";

interface ProgressoAulasProps {
  alunoId: string;
}

type AulaProgresso = {
  id: string;
  titulo: string;
  ordem: number;
  percentual: number;
  tempo_assistido: number;
  duracao_total: number;
};

type CursoProgresso = {
  id: string;
  nome: string;
  aulas: AulaProgresso[];
  totalAulas: number;
  aulasConcluidas: number;
  mediaProgresso: number;
};

export function ProgressoAulas({ alunoId }: ProgressoAulasProps) {
  const { data: progresso, isLoading } = useQuery<CursoProgresso[]>({
    queryKey: ["aluno-progresso-aulas-v2", alunoId],
    queryFn: async () => {
      // 1. Cursos matriculados
      const { data: matriculas } = await supabase
        .from("matriculas")
        .select("id")
        .eq("aluno_id", alunoId);
      const matriculaIds = (matriculas ?? []).map(m => m.id);
      if (matriculaIds.length === 0) return [];

      const { data: matriculaCursos } = await supabase
        .from("matricula_cursos")
        .select("curso_id, cursos(nome)")
        .in("matricula_id", matriculaIds);

      const cursosMap = new Map<string, { id: string; nome: string }>();
      matriculaCursos?.forEach(mc => {
        if (!cursosMap.has(mc.curso_id)) {
          cursosMap.set(mc.curso_id, {
            id: mc.curso_id,
            nome: (mc.cursos as any)?.nome || "Curso sem nome",
          });
        }
      });
      const cursos = Array.from(cursosMap.values());
      const cursoIds = cursos.map(c => c.id);
      if (cursoIds.length === 0) return [];

      // 2. Aulas dos cursos
      const { data: aulasData } = await supabase
        .from("aulas")
        .select("id, titulo, ordem, curso_id, ativo")
        .in("curso_id", cursoIds)
        .eq("ativo", true)
        .order("ordem", { ascending: true });

      // 3. Progresso do aluno em cada aula
      const { data: progressoData } = await supabase
        .from("aluno_aulas_assistidas")
        .select("aula_id, percentual_assistido, tempo_assistido, duracao_total, created_at")
        .eq("aluno_id", alunoId)
        .in("curso_id", cursoIds)
        .order("created_at", { ascending: false });

      // Map: aula_id -> latest row
      const progressoMap = new Map<string, any>();
      progressoData?.forEach(p => {
        if (!progressoMap.has(p.aula_id)) progressoMap.set(p.aula_id, p);
      });

      return cursos.map(curso => {
        const aulas: AulaProgresso[] = (aulasData ?? [])
          .filter(a => a.curso_id === curso.id)
          .map(a => {
            const p = progressoMap.get(a.id);
            return {
              id: a.id,
              titulo: a.titulo,
              ordem: a.ordem,
              percentual: Number(p?.percentual_assistido ?? 0),
              tempo_assistido: Number(p?.tempo_assistido ?? 0),
              duracao_total: Number(p?.duracao_total ?? 0),
            };
          });

        const aulasIniciadas = aulas.filter(a => a.percentual > 0);
        const mediaProgresso = aulasIniciadas.length > 0
          ? Math.round(aulasIniciadas.reduce((s, a) => s + a.percentual, 0) / aulasIniciadas.length)
          : 0;
        const aulasConcluidas = aulas.filter(a => a.percentual >= 70).length;

        return {
          ...curso,
          aulas,
          totalAulas: aulas.length,
          aulasConcluidas,
          mediaProgresso,
        };
      });
    },
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

  const totalAulasGeral = progresso.reduce((acc, c) => acc + c.totalAulas, 0);
  const totalConcluidasGeral = progresso.reduce((acc, c) => acc + c.aulasConcluidas, 0);
  const aulasIniciadasAll = progresso.flatMap(c => c.aulas).filter(a => a.percentual > 0);
  const engajamento = aulasIniciadasAll.length > 0
    ? Math.round(aulasIniciadasAll.reduce((s, a) => s + a.percentual, 0) / aulasIniciadasAll.length)
    : 0;
  const percentualGeral = totalAulasGeral > 0
    ? Math.round((totalConcluidasGeral / totalAulasGeral) * 100)
    : 0;

  const statusIcon = (pct: number) => {
    if (pct >= 70) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (pct >= 1) return <PlayCircle className="h-4 w-4 text-yellow-500" />;
    return <Circle className="h-4 w-4 text-gray-300" />;
  };

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Aulas concluídas</p>
              <p className="text-2xl font-bold">
                {totalConcluidasGeral} <span className="text-base font-normal text-muted-foreground">de {totalAulasGeral}</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Conclusão</p>
              <p className="text-2xl font-bold text-primary">{percentualGeral}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Engajamento médio</p>
              <p className="text-2xl font-bold text-yellow-600">{engajamento}%</p>
              <p className="text-xs text-muted-foreground">média das aulas iniciadas</p>
            </div>
          </div>
          <Progress value={percentualGeral} className="h-3" />
        </CardContent>
      </Card>

      {/* Lista de Cursos (Accordion - múltiplos abertos) */}
      <Accordion type="multiple" className="space-y-3">
        {progresso.map((curso) => (
          <AccordionItem
            key={curso.id}
            value={curso.id}
            className="border rounded-lg bg-card px-4"
          >
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center justify-between gap-2 w-full pr-2">
                <span className="flex items-center gap-2 font-medium">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  {curso.nome}
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {curso.aulasConcluidas}/{curso.totalAulas} concluídas · engajamento {curso.mediaProgresso}%
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {curso.aulas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma aula cadastrada.</p>
              ) : (
                <div className="space-y-3 pb-2">
                  {curso.aulas.map((aula) => (
                    <div key={aula.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {statusIcon(aula.percentual)}
                          <span className="truncate" title={aula.titulo}>{aula.titulo}</span>
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {Math.round(aula.percentual)}% assistido
                          {aula.duracao_total > 0 && (
                            <> ({formatSeconds(aula.tempo_assistido)} de {formatSeconds(aula.duracao_total)})</>
                          )}
                        </span>
                      </div>
                      <Progress value={aula.percentual} className="h-1.5" />
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

    </div>
  );
}
