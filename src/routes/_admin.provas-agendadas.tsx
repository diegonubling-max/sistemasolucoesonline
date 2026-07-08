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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

type SitFinFilter = "todos" | "ja_pago" | "boleto";
type TipoFilter = "todos" | "sistema" | "externo";
type TabKey = "agendada" | "aprovado" | "reprovado";

const HOJE = new Date().toISOString().slice(0, 10);

function ProvasAgendadasPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("agendada");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
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

      return agendamentos.map((a) => {
        const nome = a.is_externo ? (a.nome_aluno ?? "—") : (a.aluno?.nome ?? "—");
        const ctr = a.is_externo ? (a.ctr ?? "—") : (a.aluno?.ctr ?? "—");
        const telefone = a.is_externo ? (a.telefone ?? "—") : (a.aluno?.telefone ?? "—");
        return {
          ...a,
          nome,
          ctrDisplay: ctr,
          telefoneDisplay: telefone,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    const base = (rows ?? []).filter((r: any) => {
      const st = (r.status ?? "agendada") as string;
      if (st !== tab) return false;
      if (tipoFilter !== "todos") {
        if (tipoFilter === "externo" && !r.is_externo) return false;
        if (tipoFilter === "sistema" && r.is_externo) return false;
      }
      if (sitFinFilter !== "todos" && r.situacao_financeira !== sitFinFilter) return false;
      return true;
    });
    if (tab === "agendada") {
      base.sort((a: any, b: any) => {
        const d = (a.data_prova ?? "").localeCompare(b.data_prova ?? "");
        if (d !== 0) return d;
        return (a.hora_prova ?? "").localeCompare(b.hora_prova ?? "");
      });
    } else {
      base.sort((a: any, b: any) => (b.data_prova ?? "").localeCompare(a.data_prova ?? ""));
    }
    return base;
  }, [rows, tab, tipoFilter, sitFinFilter]);

  const counts = useMemo(() => {
    const c = { agendada: 0, aprovado: 0, reprovado: 0 } as Record<TabKey, number>;
    (rows ?? []).forEach((r: any) => {
      const st = (r.status ?? "agendada") as TabKey;
      if (st in c) c[st]++;
    });
    return c;
  }, [rows]);

  const toggleFlag = useMutation({
    mutationFn: async (v: { id: string; field: "docs_solicitados" | "docs_recebidos"; value: boolean }) => {
      const patch: any = {};
      patch[v.field] = v.value;
      const { error } = await supabase.from("prova_agendamentos").update(patch).eq("id", v.id);
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
        status: v.status || "agendada",
        resultado: v.status === "aprovado" ? "aprovado" : v.status === "reprovado" ? "reprovado" : null,
        observacao: v.observacao || null,
      };
      if (v.is_externo) {
        patch.nome_aluno = v.nome_aluno || null;
        patch.telefone = v.telefone || null;
        patch.polo = v.polo || null;
      }
      const { error } = await supabase.from("prova_agendamentos").update(patch).eq("id", v.id);
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

  const openEdit = (r: any) => setEditing({
    id: r.id,
    is_externo: !!r.is_externo,
    nome_aluno: r.nome_aluno ?? "",
    telefone: r.telefone ?? "",
    polo: r.polo ?? "",
    situacao_financeira: r.situacao_financeira ?? "",
    status: r.status ?? "agendada",
    observacao: r.observacao ?? "",
  });

  const renderTable = () => {
    if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>;
    if (filtered.length === 0) return <div className="text-center text-muted-foreground py-8">Nenhum registro</div>;

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Aluno</TableHead>
            <TableHead>CTR</TableHead>
            <TableHead>Polo</TableHead>
            <TableHead>Data da Prova</TableHead>
            <TableHead>Horário</TableHead>
            <TableHead>Sit. Financeira</TableHead>
            
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r: any) => {
            const isHoje = tab === "agendada" && r.data_prova === HOJE;
            return (
              <TableRow key={r.id} className={isHoje ? "bg-yellow-50 dark:bg-yellow-950/30" : ""}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{r.nome}</span>
                    {r.is_externo && (
                      <Badge variant="secondary" className="text-[10px] bg-gray-200 text-gray-700">Externo</Badge>
                    )}
                    {isHoje && <Badge className="bg-red-500 text-white">PROVA HOJE</Badge>}
                  </div>
                </TableCell>
                <TableCell>{r.ctrDisplay}</TableCell>
                <TableCell>{r.is_externo ? (r.polo ?? "—") : "—"}</TableCell>
                <TableCell>{new Date(r.data_prova + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{r.hora_prova?.slice(0, 5) ?? "—"}</TableCell>
                <TableCell>{sitFinBadge(r.situacao_financeira)}</TableCell>
                {tab === "agendada" && (
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant={r.docs_solicitados ? "default" : "outline"}
                        onClick={() => toggleFlag.mutate({ id: r.id, field: "docs_solicitados", value: !r.docs_solicitados })}>
                        {r.docs_solicitados && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        Solicitados
                      </Button>
                      <Button size="sm" variant={r.docs_recebidos ? "default" : "outline"}
                        onClick={() => toggleFlag.mutate({ id: r.id, field: "docs_recebidos", value: !r.docs_recebidos })}>
                        {r.docs_recebidos && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        Recebidos
                      </Button>
                    </div>
                  </TableCell>
                )}
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Provas Agendadas" description="Acompanhe as provas agendadas dos alunos" />

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Data início</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <Label>Data fim</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
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

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="agendada">🟡 Agendadas ({counts.agendada})</TabsTrigger>
          <TabsTrigger value="aprovado">🟢 Aprovados ({counts.aprovado})</TabsTrigger>
          <TabsTrigger value="reprovado">🔴 Reprovados ({counts.reprovado})</TabsTrigger>
        </TabsList>
        <TabsContent value="agendada">
          <Card><CardContent className="pt-6 overflow-x-auto">{renderTable()}</CardContent></Card>
        </TabsContent>
        <TabsContent value="aprovado">
          <Card><CardContent className="pt-6 overflow-x-auto">{renderTable()}</CardContent></Card>
        </TabsContent>
        <TabsContent value="reprovado">
          <Card><CardContent className="pt-6 overflow-x-auto">{renderTable()}</CardContent></Card>
        </TabsContent>
      </Tabs>

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
                <Label>Status da Prova</Label>
                <Select value={editing.status || "agendada"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agendada">🟡 Agendada</SelectItem>
                    <SelectItem value="aprovado">🟢 Aprovado</SelectItem>
                    <SelectItem value="reprovado">🔴 Reprovado</SelectItem>
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
