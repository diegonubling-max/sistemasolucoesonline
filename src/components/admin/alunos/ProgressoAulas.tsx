import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BookOpen, CheckCircle2, Loader2, PlayCircle, Circle, CheckCheck } from "lucide-react";
import { formatSeconds } from "@/hooks/use-video-progress";
import { useState } from "react";
import { toast } from "sonner";

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

type ConfirmState =
  | { type: "aula"; alunoId: string; cursoId: string; aulaId: string; aulaTitulo: string }
  | { type: "curso"; alunoId: string; cursoId: string; cursoNome: string }
  | null;

export function ProgressoAulas({ alunoId }: ProgressoAulasProps) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const { data: progresso, isLoading } = useQuery<CursoProgresso[]>({
    queryKey: ["aluno-progresso-aulas-v2", alunoId],
    queryFn: async () => {
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

      const { data: aulasData } = await supabase
        .from("aulas")
        .select("id, titulo, ordem, curso_id, ativo")
        .in("curso_id", cursoIds)
        .eq("ativo", true)
        .order("ordem", { ascending: true });

      const { data: progressoData } = await supabase
        .from("aluno_aulas_assistidas")
        .select("aula_id, percentual_assistido, tempo_assistido, duracao_total, created_at")
        .eq("aluno_id", alunoId)
        .in("curso_id", cursoIds)
        .order("created_at", { ascending: false });

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

  const marcarConcluida = useMutation({
    mutationFn: async (payload: { cursoId: string; aulaIds: string[] }) => {
      const rows = payload.aulaIds.map(aulaId => ({
        aluno_id: alunoId,
        aula_id: aulaId,
        curso_id: payload.cursoId,
        percentual_assistido: 100,
        tempo_assistido: 999999,
      }));
      const { error } = await supabase
        .from("aluno_aulas_assistidas")
        .upsert(rows, { onConflict: "aluno_id,aula_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Progresso atualizado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["aluno-progresso-aulas-v2", alunoId] });
      setConfirm(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao atualizar progresso");
    },
  });

  const handleConfirm = () => {
    if (!confirm) return;
    if (confirm.type === "aula") {
      marcarConcluida.mutate({ cursoId: confirm.cursoId, aulaIds: [confirm.aulaId] });
    } else {
      const curso = progresso?.find(c => c.id === confirm.cursoId);
      const aulaIds = (curso?.aulas ?? []).filter(a => a.percentual < 70).map(a => a.id);
      if (aulaIds.length === 0) {
        setConfirm(null);
        return;
      }
      marcarConcluida.mutate({ cursoId: confirm.cursoId, aulaIds });
    }
  };

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

      <Accordion type="multiple" className="space-y-3">
        {progresso.map((curso) => {
          const temPendentes = curso.aulas.some(a => a.percentual < 70);
          return (
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
                {temPendentes && (
                  <div className="flex justify-end pb-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirm({ type: "curso", alunoId, cursoId: curso.id, cursoNome: curso.nome });
                      }}
                    >
                      <CheckCheck className="h-4 w-4 mr-1" />
                      Marcar todas como concluídas
                    </Button>
                  </div>
                )}
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
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {Math.round(aula.percentual)}% assistido
                              {aula.duracao_total > 0 && (
                                <> ({formatSeconds(aula.tempo_assistido)} de {formatSeconds(aula.duracao_total)})</>
                              )}
                            </span>
                            {aula.percentual < 70 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                title="Marcar como concluída"
                                onClick={() =>
                                  setConfirm({
                                    type: "aula",
                                    alunoId,
                                    cursoId: curso.id,
                                    aulaId: aula.id,
                                    aulaTitulo: aula.titulo,
                                  })
                                }
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <Progress value={aula.percentual} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar marcação manual</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "aula" &&
                `Marcar "${confirm.aulaTitulo}" como concluída manualmente?`}
              {confirm?.type === "curso" &&
                `Marcar todas as aulas de "${confirm.cursoNome}" como concluídas manualmente para este aluno?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={marcarConcluida.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              disabled={marcarConcluida.isPending}
            >
              {marcarConcluida.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
