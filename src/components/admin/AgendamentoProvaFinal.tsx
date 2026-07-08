import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, Calendar as CalendarIcon, CheckCircle2, History, ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { sendAgendamentoProva } from "@/services/zApiService";
import { MateriasSelector, MATERIAS_PADRAO } from "@/components/prova/MateriasSelector";



export function AgendamentoProvaFinal({ alunoId }: { alunoId: string }) {
  const qc = useQueryClient();
  const [dataProva, setDataProva] = useState(format(new Date(), "yyyy-MM-dd"));
  const [horaProva, setHoraProva] = useState("14:00");
  const [materias, setMaterias] = useState<string[]>([...MATERIAS_PADRAO]);

  const { data: agendamentos, isLoading } = useQuery({
    queryKey: ["prova-agendamentos", alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prova_agendamentos")
        .select("*")
        .eq("aluno_id", alunoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const agendar = useMutation({
    mutationFn: async () => {
      if (materias.length === 0) throw new Error("Selecione pelo menos uma matéria");
      const { error } = await supabase.from("prova_agendamentos").insert({
        aluno_id: alunoId,
        data_prova: dataProva,
        hora_prova: horaProva,
        status: "agendado",
        materias_selecionadas: materias,
      } as any);
      if (error) throw error;

      const { data: aluno } = await supabase
        .from("alunos")
        .select("nome, telefone")
        .eq("id", alunoId)
        .maybeSingle();
      if (aluno?.telefone) {
        await sendAgendamentoProva({
          telefone: aluno.telefone,
          nome: aluno.nome ?? "",
          dataProva,
          horaProva,
          alunoId,
        });
      }
    },
    onSuccess: () => {
      toast.success("Prova agendada com sucesso!");
      qc.invalidateQueries({ queryKey: ["prova-agendamentos", alunoId] });
    },
    onError: (e: any) => toast.error("Erro ao agendar prova", { description: e.message }),
  });

  const cancelarAgendamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("prova_agendamentos")
        .update({ status: "cancelado" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento cancelado");
      qc.invalidateQueries({ queryKey: ["prova-agendamentos", alunoId] });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Novo Agendamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data da Prova</Label>
              <Input
                type="date"
                value={dataProva}
                onChange={(e) => setDataProva(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Hora da Prova</Label>
              <Input
                type="time"
                value={horaProva}
                onChange={(e) => setHoraProva(e.target.value)}
              />
            </div>
          </div>
          <MateriasSelector value={materias} onChange={setMaterias} />
          <Button
            onClick={() => agendar.mutate()}
            disabled={agendar.isPending}
            className="w-full md:w-auto"
          >
            {agendar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Agendar Prova
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Agendamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Carregando...</div>
          ) : !agendamentos?.length ? (
            <div className="text-center py-4 text-muted-foreground">Nenhum agendamento encontrado.</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left w-1/3">Data</th>
                    <th className="px-4 py-2 text-left w-1/3">Hora</th>
                    <th className="px-4 py-2 text-left w-1/3">Status / Resultado</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {agendamentos.map((ag) => (
                    <tr key={ag.id} className="group">
                      <td colSpan={3} className="p-0">
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value={ag.id} className="border-none">
                            <div className="flex items-center px-4 py-3 hover:bg-muted/30 transition-colors">
                              <div className="flex-1 grid grid-cols-3 items-center">
                                <div className="text-sm font-medium">
                                  {format(new Date(ag.data_prova + 'T00:00:00'), 'dd/MM/yyyy')}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {ag.hora_prova.substring(0, 5)}
                                </div>
                                <div>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    ag.status === 'agendado' ? 'bg-blue-100 text-blue-700' :
                                    ag.status === 'concluido' ? 'bg-green-100 text-green-700' :
                                    ag.status === 'cancelado' ? 'bg-gray-100 text-gray-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {ag.status}
                                  </span>
                                  {ag.status === 'concluido' && (
                                    <ResultBadge agendamentoId={ag.id} alunoId={alunoId as string} status={ag.status} />
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {ag.status === 'concluido' && (
                                  <AccordionTrigger className="p-0 hover:no-underline" />
                                )}
                                {ag.status === 'agendado' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 h-8 px-2"
                                    onClick={() => cancelarAgendamento.mutate(ag.id)}
                                  >
                                    Cancelar
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            <AccordionContent className="px-4 pb-4">
                              <DetalhesResultado agendamentoId={ag.id} alunoId={alunoId as string} />
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </td>
                    </tr>
                  ))}


                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultBadge({ agendamentoId, alunoId, status }: { agendamentoId: string, alunoId: string, status: string }) {
  const { data: resultados } = useQuery({
    queryKey: ["prova-resultados", agendamentoId],
    enabled: status === 'concluido',
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prova_resultados")
        .select("*")
        .eq("agendamento_id", agendamentoId)
        .eq("aluno_id", alunoId);
      if (error) throw error;
      return data;
    },
  });

  if (!resultados || resultados.length === 0) return null;

  const todasAprovadas = resultados.every(r => r.aprovado);

  return (
    <Badge className={cn("ml-2", todasAprovadas ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600")}>
      {todasAprovadas ? "✅ Aprovado" : "❌ Reprovado"}
    </Badge>
  );
}

function DetalhesResultado({ agendamentoId, alunoId }: { agendamentoId: string, alunoId: string }) {
  const { data: resultados, isLoading } = useQuery({
    queryKey: ["prova-resultados", agendamentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prova_resultados")
        .select("*")
        .eq("agendamento_id", agendamentoId)
        .eq("aluno_id", alunoId);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-xs py-2">Carregando resultados...</div>;
  if (!resultados || resultados.length === 0) return <div className="text-xs py-2 text-muted-foreground">Nenhum detalhe disponível.</div>;

  const reprovadas = resultados.filter(r => !r.aprovado).map(r => r.materia);

  return (
    <div className="space-y-3 pt-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {resultados.map((res) => (
          <div key={res.id} className={cn(
            "flex items-center justify-between p-2 rounded-md border text-xs",
            res.aprovado ? "bg-green-50/50 border-green-100 text-green-700" : "bg-red-50/50 border-red-100 text-red-700"
          )}>
            <div className="flex items-center gap-2">
              {res.aprovado ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              <span className="font-medium">{res.materia}</span>
            </div>
            <span className="font-bold">
              {res.total_acertos}/{res.total_questoes} ({Math.round(Number(res.percentual)) || 0}%)
            </span>
          </div>
        ))}
      </div>
      
      {reprovadas.length > 0 && (
        <div className="bg-red-50 p-3 rounded-md border border-red-100">
          <p className="text-xs font-bold text-red-700 flex items-center gap-2">
            <XCircle className="h-3 w-3" />
            Matérias que precisam ser refeitas:
          </p>
          <ul className="mt-1 list-disc list-inside text-xs text-red-600">
            {reprovadas.map(m => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

