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


export function AgendamentoProvaFinal({ alunoId }: { alunoId: string }) {
  const qc = useQueryClient();
  const [dataProva, setDataProva] = useState(format(new Date(), "yyyy-MM-dd"));
  const [horaProva, setHoraProva] = useState("14:00");

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
      const { error } = await supabase.from("prova_agendamentos").insert({
        aluno_id: alunoId,
        data_prova: dataProva,
        hora_prova: horaProva,
        status: "agendado",
      });
      if (error) throw error;
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
                    <th className="px-4 py-2 text-left">Data</th>
                    <th className="px-4 py-2 text-left">Hora</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {agendamentos.map((ag) => (
                    <tr key={ag.id} className="group">
                      <td colSpan={4} className="p-0">
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
                                  <ResultBadge agendamentoId={ag.id} alunoId={alunoId} status={ag.status} />
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
                              <DetalhesResultado agendamentoId={ag.id} alunoId={alunoId} />
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
