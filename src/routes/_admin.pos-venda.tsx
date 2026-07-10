import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckCircle2, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useVendedoras } from "@/hooks/use-vendedoras";

export const Route = createFileRoute("/_admin/pos-venda")({
  component: PosVendaPage,
});

const ETAPA_LABEL: Record<number, string> = { 1: "1º Pós-Venda", 2: "2º Pós-Venda", 3: "3º Pós-Venda" };

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function PosVendaPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [vendedora, setVendedora] = useState<string>("all");
  const [tab, setTab] = useState("ativos");
  const [obsModal, setObsModal] = useState<{ id: string; obs: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ id: string; etapa: number } | null>(null);
  const [revertModal, setRevertModal] = useState<{ id: string; etapa: number; matricula_id: string } | null>(null);

  const { data: vendedoras } = useVendedoras();

  const { data: meuColab } = useQuery({
    queryKey: ["meu-colaborador", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase
        .from("colaboradores")
        .select("id, nome")
        .eq("user_id", session.user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["pos-vendas", dataIni, dataFim, vendedora],
    queryFn: async () => {
      let q = supabase
        .from("pos_vendas")
        .select("id, etapa, data_agendada, data_confirmacao, observacao, status, matricula_id, aluno:alunos!inner(id, nome, ctr, telefone, vendedora, ativo), matricula:matriculas(id, created_at)")
        .eq("aluno.ativo", true)
        .order("data_agendada", { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      let list = (data ?? []) as any[];
      list = list.filter((r) => r.aluno && r.aluno.ativo !== false);
      if (dataIni) list = list.filter((r) => (r.matricula?.created_at ?? "") >= dataIni);
      if (dataFim) list = list.filter((r) => (r.matricula?.created_at ?? "").slice(0, 10) <= dataFim);
      if (vendedora !== "all") list = list.filter((r) => r.aluno?.vendedora === vendedora);
      return list;
    },
  });

  const hoje = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const list = rows ?? [];
    if (tab === "ativos") return list.filter((r) => r.status === "pendente" && r.data_agendada <= hoje);
    if (tab === "concluidos") return list.filter((r) => r.status === "concluido");
    if (tab === "arquivados") return list.filter((r) => r.status === "arquivado");
    return list;
  }, [rows, tab, hoje]);

  const stats = useMemo(() => {
    const ativos = (rows ?? []).filter((r) => r.status === "pendente" && r.data_agendada <= hoje);
    const totalMatriculas = new Set((rows ?? []).map((r) => r.matricula_id)).size;
    return {
      totalMatriculas,
      pv1: ativos.filter((r) => r.etapa === 1).length,
      pv2: ativos.filter((r) => r.etapa === 2).length,
      pv3: ativos.filter((r) => r.etapa === 3).length,
    };
  }, [rows, hoje]);

  const salvarObs = useMutation({
    mutationFn: async () => {
      if (!obsModal) return;
      const { error } = await supabase
        .from("pos_vendas")
        .update({ observacao: obsModal.obs })
        .eq("id", obsModal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Observação salva");
      qc.invalidateQueries({ queryKey: ["pos-vendas"] });
      setObsModal(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const confirmar = useMutation({
    mutationFn: async () => {
      if (!confirmModal) return;
      const novoStatus = confirmModal.etapa === 3 ? "arquivado" : "concluido";
      const { error } = await supabase
        .from("pos_vendas")
        .update({
          data_confirmacao: hoje,
          colaborador_id: meuColab?.id ?? null,
          status: novoStatus,
        })
        .eq("id", confirmModal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pós-venda confirmado");
      qc.invalidateQueries({ queryKey: ["pos-vendas"] });
      setConfirmModal(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const reverter = useMutation({
    mutationFn: async () => {
      if (!revertModal) return;
      // Deletar próximo PV gerado automaticamente (etapa + 1) da mesma matrícula
      if (revertModal.etapa < 3) {
        const { error: delErr } = await supabase
          .from("pos_vendas")
          .delete()
          .eq("matricula_id", revertModal.matricula_id)
          .eq("etapa", revertModal.etapa + 1);
        if (delErr) throw delErr;
      }
      const { error } = await supabase
        .from("pos_vendas")
        .update({ status: "pendente", data_confirmacao: null, colaborador_id: null })
        .eq("id", revertModal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pós-venda revertido");
      qc.invalidateQueries({ queryKey: ["pos-vendas"] });
      setRevertModal(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Pós-Venda" description="Acompanhamento de pós-vendas em 3 etapas" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Matrículas no período" value={stats.totalMatriculas} />
        <StatCard label="Ativos hoje — 1º PV" value={stats.pv1} accent="bg-blue-500/10 text-blue-600" />
        <StatCard label="Ativos hoje — 2º PV" value={stats.pv2} accent="bg-amber-500/10 text-amber-600" />
        <StatCard label="Ativos hoje — 3º PV" value={stats.pv3} accent="bg-purple-500/10 text-purple-600" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Matrícula de</Label>
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
          </div>
          <div>
            <Label>Matrícula até</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div>
            <Label>Vendedora</Label>
            <Select value={vendedora} onValueChange={setVendedora}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {vendedoras?.map((v) => <SelectItem key={v.id} value={v.nome}>{v.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="ativos">Ativos (hoje)</TabsTrigger>
          <TabsTrigger value="concluidos">Concluídos</TabsTrigger>
          <TabsTrigger value="arquivados">Arquivados</TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground"><Loader2 className="inline animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Agendado</TableHead>
                      <TableHead>Confirmado</TableHead>
                      <TableHead>Aluno</TableHead>
                      <TableHead>CTR</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Vendedora</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum pós-venda</TableCell></TableRow>
                    )}
                    {filtered.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell><Badge variant="outline">{ETAPA_LABEL[r.etapa]}</Badge></TableCell>
                        <TableCell>{fmtDate(r.data_agendada)}</TableCell>
                        <TableCell>{fmtDate(r.data_confirmacao)}</TableCell>
                        <TableCell className="font-medium">{r.aluno?.nome ?? "—"}</TableCell>
                        <TableCell>{r.aluno?.ctr ?? "—"}</TableCell>
                        <TableCell>{r.aluno?.telefone ?? "—"}</TableCell>
                        <TableCell>{r.aluno?.vendedora ?? "—"}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => setObsModal({ id: r.id, obs: r.observacao ?? "" })}>
                            <MessageSquare className="h-4 w-4 mr-1" /> Observações
                          </Button>
                          {r.status === "pendente" && (
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setConfirmModal({ id: r.id, etapa: r.etapa })}>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmar realizado
                            </Button>
                          )}
                          {r.status === "concluido" && (
                            <Button size="sm" variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-50" onClick={() => setRevertModal({ id: r.id, etapa: r.etapa, matricula_id: r.matricula_id })}>
                              <Undo2 className="h-4 w-4 mr-1" /> Reverter
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!obsModal} onOpenChange={(o) => !o && setObsModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Observações</DialogTitle>
            <DialogDescription>Registre o que o aluno respondeu neste contato.</DialogDescription>
          </DialogHeader>
          <Textarea rows={6} value={obsModal?.obs ?? ""} onChange={(e) => setObsModal((s) => s ? { ...s, obs: e.target.value } : s)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setObsModal(null)}>Cancelar</Button>
            <Button onClick={() => salvarObs.mutate()} disabled={salvarObs.isPending}>
              {salvarObs.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmModal} onOpenChange={(o) => !o && setConfirmModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pós-venda</DialogTitle>
            <DialogDescription>Confirmar que o {confirmModal ? ETAPA_LABEL[confirmModal.etapa] : ""} foi realizado?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModal(null)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => confirmar.mutate()} disabled={confirmar.isPending}>
              {confirmar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revertModal} onOpenChange={(o) => !o && setRevertModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverter pós-venda</DialogTitle>
            <DialogDescription>
              Deseja reverter este pós-venda para pendente? Esta ação irá desfazer a confirmação realizada
              {revertModal && revertModal.etapa < 3 ? " e remover o próximo pós-venda gerado automaticamente" : ""}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertModal(null)}>Cancelar</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => reverter.mutate()} disabled={reverter.isPending}>
              {reverter.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Reverter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-3xl font-bold mt-1 rounded px-2 inline-block ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
