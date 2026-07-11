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
import { CheckCircle2, Loader2, Pencil, UserPlus, Copy, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { MateriasSelector, MATERIAS_PADRAO } from "@/components/prova/MateriasSelector";

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
  const [externoResult, setExternoResult] = useState<{ ctr: string; senha: string; data: string; hora: string; whatsSent: boolean } | null>(null);
  const [gerarCtrFor, setGerarCtrFor] = useState<any | null>(null);
  const [detalhesFor, setDetalhesFor] = useState<any | null>(null);
  const [reagendarFor, setReagendarFor] = useState<any | null>(null);
  const [extNome, setExtNome] = useState("");
  const [extTelefone, setExtTelefone] = useState("");
  const [extPoloId, setExtPoloId] = useState("");
  const [extData, setExtData] = useState("");
  const [extHora, setExtHora] = useState("");
  const [extSitFin, setExtSitFin] = useState<"ja_pago" | "boleto">("ja_pago");
  const [extMaterias, setExtMaterias] = useState<string[]>([...MATERIAS_PADRAO]);

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

  const enviarWhatsProvaAgendada = async (
    telefone: string,
    nome: string,
    ctr: string,
    senha: string,
    dataProva: string, // dd/mm/yyyy
    horaProva: string, // HH:MM
  ) => {
    let tel = (telefone || "").replace(/\D/g, "");
    if (!tel) return false;
    if (!tel.startsWith("55")) tel = "55" + tel;
    const primeiro = (nome || "").trim().split(/\s+/)[0] || "";
    const mensagem = `Olá ${primeiro}! 👋

Sua *prova online* está agendada! 📝

📅 *Data:* ${dataProva}
🕐 *Horário:* ${horaProva}
🔑 *CTR:* ${ctr}
🔒 *Senha:* ${senha}

Para acessar, entre no link abaixo no dia da prova:
👉 https://sistemasolucoesonline.lovable.app/aluno/login

⚠️ *Importante:*
- O acesso é liberado *somente no dia* da prova
- Se não conseguir acessar, entre em contato para reagendar

Boa prova! 🍀`;
    try {
      await fetch(
        "https://api.z-api.io/instances/3F4CC1DC22AB31BDE17ECE717FF40C71/token/E55BC981D8AA6846EAFEAEE4/send-text",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": "F2ffd89a74df2440aad10b65315696d0eS",
          },
          body: JSON.stringify({ phone: tel, message: mensagem }),
        },
      );
      return true;
    } catch (error) {
      console.error("Erro ao enviar WhatsApp:", error);
      return false;
    }
  };

  const formatarDataBR = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  const criarExterno = useMutation({
    mutationFn: async () => {
      if (!extNome.trim() || !extTelefone.trim() || !extPoloId || !extData || !extHora) {
        throw new Error("Preencha todos os campos");
      }
      if (extMaterias.length === 0) {
        throw new Error("Selecione pelo menos uma matéria");
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
        p_materias: extMaterias,
      } as any);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const r = row as { aluno_externo_id: string; ctr: string; senha: string };
      const whatsSent = await enviarWhatsProvaAgendada(
        extTelefone,
        extNome,
        r.ctr,
        r.senha,
        formatarDataBR(extData),
        extHora.slice(0, 5),
      );
      return { ...r, whatsSent, dataUsed: extData, horaUsed: extHora };
    },
    onSuccess: (row) => {
      setExternoResult({ ctr: row.ctr, senha: row.senha, data: row.dataUsed, hora: row.horaUsed, whatsSent: row.whatsSent });
      setExternoOpen(false);
      setExtNome(""); setExtTelefone(""); setExtData(""); setExtHora(""); setExtSitFin("ja_pago");
      setExtMaterias([...MATERIAS_PADRAO]);
      qc.invalidateQueries({ queryKey: ["provas-agendadas-list"] });
    },
    onError: (e: any) => toast.error("Erro ao cadastrar externo", { description: e.message }),
  });

  const gerarCtr = useMutation({
    mutationFn: async (ag: any) => {
      const { data, error } = await supabase.rpc("gerar_ctr_externo_existente", {
        p_agendamento_id: ag.id,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const r = row as { ctr: string; senha: string };
      const hora = (ag.hora_prova ?? "00:00").slice(0, 5);
      const whatsSent = await enviarWhatsProvaAgendada(
        ag.telefone ?? ag.telefoneDisplay ?? "",
        ag.nome_aluno ?? ag.nome ?? "",
        r.ctr,
        r.senha,
        formatarDataBR(ag.data_prova),
        hora,
      );
      return { ...r, ag, whatsSent };
    },
    onSuccess: ({ ctr, senha, ag, whatsSent }) => {
      setGerarCtrFor(null);
      setExternoResult({ ctr, senha, data: ag.data_prova, hora: ag.hora_prova ?? "00:00", whatsSent });
      qc.invalidateQueries({ queryKey: ["provas-agendadas-list"] });
    },
    onError: (e: any) => toast.error("Erro ao gerar CTR", { description: e.message }),
  });



  const { data: rows, isLoading } = useQuery({
    queryKey: ["provas-agendadas-list", dataInicio, dataFim],
    refetchInterval: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("prova_agendamentos")
        .select(`
          id, aluno_id, data_prova, hora_prova, status, docs_solicitados, docs_recebidos,
          is_externo, nome_aluno, telefone, polo, ctr, ultimo_heartbeat,
          situacao_financeira, resultado, observacao, materias_selecionadas
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
      } else if (tab === "agendada") {
        if (st !== "agendada" && st !== "iniciado") return false;
        if (st === "agendada" && r.data_prova && r.data_prova < HOJE) return false;
      } else {
        if (st !== tab) return false;
      }
      if (tipoFilter !== "todos") {
        if (tipoFilter === "externo" && !r.is_externo) return false;
        if (tipoFilter === "sistema" && r.is_externo) return false;
      }
      if (sitFinFilter !== "todos" && r.sitFinComputed !== sitFinFilter) return false;
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
    const c = { agendada: 0, aprovado: 0, reprovado: 0, reagendar: 0 } as Record<TabKey, number>;
    (rows ?? []).forEach((r: any) => {
      const st = (r.status ?? "agendada") as string;
      if (st === "agendada" && r.data_prova && r.data_prova < HOJE) {
        c.reagendar++;
      } else if (st === "agendada" || st === "iniciado") {
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
            
            {tab === "reagendar" && <TableHead>Observação</TableHead>}
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r: any) => {
            const isHoje = tab === "agendada" && r.data_prova === HOJE;
            const isOnline = r.ultimo_heartbeat &&
              (Date.now() - new Date(r.ultimo_heartbeat).getTime()) < 120_000;
            return (
              <TableRow key={r.id} className={isHoje ? "bg-yellow-50 dark:bg-yellow-950/30" : ""}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{r.nome}</span>
                    {r.is_externo && (
                      <Badge className="text-[10px] text-white" style={{ backgroundColor: '#1E3A5F' }}>🔷 Externo</Badge>
                    )}
                    
                    {r.status === "iniciado" && isOnline && (
                      <Badge className="bg-green-600 text-white">🟢 Em Prova</Badge>
                    )}
                    {r.status === "iniciado" && !isOnline && (
                      <Badge className="bg-yellow-500 text-white">🟡 Iniciou</Badge>
                    )}
                    {r.is_externo && !r.ctr && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => setGerarCtrFor(r)}
                      >
                        Gerar CTR
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>{r.telefoneDisplay}</TableCell>
                <TableCell>{r.ctrDisplay}</TableCell>

                <TableCell>{r.poloDisplay}</TableCell>
                <TableCell>{new Date(r.data_prova + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{r.hora_prova?.slice(0, 5) ?? "—"}</TableCell>
                <TableCell>{sitFinBadge(r.sitFinComputed)}</TableCell>
                
                {tab === "reagendar" && (
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {r.observacao ?? "—"}
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setDetalhesFor(r)} title="Ver detalhes">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {tab === "reprovado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs"
                        onClick={() => setReagendarFor(r)}
                        title="Reagendar reprovadas"
                      >
                        🔄 Reagendar
                      </Button>
                    )}
                  </div>
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader title="Provas Agendadas" description="Acompanhe as provas agendadas dos alunos" />
        <Button onClick={() => setExternoOpen(true)} className="bg-primary">
          <UserPlus className="h-4 w-4 mr-2" /> Agendar Externo
        </Button>
      </div>


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

      {/* Dialog: Agendar Externo */}
      <Dialog open={externoOpen} onOpenChange={setExternoOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agendar Aluno Externo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome completo *</Label>
              <Input value={extNome} onChange={(e) => setExtNome(e.target.value)} />
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input value={extTelefone} onChange={(e) => setExtTelefone(e.target.value)} placeholder="(48) 99999-9999" />
            </div>
            <div>
              <Label>Polo *</Label>
              <Select value={extPoloId} onValueChange={setExtPoloId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {(polos ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data da prova *</Label>
                <Input type="date" value={extData} onChange={(e) => setExtData(e.target.value)} />
              </div>
              <div>
                <Label>Horário *</Label>
                <Input type="time" value={extHora} onChange={(e) => setExtHora(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Situação financeira *</Label>
              <Select value={extSitFin} onValueChange={(v) => setExtSitFin(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ja_pago">Já pago</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <MateriasSelector value={extMaterias} onChange={setExtMaterias} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExternoOpen(false)}>Cancelar</Button>
            <Button onClick={() => criarExterno.mutate()} disabled={criarExterno.isPending}>
              {criarExterno.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmação com CTR + senha */}
      <Dialog open={!!externoResult} onOpenChange={(o) => !o && setExternoResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" /> Aluno externo cadastrado!
            </DialogTitle>
          </DialogHeader>
          {externoResult && (
            <div className="space-y-3 py-2">
              <div className="rounded-lg border p-4 bg-muted/30 space-y-2 text-sm">
                <div><b>CTR:</b> <span className="font-mono">{externoResult.ctr}</span></div>
                <div><b>Senha:</b> <span className="font-mono">{externoResult.senha}</span></div>
                <div><b>Data:</b> {new Date(externoResult.data + "T00:00:00").toLocaleDateString("pt-BR")} às {externoResult.hora.slice(0,5)}</div>
                <div className={externoResult.whatsSent ? "text-green-600 font-medium" : "text-yellow-600 font-medium"}>
                  {externoResult.whatsSent ? "✅ WhatsApp enviado" : "⚠️ WhatsApp não enviado"}
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const txt = `CTR: ${externoResult.ctr} | Senha: ${externoResult.senha} | Prova: ${new Date(externoResult.data + "T00:00:00").toLocaleDateString("pt-BR")} às ${externoResult.hora.slice(0,5)}`;
                  navigator.clipboard.writeText(txt);
                  toast.success("Dados copiados!");
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> Copiar dados
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setExternoResult(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog: Confirmação Gerar CTR */}
      <Dialog open={!!gerarCtrFor} onOpenChange={(o) => !o && setGerarCtrFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Gerar acesso externo</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm">
            Gerar acesso para <b>{gerarCtrFor?.nome}</b>?
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGerarCtrFor(null)}>Cancelar</Button>
            <Button onClick={() => gerarCtr.mutate(gerarCtrFor)} disabled={gerarCtr.isPending}>
              {gerarCtr.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReagendarReprovadasDialog
        agendamento={reagendarFor}
        onClose={() => setReagendarFor(null)}
        onDone={() => {
          setReagendarFor(null);
          qc.invalidateQueries({ queryKey: ["provas-agendadas-list"] });
        }}
      />

      <DetalhesAgendamentoDialog agendamento={detalhesFor} onClose={() => setDetalhesFor(null)} />
    </div>
  );
}

function DetalhesAgendamentoDialog({ agendamento, onClose }: { agendamento: any | null; onClose: () => void }) {
  const { data: resultados, isLoading } = useQuery({
    queryKey: ["prova-resultados-detalhes", agendamento?.id],
    enabled: !!agendamento?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prova_resultados")
        .select("materia, total_acertos, total_questoes, percentual, aprovado, finalizado_em, iniciado_em")
        .eq("agendamento_id", agendamento.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const materias: string[] = (agendamento?.materias_selecionadas && agendamento.materias_selecionadas.length > 0)
    ? agendamento.materias_selecionadas
    : MATERIAS_PADRAO;

  const resPorMateria = new Map<string, any>();
  (resultados ?? []).forEach((r: any) => resPorMateria.set(r.materia, r));

  return (
    <Dialog open={!!agendamento} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Agendamento</DialogTitle>
        </DialogHeader>
        {agendamento && (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/20 grid grid-cols-2 gap-2 text-sm">
              <div><b>Nome:</b> {agendamento.nome}</div>
              <div><b>CTR:</b> {agendamento.ctrDisplay ?? "—"}</div>
              <div><b>Telefone:</b> {agendamento.telefoneDisplay ?? "—"}</div>
              <div><b>Polo:</b> {agendamento.poloDisplay ?? "—"}</div>
              <div><b>Data:</b> {agendamento.data_prova ? new Date(agendamento.data_prova + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</div>
              <div><b>Horário:</b> {agendamento.hora_prova?.slice(0, 5) ?? "—"}</div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">Resultados por matéria</div>
              {isLoading ? (
                <div className="py-4 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {materias.map((m) => {
                    const r = resPorMateria.get(m);
                    let statusLabel = "Pendente";
                    let cls = "bg-gray-50 border-gray-200 text-gray-600";
                    if (r) {
                      if (r.finalizado_em) {
                        statusLabel = r.aprovado ? "✅ Aprovado" : "❌ Reprovado";
                        cls = r.aprovado
                          ? "bg-green-50 border-green-200 text-green-700"
                          : "bg-red-50 border-red-200 text-red-700";
                      } else {
                        statusLabel = "Em andamento";
                        cls = "bg-amber-50 border-amber-200 text-amber-700";
                      }
                    }
                    return (
                      <div key={m} className={`rounded-md border p-2 text-xs ${cls}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">{m}</span>
                          <span>{statusLabel}</span>
                        </div>
                        {r?.finalizado_em && (
                          <div className="mt-1 text-[11px] opacity-80">
                            {r.total_acertos}/{r.total_questoes} acertos ({Number(r.percentual ?? 0).toFixed(1)}%)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReagendarReprovadasDialog({
  agendamento,
  onClose,
  onDone,
}: {
  agendamento: any | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [novaData, setNovaData] = useState("");
  const [novoHora, setNovoHora] = useState("14:00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agendamento) {
      setNovaData(amanha);
      setNovoHora("14:00");
    }
  }, [agendamento?.id]);

  const { data: reprovadas } = useQuery({
    queryKey: ["reprovadas-materias", agendamento?.id],
    enabled: !!agendamento?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prova_resultados")
        .select("materia")
        .eq("agendamento_id", agendamento.id)
        .eq("aprovado", false)
        .not("finalizado_em", "is", null);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.materia as string);
    },
  });

  const handleConfirm = async () => {
    if (!agendamento || !novaData || !novoHora) {
      toast.error("Preencha data e horário");
      return;
    }
    if (novaData <= new Date().toISOString().slice(0, 10)) {
      toast.error("A data deve ser a partir de amanhã");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("reagendar_materias_reprovadas", {
        p_agendamento_id: agendamento.id,
        p_data_prova: novaData,
        p_hora_prova: novoHora,
      });
      if (error) throw error;

      // WhatsApp
      try {
        const ctr = agendamento.ctrDisplay ?? agendamento.ctr ?? "";
        let senha = "";
        if (ctr) {
          const { data: ext } = await supabase
            .from("alunos_externos")
            .select("senha")
            .eq("ctr", ctr)
            .maybeSingle();
          senha = (ext as any)?.senha ?? "";
        }
        let tel = (agendamento.telefoneDisplay || agendamento.telefone || "").replace(/\D/g, "");
        if (tel) {
          if (!tel.startsWith("55")) tel = "55" + tel;
          const primeiro = (agendamento.nome || "").trim().split(/\s+/)[0] || "";
          const [y, m, d] = novaData.split("-");
          const dataBR = `${d}/${m}/${y}`;
          const listaMat = (reprovadas ?? []).join(", ");
          const mensagem = `Olá ${primeiro}! 👋

Sua *prova de recuperação* está agendada! 📝

📅 *Data:* ${dataBR}
🕐 *Horário:* ${novoHora}
📚 *Matérias:* ${listaMat}
🔑 *CTR:* ${ctr}
🔒 *Senha:* ${senha}

Acesse no dia da prova:
👉 https://sistemasolucoesonline.lovable.app/aluno/login

Boa prova! 🍀`;
          await fetch(
            "https://api.z-api.io/instances/3F4CC1DC22AB31BDE17ECE717FF40C71/token/E55BC981D8AA6846EAFEAEE4/send-text",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Client-Token": "F2ffd89a74df2440aad10b65315696d0eS",
              },
              body: JSON.stringify({ phone: tel, message: mensagem }),
            },
          );
        }
      } catch (e) {
        console.error("WhatsApp reagendamento erro:", e);
      }

      const [y, m, d] = novaData.split("-");
      toast.success(`✅ Prova reagendada! ${(reprovadas ?? []).join(", ")} liberadas para ${d}/${m}/${y}`);
      onDone();
    } catch (e: any) {
      toast.error("Erro ao reagendar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!agendamento} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reagendar matérias reprovadas — {agendamento?.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-semibold">Matérias reprovadas</Label>
            {reprovadas === undefined ? (
              <div className="text-xs text-muted-foreground py-2">Carregando…</div>
            ) : reprovadas.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">Nenhuma matéria reprovada encontrada.</div>
            ) : (
              <div className="flex flex-wrap gap-1 mt-1">
                {reprovadas.map((m) => (
                  <Badge key={m} className="bg-red-500 text-white">{m}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nova data</Label>
              <Input type="date" min={amanha} value={novaData} onChange={(e) => setNovaData(e.target.value)} />
            </div>
            <div>
              <Label>Novo horário</Label>
              <Input type="time" value={novoHora} onChange={(e) => setNovoHora(e.target.value)} />
            </div>
          </div>
          <div className="rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-xs p-2">
            ℹ️ As matérias aprovadas serão mantidas. O aluno refará apenas as reprovadas.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !reprovadas || reprovadas.length === 0}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmar reagendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
