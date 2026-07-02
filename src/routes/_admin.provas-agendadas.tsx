import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/provas-agendadas")({
  head: () => ({
    meta: [{ title: "Provas Agendadas | Soluções Online" }],
  }),
  component: ProvasAgendadasPage,
});

type ProvaStatusFilter = "todos" | "agendada" | "aprovado" | "reprovado";
type FinStatusFilter = "todos" | "pago" | "aberto" | "atraso";

function ProvasAgendadasPage() {
  const qc = useQueryClient();
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [provaStatus, setProvaStatus] = useState<ProvaStatusFilter>("todos");
  const [finStatus, setFinStatus] = useState<FinStatusFilter>("todos");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["provas-agendadas-list", dataInicio, dataFim],
    queryFn: async () => {
      let q = supabase
        .from("prova_agendamentos")
        .select(`
          id, data_prova, hora_prova, status, docs_solicitados, docs_recebidos,
          aluno:alunos ( id, nome, ctr, telefone )
        `)
        .order("data_prova", { ascending: true });
      if (dataInicio) q = q.gte("data_prova", dataInicio);
      if (dataFim) q = q.lte("data_prova", dataFim);
      const { data, error } = await q;
      if (error) throw error;
      const agendamentos = (data ?? []) as any[];

      const alunoIds = Array.from(new Set(agendamentos.map(a => a.aluno?.id).filter(Boolean)));
      const agIds = agendamentos.map(a => a.id);

      // Resultados por agendamento
      const { data: resultados } = agIds.length ? await supabase
        .from("prova_resultados")
        .select("agendamento_id, aprovado, percentual")
        .in("agendamento_id", agIds) : { data: [] as any[] };

      const resByAg = new Map<string, { aprovado: boolean; nota: number }>();
      (resultados ?? []).forEach((r: any) => {
        const cur = resByAg.get(r.agendamento_id);
        const nota = Number(r.percentual ?? 0);
        if (!cur) {
          resByAg.set(r.agendamento_id, { aprovado: !!r.aprovado, nota });
        } else {
          resByAg.set(r.agendamento_id, {
            aprovado: cur.aprovado && !!r.aprovado,
            nota: (cur.nota + nota) / 2,
          });
        }
      });

      // Média correta: somar acertos/total por agendamento
      const notaByAg = new Map<string, { total: number; count: number; aprovadoAll: boolean; hasAny: boolean }>();
      (resultados ?? []).forEach((r: any) => {
        const cur = notaByAg.get(r.agendamento_id) ?? { total: 0, count: 0, aprovadoAll: true, hasAny: false };
        cur.total += Number(r.percentual ?? 0);
        cur.count += 1;
        cur.aprovadoAll = cur.aprovadoAll && !!r.aprovado;
        cur.hasAny = true;
        notaByAg.set(r.agendamento_id, cur);
      });

      // Parcelas por aluno para status financeiro
      const parcelasByAluno = new Map<string, { pago: number; abertoFut: number; atraso: number }>();
      if (alunoIds.length) {
        const { data: matriculas } = await supabase
          .from("matriculas")
          .select("id, aluno_id")
          .in("aluno_id", alunoIds);
        const matIds = (matriculas ?? []).map((m: any) => m.id);
        const matToAluno = new Map<string, string>();
        (matriculas ?? []).forEach((m: any) => matToAluno.set(m.id, m.aluno_id));

        if (matIds.length) {
          const { data: parcelas } = await supabase
            .from("parcelas")
            .select("matricula_id, status, data_vencimento")
            .in("matricula_id", matIds);
          const hoje = new Date().toISOString().slice(0, 10);
          (parcelas ?? []).forEach((p: any) => {
            const aid = matToAluno.get(p.matricula_id);
            if (!aid) return;
            const cur = parcelasByAluno.get(aid) ?? { pago: 0, abertoFut: 0, atraso: 0 };
            if (p.status === "pago") cur.pago += 1;
            else if (p.status === "aberto" || p.status === "pendente") {
              if (p.data_vencimento && p.data_vencimento < hoje) cur.atraso += 1;
              else cur.abertoFut += 1;
            }
            parcelasByAluno.set(aid, cur);
          });
        }
      }

      return agendamentos.map((a) => {
        const res = notaByAg.get(a.id);
        const finStat = (() => {
          const p = parcelasByAluno.get(a.aluno?.id) ?? { pago: 0, abertoFut: 0, atraso: 0 };
          if (p.atraso > 0) return "atraso";
          if (p.abertoFut > 0) return "aberto";
          if (p.pago > 0) return "pago";
          return "pago";
        })();
        return {
          ...a,
          nota: res && res.count > 0 ? res.total / res.count : null,
          aprovado: res?.hasAny ? res.aprovadoAll : null,
          finStat,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    return (rows ?? []).filter((r: any) => {
      if (provaStatus !== "todos") {
        if (provaStatus === "agendada" && (r.aprovado !== null)) return false;
        if (provaStatus === "aprovado" && r.aprovado !== true) return false;
        if (provaStatus === "reprovado" && r.aprovado !== false) return false;
      }
      if (finStatus !== "todos" && r.finStat !== finStatus) return false;
      return true;
    });
  }, [rows, provaStatus, finStatus]);

  const toggleFlag = useMutation({
    mutationFn: async (v: { id: string; field: "docs_solicitados" | "docs_recebidos"; value: boolean }) => {
      const { error } = await supabase
        .from("prova_agendamentos")
        .update({ [v.field]: v.value })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provas-agendadas-list"] });
      toast.success("Atualizado");
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Provas Agendadas" description="Acompanhe as provas agendadas dos alunos" />

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="grid grid-cols-2 gap-2 md:col-span-2">
            <div>
              <Label>Data início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label>Data fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Status da Prova</Label>
            <Select value={provaStatus} onValueChange={(v) => setProvaStatus(v as ProvaStatusFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="agendada">🟡 Agendada</SelectItem>
                <SelectItem value="aprovado">🟢 Aprovado</SelectItem>
                <SelectItem value="reprovado">🔴 Reprovado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status Financeiro</Label>
            <Select value={finStatus} onValueChange={(v) => setFinStatus(v as FinStatusFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pago">✅ Tudo pago</SelectItem>
                <SelectItem value="aberto">🟡 Em aberto</SelectItem>
                <SelectItem value="atraso">🔴 Em atraso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>CTR</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Data da Prova</TableHead>
                  <TableHead>Status da Prova</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Financeiro</TableHead>
                  <TableHead>Documentos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum agendamento encontrado</TableCell></TableRow>
                )}
                {filtered.map((r: any) => {
                  const provaBadge = r.aprovado === true
                    ? <Badge className="bg-green-500">🟢 Aprovado</Badge>
                    : r.aprovado === false
                      ? <Badge className="bg-red-500">🔴 Reprovado</Badge>
                      : <Badge className="bg-yellow-500">🟡 Agendada</Badge>;
                  const finBadge = r.finStat === "pago"
                    ? <Badge className="bg-green-500">✅ Tudo pago</Badge>
                    : r.finStat === "atraso"
                      ? <Badge className="bg-red-500">🔴 Em atraso</Badge>
                      : <Badge className="bg-yellow-500">🟡 Em aberto</Badge>;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.aluno?.nome ?? "—"}</TableCell>
                      <TableCell>{r.aluno?.ctr ?? "—"}</TableCell>
                      <TableCell>{r.aluno?.telefone ?? "—"}</TableCell>
                      <TableCell>
                        {new Date(r.data_prova + "T00:00:00").toLocaleDateString("pt-BR")} {r.hora_prova?.slice(0, 5)}
                      </TableCell>
                      <TableCell>{provaBadge}</TableCell>
                      <TableCell>{r.nota != null ? Number(r.nota).toFixed(1) + "%" : "—"}</TableCell>
                      <TableCell>{finBadge}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant={r.docs_solicitados ? "default" : "outline"}
                            onClick={() => toggleFlag.mutate({ id: r.id, field: "docs_solicitados", value: !r.docs_solicitados })}
                          >
                            {r.docs_solicitados && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            Solicitados
                          </Button>
                          <Button
                            size="sm"
                            variant={r.docs_recebidos ? "default" : "outline"}
                            onClick={() => toggleFlag.mutate({ id: r.id, field: "docs_recebidos", value: !r.docs_recebidos })}
                          >
                            {r.docs_recebidos && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            Recebidos
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
