import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus, Search, Pencil, Trash2, Loader2, Send, FileText,
  Building2, CheckCircle2, AlertCircle, Eye, Upload, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import declaracaoConclusaoTpl from "@/templates/declaracao-conclusao.html?raw";

export const Route = createFileRoute("/_admin/setor-provas")({
  component: SetorProvasPage,
});

const sb = supabase as any;

export function SetorProvasPage() {
  const { session } = useAuth();
  const [tab, setTab] = useState("documentacao");
  const [certOpen, setCertOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Setor de Provas"
        description="Documentação, envios para certificadoras e controle de certificados"
        actions={
          <Button variant="outline" onClick={() => setCertOpen(true)}>
            <Building2 className="h-4 w-4 mr-2" /> Certificadoras
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="documentacao">Documentação</TabsTrigger>
          <TabsTrigger value="envios">Envios para Certificadora</TabsTrigger>
          <TabsTrigger value="certificados">Certificados</TabsTrigger>
        </TabsList>

        <TabsContent value="documentacao"><DocumentacaoTab /></TabsContent>
        <TabsContent value="envios"><EnviosTab /></TabsContent>
        <TabsContent value="certificados"><CertificadosTab /></TabsContent>
      </Tabs>

      <CertificadorasModal open={certOpen} onOpenChange={setCertOpen} />
    </div>
  );
}

/* ============================== ABA 1: DOCUMENTAÇÃO ============================== */

function usePoloFilter() {
  const [selectedPoloId, setSelectedPoloId] = useState<string>(
    () => sessionStorage.getItem("selected_polo_id") || "all",
  );
  useEffect(() => {
    const h = () => setSelectedPoloId(sessionStorage.getItem("selected_polo_id") || "all");
    window.addEventListener("polo-changed", h);
    return () => window.removeEventListener("polo-changed", h);
  }, []);
  return selectedPoloId;
}

function DocumentacaoTab() {
  const qc = useQueryClient();
  const selectedPoloId = usePoloFilter();
  const [search, setSearch] = useState("");
  const [statusDoc, setStatusDoc] = useState<string>("all");
  const [loteFilter, setLoteFilter] = useState<string>("all");
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [encDocId, setEncDocId] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["sp-doc-rows", selectedPoloId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("documentacao_alunos")
        .select(`
          id, aluno_id, nome_aluno, polo, quem_vendeu, telefone, ctr,
          documentacao_completa, certificadora_id, lote, data_envio,
          declaracao_gerada, created_at,
          certificadoras(nome),
          alunos(id, ctr, polo_id, polos(nome))
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      let list = data ?? [];
      if (selectedPoloId !== "all") {
        list = list.filter((r: any) => r.alunos?.polo_id === selectedPoloId);
      }
      return list;
    },
  });

  const { data: lotes } = useQuery({
    queryKey: ["sp-lotes-filter-doc"],
    queryFn: async () => {
      const { data } = await sb
        .from("documentacao_alunos")
        .select("lote")
        .not("lote", "is", null);
      const unique = Array.from(new Set((data ?? []).map((r: any) => r.lote).filter(Boolean)));
      return unique.sort();
    },
  });

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = search.trim().toLowerCase();
    return rows.filter((r: any) => {
      if (s && !r.nome_aluno?.toLowerCase().includes(s) && !r.telefone?.includes(s)) return false;
      if (statusDoc === "completa" && !r.documentacao_completa) return false;
      if (statusDoc === "incompleta" && r.documentacao_completa) return false;
      if (loteFilter !== "all" && r.lote !== loteFilter) return false;
      return true;
    });
  }, [rows, search, statusDoc, loteFilter]);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("documentacao_alunos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido");
      qc.invalidateQueries({ queryKey: ["sp-doc-rows"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusDoc} onValueChange={setStatusDoc}>
          <SelectTrigger><SelectValue placeholder="Status documentação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="completa">Completa</SelectItem>
            <SelectItem value="incompleta">Incompleta</SelectItem>
          </SelectContent>
        </Select>
        <Select value={loteFilter} onValueChange={setLoteFilter}>
          <SelectTrigger><SelectValue placeholder="Lote" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os lotes</SelectItem>
            {((lotes ?? []) as string[]).map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setNovoOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Registro
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Polo</TableHead>
                <TableHead>Vendedora</TableHead>
                <TableHead>Documentação</TableHead>
                <TableHead>Certificadora</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Data Envio</TableHead>
                <TableHead>Declaração</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum aluno encontrado.</TableCell></TableRow>
              ) : filtered.map((r: any) => {
                const status = r.documentacao_completa ? "completa" : "incompleta";
                const ctrLabel = r.alunos?.ctr ?? r.ctr;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.nome_aluno}
                      {r.aluno_id && ctrLabel ? <span className="text-xs text-muted-foreground ml-2">CTR {ctrLabel}</span> : null}
                    </TableCell>
                    <TableCell>{r.alunos?.polos?.nome ?? r.polo ?? "-"}</TableCell>
                    <TableCell>{r.quem_vendeu ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={status === "completa" ? "default" : "secondary"}>
                        {status === "completa" ? "Completa" : "Incompleta"}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.certificadoras?.nome ?? "-"}</TableCell>
                    <TableCell>{r.lote ?? "-"}</TableCell>
                    <TableCell>{r.data_envio ? new Date(r.data_envio).toLocaleDateString("pt-BR") : "-"}</TableCell>
                    <TableCell>
                      {r.declaracao_gerada ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">Gerada</Badge>
                      ) : r.aluno_id ? (
                        <GerarDeclaracaoButton aluno={{ id: r.aluno_id, nome: r.nome_aluno, cpf: null, polo_id: r.alunos?.polo_id }} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setEncDocId(r.id)} title="Encaminhar para certificadora">
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditDocId(r.id)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm(`Remover ${r.nome_aluno} do setor de provas?`)) deleteMut.mutate(r.id);
                      }} title="Excluir">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editAlunoId && <EditarRegistroModal alunoId={editAlunoId} onClose={() => setEditAlunoId(null)} />}
      {encAlunoId && <EncaminharModal alunoId={encAlunoId} onClose={() => setEncAlunoId(null)} />}
      <NovoRegistroModal open={novoOpen} onClose={() => setNovoOpen(false)} />
    </div>
  );
}

/* ============================== GERAR DECLARAÇÃO ============================== */

function GerarDeclaracaoButton({ aluno }: { aluno: any }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: colab } = await sb.from("colaboradores").select("id").eq("user_id", user?.id).maybeSingle();
      const { data: polo } = await sb.from("polos").select("cidade").eq("id", aluno.polo_id).maybeSingle();

      await sb.from("declaracoes_matricula").insert({ aluno_id: aluno.id, gerado_por: colab?.id });

      const hoje = new Date();
      const cidade = polo?.cidade || "";
      const dataExtenso = `${hoje.getDate().toString().padStart(2, "0")} de ${hoje.toLocaleString("pt-BR", { month: "long" })} de ${hoje.getFullYear()}`;
      const html = declaracaoConclusaoTpl
        .replace(/\{\{NOME_ALUNO\}\}/g, aluno.nome ?? "")
        .replace(/\{\{CPF_ALUNO\}\}/g, aluno.cpf ?? "")
        .replace(/\{\{NIVEL\}\}/g, "Médio")
        .replace(/\{\{CIDADE\}\}/g, cidade)
        .replace(/\{\{DATA_EXTENSO\}\}/g, dataExtenso)
        .replace(/<\/body>/i, `<script>window.addEventListener('load',function(){setTimeout(()=>window.print(),600);});</script></body>`);
      const w = window.open("", "_blank");
      if (!w) throw new Error("Bloqueador de popup ativo");
      w.document.write(html);
      w.document.close();
    },
    onSuccess: () => {
      toast.success("Declaração gerada");
      qc.invalidateQueries({ queryKey: ["sp-doc-rows"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Button size="sm" variant="outline" onClick={() => mut.mutate()} disabled={mut.isPending}>
      <FileText className="h-3 w-3 mr-1" /> Gerar Declaração
    </Button>
  );
}

/* ============================== MODAL EDITAR REGISTRO ============================== */

const DOC_FIELDS = [
  { id: "rg_cpf", label: "RG e CPF" },
  { id: "historico_fundamental", label: "Histórico Ensino Fundamental" },
  { id: "historico_fund_medio", label: "Histórico Ensino Fund. e Médio" },
  { id: "comprovante_residencia", label: "Comprovante de Residência" },
];
const VALID_FIELDS = [
  { id: "rec_firma", label: "Rec. Firma" },
  { id: "d_oficial", label: "D. Oficial" },
  { id: "visto_confere", label: "Visto Confere" },
];

function EditarRegistroModal({ alunoId, onClose }: { alunoId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    rg_cpf: false, historico_fundamental: false, historico_fund_medio: false,
    comprovante_residencia: false, outros: false, outros_descricao: "",
    rec_firma: false, d_oficial: false, visto_confere: false,
  });

  const { data: aluno } = useQuery({
    queryKey: ["sp-aluno-edit", alunoId],
    queryFn: async () => {
      const { data } = await sb.from("alunos").select("id, nome, telefone, vendedora, polos(nome)").eq("id", alunoId).maybeSingle();
      return data;
    },
  });
  const { data: doc } = useQuery({
    queryKey: ["sp-aluno-doc", alunoId],
    queryFn: async () => {
      const { data } = await sb.from("aluno_documentos").select("*").eq("aluno_id", alunoId).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (doc) {
      setForm({
        rg_cpf: !!doc.rg_cpf, historico_fundamental: !!doc.historico_fundamental,
        historico_fund_medio: !!doc.historico_fund_medio,
        comprovante_residencia: !!doc.comprovante_residencia,
        outros: !!doc.outros, outros_descricao: doc.outros_descricao ?? "",
        rec_firma: !!doc.rec_firma, d_oficial: !!doc.d_oficial, visto_confere: !!doc.visto_confere,
      });
    }
  }, [doc]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (doc) {
        const { error } = await sb.from("aluno_documentos").update(form).eq("aluno_id", alunoId);
        if (error) throw error;
      } else {
        const { error } = await sb.from("aluno_documentos").insert({ aluno_id: alunoId, ...form });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Documentos atualizados");
      qc.invalidateQueries({ queryKey: ["sp-doc-rows"] });
      qc.invalidateQueries({ queryKey: ["sp-aluno-doc", alunoId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });


  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Registro — Setor de Provas</DialogTitle>
          <DialogDescription>Documentação, arquivos e validações do aluno</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div><Label>Nome do Aluno</Label><Input value={aluno?.nome ?? ""} readOnly /></div>
          <div><Label>Polo</Label><Input value={aluno?.polos?.nome ?? ""} readOnly /></div>
          <div><Label>Quem fez a venda</Label><Input value={aluno?.vendedora ?? ""} readOnly /></div>
          <div><Label>Telefone</Label><Input value={aluno?.telefone ?? ""} readOnly /></div>
        </div>

        <div className="space-y-3 border-t pt-4">
          <h4 className="font-semibold">Documentos Enviados</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DOC_FIELDS.map((f) => (
              <label key={f.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form[f.id]} onCheckedChange={(v) => setForm({ ...form, [f.id]: !!v })} />
                <span className="text-sm">{f.label}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.outros} onCheckedChange={(v) => setForm({ ...form, outros: !!v })} />
              <span className="text-sm">Outros</span>
            </label>
          </div>
          {form.outros && (
            <Textarea
              placeholder="Descreva os outros documentos..."
              value={form.outros_descricao}
              onChange={(e) => setForm({ ...form, outros_descricao: e.target.value })}
            />
          )}
        </div>




        <div className="space-y-3 border-t pt-4">
          <h4 className="font-semibold">Validações</h4>
          <div className="grid grid-cols-3 gap-3">
            {VALID_FIELDS.map((f) => (
              <label key={f.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form[f.id]} onCheckedChange={(v) => setForm({ ...form, [f.id]: !!v })} />
                <span className="text-sm">{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== MODAL ENCAMINHAR ============================== */

function EncaminharModal({ alunoId, onClose }: { alunoId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [certId, setCertId] = useState<string>("");
  const [dataEnvio, setDataEnvio] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loteId, setLoteId] = useState<string>("");
  const [novoLote, setNovoLote] = useState<string>("");

  const { data: certs } = useQuery({
    queryKey: ["sp-certs-active"],
    queryFn: async () => {
      const { data } = await sb.from("certificadoras").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });
  const { data: lotesDisponiveis } = useQuery({
    queryKey: ["sp-lotes-by-cert", certId],
    queryFn: async () => {
      if (!certId) return [];
      const { data } = await sb.from("lotes").select("id, mes_ano").eq("certificadora_id", certId).eq("enviado", false).order("mes_ano", { ascending: false });
      return data ?? [];
    },
    enabled: !!certId,
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!certId) throw new Error("Selecione uma certificadora");
      let usedLoteId = loteId;
      if (!usedLoteId) {
        if (!novoLote.match(/^\d{2}\/\d{4}$/)) throw new Error("Lote inválido (use MM/AAAA)");
        const { data, error } = await sb.from("lotes").insert({
          mes_ano: novoLote, certificadora_id: certId, data_envio: dataEnvio, enviado: false,
        }).select("id").single();
        if (error) throw error;
        usedLoteId = data.id;
      } else {
        await sb.from("lotes").update({ data_envio: dataEnvio }).eq("id", usedLoteId);
      }
      // Remove vínculos antigos (apenas em lotes não enviados)
      const { data: oldLinks } = await sb
        .from("lote_alunos")
        .select("id, lotes(enviado)")
        .eq("aluno_id", alunoId);
      const removeIds = (oldLinks ?? []).filter((l: any) => !l.lotes?.enviado).map((l: any) => l.id);
      if (removeIds.length) await sb.from("lote_alunos").delete().in("id", removeIds);

      const { error } = await sb.from("lote_alunos").insert({ lote_id: usedLoteId, aluno_id: alunoId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aluno encaminhado para certificadora");
      qc.invalidateQueries({ queryKey: ["sp-doc-rows"] });
      qc.invalidateQueries({ queryKey: ["sp-lotes"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encaminhar para Certificadora</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Certificadora</Label>
            <Select value={certId} onValueChange={setCertId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {certs?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data de Envio</Label>
            <Input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
          </div>
          <div>
            <Label>Lote existente</Label>
            <Select value={loteId} onValueChange={setLoteId} disabled={!certId}>
              <SelectTrigger><SelectValue placeholder="Selecione um lote pendente (ou crie novo abaixo)" /></SelectTrigger>
              <SelectContent>
                {lotesDisponiveis?.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.mes_ano}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!loteId && (
            <div>
              <Label>Ou criar novo lote (MM/AAAA)</Label>
              <Input placeholder="06/2026" value={novoLote} onChange={(e) => setNovoLote(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Encaminhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== MODAL NOVO REGISTRO ============================== */

function NovoRegistroModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [modo, setModo] = useState<"sistema" | "externo">("sistema");
  const [search, setSearch] = useState("");
  const [alunoSel, setAlunoSel] = useState<any>(null);

  // Manual fields (modo externo OU preenchido a partir do aluno selecionado)
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [polo, setPolo] = useState("");
  const [quemVendeu, setQuemVendeu] = useState("");
  const [ctr, setCtr] = useState("");

  // Documentos
  const [docRgCpf, setDocRgCpf] = useState(false);
  const [docComp, setDocComp] = useState(false);
  const [docHistF, setDocHistF] = useState(false);
  const [docHistFM, setDocHistFM] = useState(false);
  const [docOutros, setDocOutros] = useState(false);
  const [docOutrosDesc, setDocOutrosDesc] = useState("");

  // Controle
  const [docCompleta, setDocCompleta] = useState(false);
  const [recFirma, setRecFirma] = useState(false);
  const [dOficial, setDOficial] = useState(false);
  const [vistoConfere, setVistoConfere] = useState(false);

  // Envio
  const [certificadoraId, setCertificadoraId] = useState<string>("");
  const [lote, setLote] = useState("");
  const [dataEnvio, setDataEnvio] = useState("");
  const [observacao, setObservacao] = useState("");

  // Arquivos
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setModo("sistema"); setSearch(""); setAlunoSel(null);
    setNome(""); setTelefone(""); setPolo(""); setQuemVendeu(""); setCtr("");
    setDocRgCpf(false); setDocComp(false); setDocHistF(false); setDocHistFM(false);
    setDocOutros(false); setDocOutrosDesc("");
    setDocCompleta(false); setRecFirma(false); setDOficial(false); setVistoConfere(false);
    setCertificadoraId(""); setLote(""); setDataEnvio(""); setObservacao("");
    setArquivos([]);
  };

  const { data: alunos } = useQuery({
    queryKey: ["sp-search-alunos", search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const t = `%${search}%`;
      const ctrNum = parseInt(search, 10);
      const filterParts = [`nome.ilike.${t}`, `cpf.ilike.${t}`];
      if (!isNaN(ctrNum)) filterParts.push(`ctr.eq.${ctrNum}`);
      const { data } = await sb.from("alunos").select("id, nome, cpf, ctr, telefone, polo_id, vendedora, polos(nome)").or(filterParts.join(",")).limit(10);
      return data ?? [];
    },
    enabled: modo === "sistema" && search.length >= 2,
  });

  const { data: certificadoras } = useQuery({
    queryKey: ["sp-certificadoras-ativas"],
    queryFn: async () => {
      const { data } = await sb.from("certificadoras").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const selectAluno = (a: any) => {
    setAlunoSel(a);
    setNome(a.nome ?? "");
    setTelefone(a.telefone ?? "");
    setPolo(a.polos?.nome ?? "");
    setQuemVendeu(a.vendedora ?? "");
    setCtr(a.ctr ? String(a.ctr) : "");
  };

  const podeAvancar = modo === "sistema" ? !!alunoSel : (nome.trim().length > 0 && telefone.trim().length > 0);

  const mut = useMutation({
    mutationFn: async () => {
      if (!podeAvancar) throw new Error("Preencha os dados do aluno");
      const payload: any = {
        aluno_id: modo === "sistema" ? alunoSel?.id : null,
        nome_aluno: nome.trim(),
        telefone: telefone.trim() || null,
        polo: polo || null,
        quem_vendeu: quemVendeu || null,
        ctr: ctr || null,
        doc_rg_cpf: docRgCpf,
        doc_comprovante_residencia: docComp,
        doc_historico_fundamental: docHistF,
        doc_historico_fundamental_medio: docHistFM,
        doc_outros: docOutros,
        doc_outros_descricao: docOutros ? docOutrosDesc || null : null,
        documentacao_completa: docCompleta,
        necessita_reconhecimento_firma: recFirma,
        necessita_diario_oficial: dOficial,
        necessita_visto_confere: vistoConfere,
        certificadora_id: certificadoraId || null,
        lote: lote || null,
        data_envio: dataEnvio || null,
        observacao: observacao || null,
      };
      const { data: inserted, error } = await sb.from("documentacao_alunos").insert(payload).select("id").single();
      if (error) throw error;

      if (arquivos.length > 0 && inserted?.id) {
        const paths: string[] = [];
        for (const file of arquivos) {
          const safeName = file.name.replace(/[^\w.\-]+/g, "_");
          const path = `${inserted.id}/${Date.now()}_${safeName}`;
          const { error: upErr } = await supabase.storage.from("documentos-alunos").upload(path, file, { upsert: false });
          if (upErr) throw upErr;
          paths.push(path);
        }
        const { error: updErr } = await sb.from("documentacao_alunos").update({ arquivos_paths: paths }).eq("id", inserted.id);
        if (updErr) throw updErr;
      }
    },
    onSuccess: () => {
      toast.success("Registro criado");
      qc.invalidateQueries({ queryKey: ["sp-doc-rows"] });
      qc.invalidateQueries({ queryKey: ["documentacao-alunos"] });
      reset();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mostrarFormulario = podeAvancar;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Registro — Documentação</DialogTitle>
          <DialogDescription>Aluno do sistema ou cadastro manual</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toggle de modo */}
          <div className="flex gap-2">
            <Button type="button" variant={modo === "sistema" ? "default" : "outline"} size="sm" onClick={() => { setModo("sistema"); setAlunoSel(null); }}>
              Aluno do sistema
            </Button>
            <Button type="button" variant={modo === "externo" ? "default" : "outline"} size="sm" onClick={() => { setModo("externo"); setAlunoSel(null); setSearch(""); }}>
              Cadastrar manualmente
            </Button>
          </div>

          {/* Modo sistema */}
          {modo === "sistema" && (
            <div className="space-y-2">
              <Label>Buscar aluno (nome, CPF ou CTR)</Label>
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setAlunoSel(null); }} placeholder="Digite ao menos 2 caracteres" />
              {!alunoSel && alunos && alunos.length > 0 && (
                <div className="border rounded max-h-60 overflow-y-auto">
                  {alunos.map((a: any) => (
                    <button key={a.id} type="button" onClick={() => selectAluno(a)} className="w-full text-left p-2 hover:bg-muted text-sm border-b last:border-0">
                      <div className="font-medium">{a.nome}</div>
                      <div className="text-xs text-muted-foreground">CPF: {a.cpf ?? "-"} · CTR: {a.ctr ?? "-"} · {a.polos?.nome ?? "—"}</div>
                    </button>
                  ))}
                </div>
              )}
              {alunoSel && (
                <div className="border rounded p-3 bg-muted/30 space-y-1">
                  <div className="font-medium">{alunoSel.nome}</div>
                  <div className="text-xs">Polo: {polo || "—"} · Vendedora: {quemVendeu || "—"} · Tel: {telefone || "—"}</div>
                </div>
              )}
            </div>
          )}

          {/* Modo externo */}
          {modo === "externo" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome completo *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <Label>Telefone com DDD *</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(48) 99999-9999" />
              </div>
              <div>
                <Label>Polo</Label>
                <Select value={polo} onValueChange={setPolo}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Florianópolis">Florianópolis</SelectItem>
                    <SelectItem value="Matriz">Matriz</SelectItem>
                    <SelectItem value="Novo Hamburgo">Novo Hamburgo</SelectItem>
                    <SelectItem value="Porto Alegre">Porto Alegre</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quem fez a venda</Label>
                <Input value={quemVendeu} onChange={(e) => setQuemVendeu(e.target.value)} />
              </div>
              <div>
                <Label>CTR (opcional)</Label>
                <Input value={ctr} onChange={(e) => setCtr(e.target.value)} />
              </div>
            </div>
          )}

          {/* Formulário completo após seleção/preenchimento */}
          {mostrarFormulario && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <Label className="mb-2 block">Documentos recebidos</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="flex items-center gap-2"><Checkbox checked={docRgCpf} onCheckedChange={(v) => setDocRgCpf(!!v)} /> RG e CPF</label>
                  <label className="flex items-center gap-2"><Checkbox checked={docComp} onCheckedChange={(v) => setDocComp(!!v)} /> Comprovante de Residência</label>
                  <label className="flex items-center gap-2"><Checkbox checked={docHistF} onCheckedChange={(v) => setDocHistF(!!v)} /> Histórico Ensino Fundamental</label>
                  <label className="flex items-center gap-2"><Checkbox checked={docHistFM} onCheckedChange={(v) => setDocHistFM(!!v)} /> Histórico Ensino Fund. e Médio</label>
                  <label className="flex items-center gap-2 col-span-2"><Checkbox checked={docOutros} onCheckedChange={(v) => setDocOutros(!!v)} /> Outros</label>
                  {docOutros && (
                    <div className="col-span-2">
                      <Input value={docOutrosDesc} onChange={(e) => setDocOutrosDesc(e.target.value)} placeholder="Descrição de outros documentos" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Anexar arquivos (PDF, JPG, PNG)</Label>
                <label
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setDragOver(false);
                    const files = Array.from(e.dataTransfer.files).filter((f) =>
                      /\.(pdf|jpe?g|png)$/i.test(f.name)
                    );
                    setArquivos((prev) => [...prev, ...files]);
                  }}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${dragOver ? "border-primary bg-muted/50" : "border-muted-foreground/30 hover:bg-muted/30"}`}
                >
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">
                    Arraste arquivos aqui ou <span className="text-primary underline">clique para selecionar</span>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      setArquivos((prev) => [...prev, ...files]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {arquivos.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {arquivos.map((f, i) => (
                      <li key={i} className="flex items-center justify-between text-sm border rounded px-2 py-1">
                        <span className="truncate">{f.name}</span>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setArquivos((prev) => prev.filter((_, j) => j !== i))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>


              <div>
                <Label className="mb-2 block">Controle</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="flex items-center gap-2"><Checkbox checked={docCompleta} onCheckedChange={(v) => setDocCompleta(!!v)} /> Documentação Completa</label>
                  <label className="flex items-center gap-2"><Checkbox checked={recFirma} onCheckedChange={(v) => setRecFirma(!!v)} /> Rec. Firma</label>
                  <label className="flex items-center gap-2"><Checkbox checked={dOficial} onCheckedChange={(v) => setDOficial(!!v)} /> Diário Oficial</label>
                  <label className="flex items-center gap-2"><Checkbox checked={vistoConfere} onCheckedChange={(v) => setVistoConfere(!!v)} /> Visto Confere</label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Certificadora</Label>
                  <Select value={certificadoraId} onValueChange={setCertificadoraId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(certificadoras ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Lote</Label>
                  <Select value={lote} onValueChange={setLote}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {["01/2026","02/2026","03/2026","04/2026","05/2026","06/2026","07/2026","08/2026","09/2026","10/2026","11/2026","12/2026"].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Observação</Label>
                  <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!podeAvancar || mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* ============================== ABA 2: ENVIOS ============================== */

function EnviosTab() {
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [verLote, setVerLote] = useState<any>(null);

  const { data: lotes, isLoading } = useQuery({
    queryKey: ["sp-lotes"],
    queryFn: async () => {
      const { data } = await sb
        .from("lotes")
        .select("id, mes_ano, data_envio, enviado, certificadoras(nome), lote_alunos(id)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const marcarEnviado = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("lotes").update({ enviado: true, data_envio: new Date().toISOString().slice(0, 10) }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lote marcado como enviado");
      qc.invalidateQueries({ queryKey: ["sp-lotes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteLote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("lotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lote excluído");
      qc.invalidateQueries({ queryKey: ["sp-lotes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setNovoOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novo Lote</Button>
      </div>
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lote</TableHead>
                <TableHead>Certificadora</TableHead>
                <TableHead>Total Alunos</TableHead>
                <TableHead>Data Envio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : lotes?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum lote cadastrado.</TableCell></TableRow>
              ) : lotes?.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.mes_ano}</TableCell>
                  <TableCell>{l.certificadoras?.nome ?? "-"}</TableCell>
                  <TableCell>{l.lote_alunos?.length ?? 0}</TableCell>
                  <TableCell>{l.data_envio ? new Date(l.data_envio).toLocaleDateString("pt-BR") : "-"}</TableCell>
                  <TableCell>
                    <Badge variant={l.enviado ? "default" : "secondary"}>{l.enviado ? "Enviado" : "Pendente"}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => setVerLote(l)} title="Ver alunos">
                      <Eye className="h-4 w-4" />
                    </Button>
                    {!l.enviado && (
                      <Button size="sm" variant="ghost" onClick={() => marcarEnviado.mutate(l.id)} title="Marcar como enviado">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir lote?")) deleteLote.mutate(l.id); }} title="Excluir">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <NovoLoteModal open={novoOpen} onClose={() => setNovoOpen(false)} />
      {verLote && <AlunosLoteModal lote={verLote} onClose={() => setVerLote(null)} />}
    </div>
  );
}

function NovoLoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [mesAno, setMesAno] = useState("");
  const [certId, setCertId] = useState("");
  const { data: certs } = useQuery({
    queryKey: ["sp-certs-active"],
    queryFn: async () => {
      const { data } = await sb.from("certificadoras").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });
  const mut = useMutation({
    mutationFn: async () => {
      if (!mesAno.match(/^\d{2}\/\d{4}$/)) throw new Error("Use o formato MM/AAAA");
      if (!certId) throw new Error("Selecione uma certificadora");
      const { error } = await sb.from("lotes").insert({ mes_ano: mesAno, certificadora_id: certId, enviado: false });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lote criado");
      qc.invalidateQueries({ queryKey: ["sp-lotes"] });
      setMesAno(""); setCertId("");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Lote</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Mês/Ano (MM/AAAA)</Label>
            <Input placeholder="06/2026" value={mesAno} onChange={(e) => setMesAno(e.target.value)} />
          </div>
          <div>
            <Label>Certificadora</Label>
            <Select value={certId} onValueChange={setCertId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {certs?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AlunosLoteModal({ lote, onClose }: { lote: any; onClose: () => void }) {
  const { data: alunos } = useQuery({
    queryKey: ["sp-alunos-lote", lote.id],
    queryFn: async () => {
      const { data } = await sb.from("lote_alunos").select("id, alunos(id, nome, cpf, polos(nome))").eq("lote_id", lote.id);
      return data ?? [];
    },
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Alunos do Lote {lote.mes_ano}</DialogTitle>
          <DialogDescription>{lote.certificadoras?.nome}</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto">
          {alunos?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum aluno no lote.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Polo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alunos?.map((la: any) => (
                  <TableRow key={la.id}>
                    <TableCell>{la.alunos?.nome}</TableCell>
                    <TableCell>{la.alunos?.cpf}</TableCell>
                    <TableCell>{la.alunos?.polos?.nome ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== ABA 3: CERTIFICADOS ============================== */

function CertificadosTab() {
  const selectedPoloId = usePoloFilter();
  const { data: rows, isLoading } = useQuery({
    queryKey: ["sp-certificados", selectedPoloId],
    queryFn: async () => {
      const { data } = await sb
        .from("lote_alunos")
        .select(`
          id,
          alunos(id, nome, polo_id, polos(nome)),
          lotes!inner(mes_ano, data_envio, enviado, certificadoras(nome))
        `)
        .eq("lotes.enviado", true);
      const filtered = (data ?? []).filter((r: any) =>
        selectedPoloId === "all" || r.alunos?.polo_id === selectedPoloId
      );
      return filtered;
    },
  });
  return (
    <Card>
      <CardContent className="pt-6 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Polo</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Certificadora</TableHead>
              <TableHead>Data Envio</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            ) : rows?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum certificado.</TableCell></TableRow>
            ) : rows?.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.alunos?.nome}</TableCell>
                <TableCell>{r.alunos?.polos?.nome ?? "-"}</TableCell>
                <TableCell>{r.lotes?.mes_ano}</TableCell>
                <TableCell>{r.lotes?.certificadoras?.nome ?? "-"}</TableCell>
                <TableCell>{r.lotes?.data_envio ? new Date(r.lotes.data_envio).toLocaleDateString("pt-BR") : "-"}</TableCell>
                <TableCell><Badge variant="outline">Aguardando</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ============================== MODAL CERTIFICADORAS ============================== */

function CertificadorasModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data: certs, isLoading } = useQuery({
    queryKey: ["sp-certs-all"],
    queryFn: async () => {
      const { data } = await sb.from("certificadoras").select("*").order("nome");
      return data ?? [];
    },
    enabled: open,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("certificadoras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Certificadora excluída");
      qc.invalidateQueries({ queryKey: ["sp-certs-all"] });
      qc.invalidateQueries({ queryKey: ["sp-certs-active"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Certificadoras</DialogTitle>
            <DialogDescription>Cadastro de certificadoras que validam os certificados</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Nova Certificadora
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>INEP</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Validações</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : certs?.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma certificadora cadastrada.</TableCell></TableRow>
                ) : certs?.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{[c.cidade, c.estado].filter(Boolean).join("/")}</TableCell>
                    <TableCell>{c.codigo_inep ?? "-"}</TableCell>
                    <TableCell>{c.responsavel ?? "-"}</TableCell>
                    <TableCell>{c.telefone ?? "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 text-xs">
                        {c.rec_firma && <Badge variant="outline">RF</Badge>}
                        {c.d_oficial && <Badge variant="outline">DO</Badge>}
                        {c.visto_confere && <Badge variant="outline">VC</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.ativo ? "default" : "secondary"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setFormOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir certificadora?")) deleteMut.mutate(c.id); }}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
      {formOpen && (
        <CertificadoraFormModal
          editing={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}
    </>
  );
}

function CertificadoraFormModal({ editing, onClose }: { editing: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nome: editing?.nome ?? "",
    cidade: editing?.cidade ?? "",
    estado: editing?.estado ?? "",
    codigo_inep: editing?.codigo_inep ?? "",
    responsavel: editing?.responsavel ?? "",
    telefone: editing?.telefone ?? "",
    rec_firma: editing?.rec_firma ?? false,
    d_oficial: editing?.d_oficial ?? false,
    visto_confere: editing?.visto_confere ?? false,
    ativo: editing?.ativo ?? true,
  });
  const mut = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome obrigatório");
      if (editing) {
        const { error } = await sb.from("certificadoras").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("certificadoras").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Certificadora atualizada" : "Certificadora criada");
      qc.invalidateQueries({ queryKey: ["sp-certs-all"] });
      qc.invalidateQueries({ queryKey: ["sp-certs-active"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar" : "Nova"} Certificadora</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
          <div><Label>Estado (UF)</Label><Input maxLength={2} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })} /></div>
          <div><Label>Código INEP</Label><Input value={form.codigo_inep} onChange={(e) => setForm({ ...form, codigo_inep: e.target.value })} /></div>
          <div><Label>Responsável</Label><Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} /></div>
          <div className="col-span-2"><Label>Telefone do Responsável</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t pt-3">
          {VALID_FIELDS.map((f) => (
            <label key={f.id} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={(form as any)[f.id]} onCheckedChange={(v) => setForm({ ...form, [f.id]: !!v })} />
              <span className="text-sm">{f.label}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <Label>Ativo</Label>
          <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
