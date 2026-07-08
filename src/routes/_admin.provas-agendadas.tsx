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
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/provas-agendadas")({
  head: () => ({
    meta: [{ title: "Provas Agendadas | Soluções Online" }],
  }),
  component: ProvasAgendadasPage,
});

type ProvaStatusFilter = "todos" | "agendada" | "aprovado" | "reprovado";
type FinStatusFilter = "todos" | "pago" | "aberto" | "atraso";
type ResultadoFilter = "todos" | "pendente" | "aprovado" | "reprovado";
type SitFinFilter = "todos" | "ja_pago" | "boleto";
type TipoFilter = "todos" | "sistema" | "externo";

function ProvasAgendadasPage() {
  const qc = useQueryClient();
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [provaStatus, setProvaStatus] = useState<ProvaStatusFilter>("todos");
  const [finStatus, setFinStatus] = useState<FinStatusFilter>("todos");
  const [resultadoFilter, setResultadoFilter] = useState<ResultadoFilter>("todos");
  const [sitFinFilter, setSitFinFilter] = useState<SitFinFilter>("todos");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("todos");
  const [editing, setEditing] = useState<any | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["provas-agendadas-list", dataInicio, dataFim],
    queryFn: async () => {
      let q = supabase
        .from("prova_agendamentos")
        .select(`
          id, data_prova, hora_prova, status, docs_solicitados, docs_recebidos,
          is_externo, nome_aluno, telefone, polo, ctr,
          situacao_financeira, resultado, observacao,
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

      const { data: resultados } = agIds.length ? await supabase
        .from("prova_resultados")
        .select("agendamento_id, aprovado, percentual")
        .in("agendamento_id", agIds) : { data: [] as any[] };

      const notaByAg = new Map<string, { total: number; count: number; aprovadoAll: boolean; hasAny: boolean }>();
      (resultados ?? []).forEach((r: any) => {
        const cur = notaByAg.get(r.agendamento_id) ?? { total: 0, count: 0, aprovadoAll: true, hasAny: false };
        cur.total += Number(r.percentual ?? 0);
        cur.count += 1;
        cur.aprovadoAll = cur.aprovadoAll && !!r.aprovado;
        cur.hasAny = true;
        notaByAg.set(r.agendamento_id, cur);
      });

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
          return "pago";
        })();
        // Nome/telefone/ctr/polo unificados
        const nome = a.is_externo ? (a.nome_aluno ?? "—") : (a.aluno?.nome ?? "—");
        const ctr = a.is_externo ? (a.ctr ?? "—") : (a.aluno?.ctr ?? "—");
        const telefone = a.is_externo ? (a.telefone ?? "—") : (a.aluno?.telefone ?? "—");
        return {
          ...a,
          nome,
          ctrDisplay: ctr,
          telefoneDisplay: telefone,
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
      if (tipoFilter !== "todos") {
        if (tipoFilter === "externo" && !r.is_externo) return false;
        if (tipoFilter === "sistema" && r.is_externo) return false;
      }
      if (sitFinFilter !== "todos" && r.situacao_financeira !== sitFinFilter) return false;
      if (resultadoFilter !== "todos") {
        const res = r.resultado ?? "pendente";
        const norm = res === "" ? "pendente" : res;
        if (norm !== resultadoFilter) return false;
      }
      return true;
    });
  }, [rows, provaStatus, finStatus, tipoFilter, sitFinFilter, resultadoFilter]);

  const toggleFlag = useMutation({
    mutationFn: async (v: { id: string; field: "docs_solicitados" | "docs_recebidos"; value: boolean }) => {
      const patch: { docs_solicitados?: boolean; docs_recebidos?: boolean } = {};
      patch[v.field] = v.value;
      const { error } = await supabase
        .from("prova_agendamentos")
        .update(patch)
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provas-agendadas-list"] });
      toast.success("Atualizado");
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const saveEdit = useMutation({
    mutationFn: async (v: any) => {
      const patch: any = {
        situacao_financeira: v.situacao_financeira || null,
        resultado: v.resultado || null,
        observacao: v.observacao || null,
      };
      if (v.is_externo) {
        patch.nome_aluno = v.nome_aluno || null;
        patch.telefone = v.telefone || null;
        patch.polo = v.polo || null;
      }
      const { error } = await supabase
        .from("prova_agendamentos")
        .update(patch)
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provas-agendadas-list"] });
      toast.success("Salvo");
      setEditing(null);
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const sitFinBadge = (v: string | null) => {
    if (v === "ja_pago") return <Badge className="bg-blue-500">Já pago</Badge>;
    if (v === "boleto") return <Badge className="bg-yellow-500">Boleto</Badge>;
    return <span className="text-muted-foreground">—</span>;
  };

  const resultadoBadge = (v: string | null) => {
    if (v === "aprovado") return <Badge className="bg-green-500">Aprovado</Badge>;
    if (v === "reprovado") return <Badge className="bg-red-500">Reprovado</Badge>;
    return <Badge variant="secondary" className="bg-gray-200 text-gray-700">Pendente</Badge>;
  };

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
          <div>
            <Label>Resultado</Label>
            <Select value={resultadoFilter} onValueChange={(v) => setResultadoFilter(v as ResultadoFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="reprovado">Reprovado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sit. Financeira</Label>
            <Select value={sitFinFilter} onValueChange={(v) => setSitFinFilter(v as SitFinFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ja_pago">Já pago</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipoFilter} onValueChange={(v) => setTipoFilter(v as TipoFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sistema">Do sistema</SelectItem>
                <SelectItem value="externo">Externos</SelectItem>
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
                  <TableHead>Polo</TableHead>
                  <TableHead>Sit. Financeira</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Data da Prova</TableHead>
                  <TableHead>Status da Prova</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Financeiro</TableHead>
                  <TableHead>Documentos</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">Nenhum agendamento encontrado</TableCell></TableRow>
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
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{r.nome}</span>
                          {r.is_externo && (
                            <Badge variant="secondary" className="text-[10px] bg-gray-200 text-gray-700">Externo</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{r.ctrDisplay}</TableCell>
                      <TableCell>{r.telefoneDisplay}</TableCell>
                      <TableCell>{r.is_externo ? (r.polo ?? "—") : "—"}</TableCell>
                      <TableCell>{sitFinBadge(r.situacao_financeira)}</TableCell>
                      <TableCell>{resultadoBadge(r.resultado)}</TableCell>
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
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => setEditing({
                          id: r.id,
                          is_externo: !!r.is_externo,
                          nome_aluno: r.nome_aluno ?? "",
                          telefone: r.telefone ?? "",
                          polo: r.polo ?? "",
                          situacao_financeira: r.situacao_financeira ?? "",
                          resultado: r.resultado ?? "",
                          observacao: r.observacao ?? "",
                        })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              {editing.is_externo && (
                <>
                  <div>
                    <Label>Nome</Label>
                    <Input value={editing.nome_aluno} onChange={(e) => setEditing({ ...editing, nome_aluno: e.target.value })} />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input value={editing.telefone} onChange={(e) => setEditing({ ...editing, telefone: e.target.value })} />
                  </div>
                  <div>
                    <Label>Polo</Label>
                    <Input value={editing.polo} onChange={(e) => setEditing({ ...editing, polo: e.target.value })} />
                  </div>
                </>
              )}
              <div>
                <Label>Sit. Financeira</Label>
                <Select value={editing.situacao_financeira || "none"} onValueChange={(v) => setEditing({ ...editing, situacao_financeira: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="ja_pago">Já pago</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Resultado</Label>
                <Select value={editing.resultado || "none"} onValueChange={(v) => setEditing({ ...editing, resultado: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pendente</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="reprovado">Reprovado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observação</Label>
                <Textarea value={editing.observacao} onChange={(e) => setEditing({ ...editing, observacao: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => saveEdit.mutate(editing)} disabled={saveEdit.isPending}>
              {saveEdit.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
