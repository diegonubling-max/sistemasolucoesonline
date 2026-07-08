import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo, useEffect } from "react";
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
import { CheckCircle2, Loader2, Pencil, UserPlus, Copy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_admin/provas-agendadas")({
  head: () => ({
    meta: [{ title: "Provas Agendadas | Soluções Online" }],
  }),
  component: ProvasAgendadasPage,
});

type SitFinFilter = "todos" | "ja_pago" | "boleto";
type TipoFilter = "todos" | "sistema" | "externo";
type TabKey = "agendada" | "aprovado" | "reprovado" | "reagendar";

const HOJE = new Date().toISOString().slice(0, 10);

function ProvasAgendadasPage() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const [tab, setTab] = useState<TabKey>("agendada");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [sitFinFilter, setSitFinFilter] = useState<SitFinFilter>("todos");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("todos");
  const [editing, setEditing] = useState<any | null>(null);
  const [externoOpen, setExternoOpen] = useState(false);
  const [externoResult, setExternoResult] = useState<{ ctr: string; senha: string; data: string; hora: string } | null>(null);
  const [extNome, setExtNome] = useState("");
  const [extTelefone, setExtTelefone] = useState("");
  const [extPoloId, setExtPoloId] = useState("");
  const [extData, setExtData] = useState("");
  const [extHora, setExtHora] = useState("");
  const [extSitFin, setExtSitFin] = useState<"ja_pago" | "boleto">("ja_pago");

  const { data: polos } = useQuery({
    queryKey: ["polos-externo-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("polos").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Default polo = Florianópolis
  useEffect(() => {
    if (!extPoloId && polos && polos.length > 0) {
      const flori = polos.find((p: any) => (p.nome ?? "").toLowerCase().includes("florian"));
      setExtPoloId(flori?.id ?? polos[0].id);
    }
  }, [polos, extPoloId]);

  const criarExterno = useMutation({
    mutationFn: async () => {
      if (!extNome.trim() || !extTelefone.trim() || !extPoloId || !extData || !extHora) {
        throw new Error("Preencha todos os campos");
      }
      let quemAgendou = session?.user.email ?? "sistema";
      if (session?.user.id) {
        const { data: colab } = await supabase
          .from("colaboradores").select("nome").eq("user_id", session.user.id).maybeSingle();
        if (colab?.nome) quemAgendou = colab.nome;
      }
      const { data, error } = await supabase.rpc("criar_aluno_externo_com_prova", {
        p_nome: extNome.trim(),
        p_telefone: extTelefone.trim(),
        p_polo_id: extPoloId,
        p_data_prova: extData,
        p_hora_prova: extHora,
        p_situacao_financeira: extSitFin,
        p_quem_agendou: quemAgendou,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { aluno_externo_id: string; ctr: string; senha: string };
    },
    onSuccess: (row) => {
      setExternoResult({ ctr: row.ctr, senha: row.senha, data: extData, hora: extHora });
      setExternoOpen(false);
      setExtNome(""); setExtTelefone(""); setExtData(""); setExtHora(""); setExtSitFin("ja_pago");
      qc.invalidateQueries({ queryKey: ["provas-agendadas-list"] });
    },
    onError: (e: any) => toast.error("Erro ao cadastrar externo", { description: e.message }),
  });



  const { data: rows, isLoading } = useQuery({
    queryKey: ["provas-agendadas-list", dataInicio, dataFim],
    queryFn: async () => {
      let q = supabase
        .from("prova_agendamentos")
        .select(`
          id, aluno_id, data_prova, hora_prova, status, docs_solicitados, docs_recebidos,
          is_externo, nome_aluno, telefone, polo, ctr,
          situacao_financeira, resultado, observacao
        `)
        .order("data_prova", { ascending: true });
      if (dataInicio) q = q.gte("data_prova", dataInicio);
      if (dataFim) q = q.lte("data_prova", dataFim);
      const { data, error } = await q;
      if (error) throw error;
      const agendamentos = (data ?? []) as any[];

      const alunoIds = Array.from(
        new Set(agendamentos.filter((a) => !a.is_externo && a.aluno_id).map((a) => a.aluno_id))
      );
      const alunosMap = new Map<string, any>();
      const poloMap = new Map<string, string>();
      const sitFinAlunoMap = new Map<string, "ja_pago" | "aberto" | "atraso" | null>();
      const notaAlunoMap = new Map<string, number | null>();

      if (alunoIds.length > 0) {
        const { data: alunosData, error: alunosErr } = await supabase
          .from("alunos")
          .select("id, nome, ctr, telefone, polo_id")
          .in("id", alunoIds);
        if (alunosErr) throw alunosErr;
        (alunosData ?? []).forEach((a: any) => alunosMap.set(a.id, a));

        const poloIds = Array.from(
          new Set((alunosData ?? []).map((a: any) => a.polo_id).filter(Boolean))
        );
        if (poloIds.length > 0) {
          const { data: polosData } = await supabase
            .from("polos").select("id, nome").in("id", poloIds);
          (polosData ?? []).forEach((p: any) => poloMap.set(p.id, p.nome));
        }

        const { data: matriculasData } = await supabase
          .from("matriculas").select("id, aluno_id").in("aluno_id", alunoIds);
        const matToAluno = new Map<string, string>();
        (matriculasData ?? []).forEach((m: any) => matToAluno.set(m.id, m.aluno_id));
        const matIds = Array.from(matToAluno.keys());

        if (matIds.length > 0) {
          const { data: parcelasData } = await supabase
            .from("parcelas")
            .select("matricula_id, status, data_vencimento, tipo")
            .in("matricula_id", matIds)
            .eq("tipo", "parcela");
          const agg = new Map<string, { total: number; abertas: number; atraso: number; pagas: number }>();
          (parcelasData ?? []).forEach((p: any) => {
            const alunoId = matToAluno.get(p.matricula_id);
            if (!alunoId) return;
            const a = agg.get(alunoId) ?? { total: 0, abertas: 0, atraso: 0, pagas: 0 };
            a.total++;
            if (p.status === "pago") a.pagas++;
            else if (p.status === "aberto" || p.status === "parcial") {
              a.abertas++;
              if (p.status === "aberto" && p.data_vencimento && p.data_vencimento < HOJE) a.atraso++;
            }
            agg.set(alunoId, a);
          });
          agg.forEach((v, alunoId) => {
            if (v.total === 0) sitFinAlunoMap.set(alunoId, null);
            else if (v.atraso > 0) sitFinAlunoMap.set(alunoId, "atraso");
            else if (v.abertas > 0) sitFinAlunoMap.set(alunoId, "aberto");
            else sitFinAlunoMap.set(alunoId, "ja_pago");
          });
        }

        const { data: resultadosData } = await supabase
          .from("prova_resultados")
          .select("aluno_id, percentual, finalizado_em")
          .in("aluno_id", alunoIds)
          .order("finalizado_em", { ascending: false });
        (resultadosData ?? []).forEach((r: any) => {
          if (!notaAlunoMap.has(r.aluno_id)) notaAlunoMap.set(r.aluno_id, r.percentual);
        });
      }

      return agendamentos.map((a) => {
        const aluno = a.aluno_id ? alunosMap.get(a.aluno_id) : null;
        const nome = a.is_externo ? (a.nome_aluno ?? "—") : (aluno?.nome ?? "—");
        const ctr = a.is_externo ? (a.ctr ?? "—") : (aluno?.ctr ?? "—");
        const telefone = a.is_externo ? (a.telefone ?? "—") : (aluno?.telefone ?? "—");
        const poloDisplay = a.is_externo
          ? (a.polo ?? "—")
          : (aluno?.polo_id ? (poloMap.get(aluno.polo_id) ?? "—") : "—");
        const sitFinComputed = a.is_externo
          ? (a.situacao_financeira ?? null)
          : (a.aluno_id ? (sitFinAlunoMap.get(a.aluno_id) ?? null) : null);
        const nota = a.is_externo ? null : (a.aluno_id ? (notaAlunoMap.get(a.aluno_id) ?? null) : null);
        return {
          ...a,
          aluno,
          nome,
          ctrDisplay: ctr,
          telefoneDisplay: telefone,
          poloDisplay,
          sitFinComputed,
          notaDisplay: nota,
        };
      });
    },
  });


  const filtered = useMemo(() => {
    const base = (rows ?? []).filter((r: any) => {
      const st = (r.status ?? "agendada") as string;
      if (tab === "reagendar") {
        if (st !== "agendada") return false;
        if (!r.data_prova || r.data_prova >= HOJE) return false;
      } else {
        if (st !== tab) return false;
        if (tab === "agendada" && r.data_prova && r.data_prova < HOJE) return false;
      }
      if (tipoFilter !== "todos") {
        if (tipoFilter === "externo" && !r.is_externo) return false;
        if (tipoFilter === "sistema" && r.is_externo) return false;
      }
      if (sitFinFilter !== "todos" && r.sitFinComputed !== sitFinFilter) return false;
      return true;
    });
    if (tab === "agendada" || tab === "reagendar") {
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
    const c = { agendada: 0, aprovado: 0, reprovado: 0, reagendar: 0 } as Record<TabKey, number>;
    (rows ?? []).forEach((r: any) => {
      const st = (r.status ?? "agendada") as string;
      if (st === "agendada" && r.data_prova && r.data_prova < HOJE) {
        c.reagendar++;
      } else if (st === "agendada") {
        c.agendada++;
      } else if (st === "aprovado" || st === "reprovado") {
        c[st as TabKey]++;
      }
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
        data_prova: v.data_prova || null,
        hora_prova: v.hora_prova || null,
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
    if (v === "boleto" || v === "aberto") return <Badge className="bg-yellow-500">Boleto/Aberto</Badge>;
    if (v === "atraso") return <Badge className="bg-red-500">Em atraso</Badge>;
    return <span className="text-muted-foreground">—</span>;
  };

  const openEdit = (r: any) => setEditing({
    id: r.id,
    is_externo: !!r.is_externo,
    nome_aluno: r.nome_aluno ?? "",
    telefone: r.telefone ?? "",
    polo: r.polo ?? "",
    data_prova: r.data_prova ?? "",
    hora_prova: r.hora_prova ? r.hora_prova.slice(0, 5) : "",
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
            <TableHead>Telefone</TableHead>
            <TableHead>CTR</TableHead>

            <TableHead>Polo</TableHead>
            <TableHead>Data da Prova</TableHead>
            <TableHead>Horário</TableHead>
            <TableHead>Sit. Financeira</TableHead>
            <TableHead>Nota</TableHead>
            {tab === "reagendar" && <TableHead>Observação</TableHead>}
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
                <TableCell>{r.telefoneDisplay}</TableCell>
                <TableCell>{r.ctrDisplay}</TableCell>

                <TableCell>{r.poloDisplay}</TableCell>
                <TableCell>{new Date(r.data_prova + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{r.hora_prova?.slice(0, 5) ?? "—"}</TableCell>
                <TableCell>{sitFinBadge(r.sitFinComputed)}</TableCell>
                <TableCell>{r.notaDisplay != null ? `${Number(r.notaDisplay).toFixed(1)}%` : "—"}</TableCell>
                {tab === "reagendar" && (
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {r.observacao ?? "—"}
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
          <TabsTrigger value="reagendar">🔄 Reagendar ({counts.reagendar})</TabsTrigger>
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
        <TabsContent value="reagendar">
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data da Prova</Label>
                  <Input type="date" value={editing.data_prova} onChange={(e) => setEditing({ ...editing, data_prova: e.target.value })} />
                </div>
                <div>
                  <Label>Horário</Label>
                  <Input type="time" value={editing.hora_prova} onChange={(e) => setEditing({ ...editing, hora_prova: e.target.value })} />
                </div>
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
