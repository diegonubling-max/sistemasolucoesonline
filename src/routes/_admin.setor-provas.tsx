import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus, Search, Pencil, Trash2, Loader2, Send, FileText,
  Building2, CheckCircle2, AlertCircle, Eye, Upload, X, MoreHorizontal, RefreshCw, Mail, Package,
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
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
        title="Documentação e Certificação"
        description="Controle de documentos, envio para certificadoras e certificados"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCertOpen(true)}>
              <Building2 className="h-4 w-4 mr-2" /> Certificadoras
            </Button>
            {tab === "documentacao" && (
              <Button onClick={() => window.dispatchEvent(new Event("open-novo-registro"))}>
                <Plus className="h-4 w-4 mr-2" /> Novo Registro
              </Button>
            )}
          </div>
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
  const [poloFilter, setPoloFilter] = useState<string>("all");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; nome: string } | null>(null);
  const [certFilter, setCertFilter] = useState<string>("all");

  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [encDocId, setEncDocId] = useState<string | null>(null);
  const [declDoc, setDeclDoc] = useState<{ id: string; nome: string; texto?: string } | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  useEffect(() => {
    const h = () => setNovoOpen(true);
    window.addEventListener("open-novo-registro", h);
    return () => window.removeEventListener("open-novo-registro", h);
  }, []);


  const { data: rows, isLoading } = useQuery({
    queryKey: ["sp-doc-rows", selectedPoloId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("documentacao_alunos")
        .select(`
          id, aluno_id, nome_aluno, polo, quem_vendeu, telefone, ctr,
          documentacao_completa, certificadora_id, lote, data_envio,
          declaracao_gerada, declaracao_data, created_at,
          certificadoras(nome),
          alunos(id, ctr, polo_id, polos(nome))
        `)
        .is("data_envio", null)
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

  const { data: certsList } = useQuery({
    queryKey: ["sp-certs-active"],
    queryFn: async () => {
      const { data } = await sb.from("certificadoras").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
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
      if (poloFilter !== "all") {
        const p = r.alunos?.polos?.nome ?? r.polo;
        if (p !== poloFilter) return false;
      }
      if (certFilter !== "all" && r.certificadora_id !== certFilter) return false;
      return true;
    });
  }, [rows, search, statusDoc, loteFilter, poloFilter, certFilter]);


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
      <div className="flex flex-nowrap gap-2 overflow-x-auto items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={poloFilter} onValueChange={setPoloFilter}>
          <SelectTrigger className="w-[160px] shrink-0"><SelectValue placeholder="Polo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Polos</SelectItem>
            {POLOS_FIXOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={certFilter} onValueChange={setCertFilter}>
          <SelectTrigger className="w-[180px] shrink-0"><SelectValue placeholder="Certificadora" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Certificadoras</SelectItem>
            {(certsList ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={loteFilter} onValueChange={setLoteFilter}>
          <SelectTrigger className="w-[140px] shrink-0"><SelectValue placeholder="Lote" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Lotes</SelectItem>
            {((lotes ?? []) as string[]).map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusDoc} onValueChange={setStatusDoc}>
          <SelectTrigger className="w-[160px] shrink-0"><SelectValue placeholder="Documentação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="completa">Completa</SelectItem>
            <SelectItem value="incompleta">Incompleta</SelectItem>
          </SelectContent>
        </Select>
      </div>




      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Aluno</TableHead>
                <TableHead className="w-[10%]">Polo</TableHead>
                <TableHead className="w-[10%]">Vendedora</TableHead>
                <TableHead className="w-[9%]">Documentação</TableHead>
                <TableHead className="w-[10%]">Certificadora</TableHead>
                <TableHead className="w-[7%]">Lote</TableHead>
                <TableHead className="w-[14%]">Declaração</TableHead>
                <TableHead className="w-[12%] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum aluno encontrado.</TableCell></TableRow>
              ) : filtered.map((r: any) => {
                const status = r.documentacao_completa ? "completa" : "incompleta";
                const ctrLabel = r.alunos?.ctr ?? r.ctr;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium truncate">
                      <span className="truncate">{r.nome_aluno}</span>
                      {r.aluno_id && ctrLabel ? <span className="text-xs text-muted-foreground ml-2">CTR {ctrLabel}</span> : null}
                    </TableCell>
                    <TableCell className="truncate">{r.alunos?.polos?.nome ?? r.polo ?? "-"}</TableCell>
                    <TableCell className="truncate">{r.quem_vendeu ?? "-"}</TableCell>
                    <TableCell>
                      {status === "completa" ? (
                        <Badge className="rounded-full bg-[#14a011] hover:bg-[#14a011] text-white text-xs px-2 py-0.5">✅ Completa</Badge>
                      ) : (
                        <Badge className="rounded-full bg-red-500 hover:bg-red-500 text-white text-xs px-2 py-0.5">⚠️ Incompleta</Badge>
                      )}
                    </TableCell>

                    <TableCell className="truncate">{r.certificadoras?.nome ?? "-"}</TableCell>
                    <TableCell className="truncate">{r.lote ?? "-"}</TableCell>
                    <TableCell>
                      {r.declaracao_gerada ? (
                        <div className="flex items-center gap-1">
                          <Badge
                            className="rounded-full bg-[#14a011] hover:bg-[#14a011] text-white text-xs px-2 py-0.5 cursor-default"
                            title={r.declaracao_data ? `Gerada em ${new Date(r.declaracao_data).toLocaleDateString("pt-BR")}` : "Gerada"}
                          >
                            ✅ Gerada
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => toast.info("Funcionalidade em breve disponível")}>
                                <Eye className="h-4 w-4 mr-2" /> Visualizar PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeclDoc({ id: r.id, nome: r.nome_aluno, texto: DECLARACAO_TEXTO_PADRAO })}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar declaração
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeclDoc({ id: r.id, nome: r.nome_aluno })}>
                                <RefreshCw className="h-4 w-4 mr-2" /> Gerar nova versão
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={async () => {
                                  if (!confirm("Excluir declaração deste aluno?")) return;
                                  const { error } = await sb.from("documentacao_alunos").update({
                                    declaracao_gerada: false,
                                    declaracao_data: null,
                                    updated_at: new Date().toISOString(),
                                  }).eq("id", r.id);
                                  if (error) { toast.error(error.message); return; }
                                  toast.success("Declaração excluída");
                                  qc.invalidateQueries({ queryKey: ["sp-doc-rows"] });
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir declaração
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setDeclDoc({ id: r.id, nome: r.nome_aluno })}>
                          <FileText className="h-3 w-3 mr-1" /> Gerar Declaração
                        </Button>
                      )}
                    </TableCell>

                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setEncDocId(r.id)} title="Encaminhar para certificadora">
                        <Send className="h-4 w-4" />
                      </Button>



                      <Button size="sm" variant="ghost" onClick={() => setEditDocId(r.id)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ id: r.id, nome: r.nome_aluno })} title="Excluir">
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

      {editDocId && <EditarRegistroModal docId={editDocId} onClose={() => setEditDocId(null)} />}
      {encDocId && <EncaminharModal docId={encDocId} onClose={() => setEncDocId(null)} />}
      {declDoc && <GerarDeclaracaoModal docId={declDoc.id} nomeInicial={declDoc.nome} textoInicial={declDoc.texto} onClose={() => setDeclDoc(null)} />}
      <NovoRegistroModal open={novoOpen} onClose={() => setNovoOpen(false)} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Registro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o registro de {confirmDelete?.nome}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (confirmDelete) deleteMut.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

const DECLARACAO_TEXTO_PADRAO = `Declaramos para os devidos fins que o aluno(a) acima citado, concluiu o Ensino Médio na modalidade de Supletivo EJA EaD, através da prova de proficiência junto à certificadora nossa parceira, estando apto a prosseguir seus estudos em nível Superior e/ou Técnico. Válido em todo território nacional.

Esta Declaração tem validade de 90 dias a contar da data de sua expedição.

O aluno está no aguardo do processo de certificação junto à certificadora, podendo levar de 60 a 90 dias.

Por ser verdade, firmo o presente.`;

function GerarDeclaracaoModal({ docId, nomeInicial, textoInicial, onClose }: { docId: string; nomeInicial: string; textoInicial?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(nomeInicial);
  const [texto, setTexto] = useState(textoInicial ?? DECLARACAO_TEXTO_PADRAO);

  const [loading, setLoading] = useState(false);

  const handleGerar = async () => {
    setLoading(true);
    try {
      toast.info("Funcionalidade de geração de PDF em breve disponível");
      const { error } = await sb.from("documentacao_alunos").update({
        declaracao_gerada: true,
        declaracao_data: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", docId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["sp-doc-rows"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>📄 Gerar Declaração</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome do Aluno</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Texto da Declaração</Label>
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={12} />
          </div>
          <p className="text-xs text-muted-foreground">
            Cidade, data e assinatura serão adicionados automaticamente ao final do documento.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={handleGerar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

const DOC_ENV_FIELDS: { key: string; label: string }[] = [
  { key: "doc_rg_cpf", label: "RG e CPF" },
  { key: "doc_comprovante_residencia", label: "Comprovante de Residência" },
  { key: "doc_historico_fundamental", label: "Histórico Ensino Fundamental" },
  { key: "doc_historico_fundamental_medio", label: "Histórico Ensino Fund. e Médio" },
];
const CTRL_FIELDS: { key: string; label: string }[] = [
  { key: "documentacao_completa", label: "Documentação Completa" },
  { key: "necessita_reconhecimento_firma", label: "Rec. Firma" },
  { key: "necessita_diario_oficial", label: "Diário Oficial" },
  { key: "necessita_visto_confere", label: "Visto Confere" },
];
const POLO_OPTIONS = ["Florianópolis", "Matriz", "Novo Hamburgo", "Porto Alegre", "Outros"];

function EditarRegistroModal({ docId, onClose }: { docId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const [novosArquivos, setNovosArquivos] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const { data: doc, isLoading } = useQuery({
    queryKey: ["sp-doc-edit", docId],
    queryFn: async () => {
      const { data, error } = await sb.from("documentacao_alunos").select("*").eq("id", docId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: certs } = useQuery({
    queryKey: ["sp-certs-active"],
    queryFn: async () => {
      const { data } = await sb.from("certificadoras").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (doc) setForm({ ...doc, arquivos_paths: doc.arquivos_paths ?? [] });
  }, [doc]);

  const setF = (k: string, v: any) => setForm((prev: any) => ({ ...prev, [k]: v }));

  const removeArquivo = (path: string) => {
    setForm((prev: any) => ({
      ...prev,
      arquivos_paths: (prev.arquivos_paths ?? []).filter((p: string) => p !== path),
      _removidos: [...(prev._removidos ?? []), path],
    }));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("Formulário não carregado");
      // Upload novos arquivos
      const novosPaths: string[] = [];
      for (const file of novosArquivos) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${docId}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("documentos-alunos").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        novosPaths.push(path);
      }
      // Remover arquivos deletados do storage
      const removidos: string[] = form._removidos ?? [];
      if (removidos.length) {
        await supabase.storage.from("documentos-alunos").remove(removidos);
      }
      const arquivos_paths = [...(form.arquivos_paths ?? []), ...novosPaths];

      const payload = {
        nome_aluno: form.nome_aluno,
        polo: form.polo,
        quem_vendeu: form.quem_vendeu,
        telefone: form.telefone,
        ctr: form.ctr,
        doc_rg_cpf: !!form.doc_rg_cpf,
        doc_comprovante_residencia: !!form.doc_comprovante_residencia,
        doc_historico_fundamental: !!form.doc_historico_fundamental,
        doc_historico_fundamental_medio: !!form.doc_historico_fundamental_medio,
        doc_outros: !!form.doc_outros,
        doc_outros_descricao: form.doc_outros_descricao,
        documentacao_completa: !!form.documentacao_completa,
        necessita_reconhecimento_firma: !!form.necessita_reconhecimento_firma,
        necessita_diario_oficial: !!form.necessita_diario_oficial,
        necessita_visto_confere: !!form.necessita_visto_confere,
        certificadora_id: form.certificadora_id || null,
        lote: form.lote || null,
        data_envio: form.data_envio || null,
        observacao: form.observacao,
        arquivos_paths,
        updated_at: new Date().toISOString(),
      };
      const { error } = await sb.from("documentacao_alunos").update(payload).eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro atualizado");
      qc.invalidateQueries({ queryKey: ["sp-doc-rows"] });
      qc.invalidateQueries({ queryKey: ["sp-envios-rows"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Registro — Documentação</DialogTitle>
          <DialogDescription>Atualize os dados, arquivos e status do aluno</DialogDescription>
        </DialogHeader>

        {isLoading || !form ? (
          <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome do Aluno</Label><Input value={form.nome_aluno ?? ""} onChange={(e) => setF("nome_aluno", e.target.value)} /></div>
              <div>
                <Label>Polo</Label>
                <Select value={form.polo ?? ""} onValueChange={(v) => setF("polo", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {POLO_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Quem fez a venda</Label><Input value={form.quem_vendeu ?? ""} onChange={(e) => setF("quem_vendeu", e.target.value)} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone ?? ""} onChange={(e) => setF("telefone", e.target.value)} /></div>
              <div><Label>CTR</Label><Input value={form.ctr ?? ""} onChange={(e) => setF("ctr", e.target.value)} /></div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <h4 className="font-semibold">Documentos Recebidos</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DOC_ENV_FIELDS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={!!form[f.key]} onCheckedChange={(v) => setF(f.key, !!v)} />
                    <span className="text-sm">{f.label}</span>
                  </label>
                ))}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={!!form.doc_outros} onCheckedChange={(v) => setF("doc_outros", !!v)} />
                  <span className="text-sm">Outros</span>
                </label>
              </div>
              {form.doc_outros && (
                <Input placeholder="Descrição de outros documentos" value={form.doc_outros_descricao ?? ""} onChange={(e) => setF("doc_outros_descricao", e.target.value)} />
              )}
            </div>

            <div className="space-y-3 border-t pt-4">
              <h4 className="font-semibold">Controle</h4>
              <div className="grid grid-cols-2 gap-3">
                {CTRL_FIELDS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={!!form[f.key]} onCheckedChange={(v) => setF(f.key, !!v)} />
                    <span className="text-sm">{f.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t pt-4">
              <div>
                <Label>Certificadora</Label>
                <Select value={form.certificadora_id ?? ""} onValueChange={(v) => setF("certificadora_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(certs ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lote</Label>
                <Select value={form.lote ?? ""} onValueChange={(v) => setF("lote", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {LOTES_FIXOS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de Envio</Label>
                <Input type="date" value={form.data_envio ?? ""} onChange={(e) => setF("data_envio", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Observação</Label>
                <Textarea rows={3} value={form.observacao ?? ""} onChange={(e) => setF("observacao", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label>Arquivos anexados</Label>
              {(form.arquivos_paths ?? []).length === 0 && novosArquivos.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum arquivo anexado.</p>
              )}
              {(form.arquivos_paths ?? []).length > 0 && (
                <ul className="space-y-1">
                  {(form.arquivos_paths as string[]).map((p) => (
                    <li key={p} className="flex items-center justify-between text-sm border rounded px-2 py-1">
                      <span className="truncate">{p.split("/").pop()}</span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeArquivo(p)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragOver(false);
                  const files = Array.from(e.dataTransfer.files).filter((f) => /\.(pdf|jpe?g|png)$/i.test(f.name));
                  setNovosArquivos((prev) => [...prev, ...files]);
                }}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition ${dragOver ? "border-primary bg-muted/50" : "border-muted-foreground/30 hover:bg-muted/30"}`}
              >
                <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <div className="text-xs text-muted-foreground">Adicionar arquivos (PDF, JPG, PNG)</div>
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setNovosArquivos((prev) => [...prev, ...files]);
                    e.target.value = "";
                  }}
                />
              </label>
              {novosArquivos.length > 0 && (
                <ul className="space-y-1">
                  {novosArquivos.map((f, i) => (
                    <li key={i} className="flex items-center justify-between text-sm border rounded px-2 py-1 bg-muted/30">
                      <span className="truncate">{f.name} <span className="text-xs text-muted-foreground">(novo)</span></span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setNovosArquivos((prev) => prev.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form}>
            {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* ============================== MODAL ENCAMINHAR ============================== */

const LOTES_FIXOS = [
  "01/2026","02/2026","03/2026","04/2026","05/2026","06/2026",
  "07/2026","08/2026","09/2026","10/2026","11/2026","12/2026",
];

function EncaminharModal({ docId, onClose }: { docId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [certId, setCertId] = useState<string>("");
  const [dataEnvio, setDataEnvio] = useState<string>(new Date().toISOString().slice(0, 10));
  const [lote, setLote] = useState<string>("");

  const { data: certs } = useQuery({
    queryKey: ["sp-certs-active"],
    queryFn: async () => {
      const { data } = await sb.from("certificadoras").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  useQuery({
    queryKey: ["sp-doc-current", docId],
    queryFn: async () => {
      const { data } = await sb
        .from("documentacao_alunos")
        .select("certificadora_id, lote, data_envio")
        .eq("id", docId)
        .maybeSingle();
      if (data) {
        if (data.certificadora_id) setCertId(data.certificadora_id);
        if (data.lote) setLote(data.lote);
        if (data.data_envio) setDataEnvio(String(data.data_envio).slice(0, 10));
      }
      return data ?? null;
    },
  });


  const mut = useMutation({
    mutationFn: async () => {
      if (!certId) throw new Error("Selecione uma certificadora");
      if (!lote) throw new Error("Selecione um lote");
      if (!dataEnvio) throw new Error("Selecione a data de envio");
      const { error } = await sb.from("documentacao_alunos").update({
        certificadora_id: certId,
        data_envio: dataEnvio,
        lote,
        updated_at: new Date().toISOString(),
      }).eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aluno encaminhado para certificadora com sucesso");
      qc.invalidateQueries({ queryKey: ["sp-doc-rows"] });
      qc.invalidateQueries({ queryKey: ["sp-envios-rows"] });
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
            <Label>Certificadora *</Label>
            <Select value={certId} onValueChange={setCertId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {certs?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data de Envio *</Label>
            <Input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
          </div>
          <div>
            <Label>Lote *</Label>
            <Select value={lote} onValueChange={setLote}>
              <SelectTrigger><SelectValue placeholder="Selecione o lote" /></SelectTrigger>
              <SelectContent>
                {LOTES_FIXOS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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

const POLOS_FIXOS = ["Florianópolis", "Matriz", "Novo Hamburgo", "Porto Alegre", "Outros"];

function EnviosTab() {
  const qc = useQueryClient();
  const [declDoc, setDeclDoc] = useState<{ id: string; nome: string; texto?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [certFilter, setCertFilter] = useState("all");
  const [loteFilter, setLoteFilter] = useState("all");
  const [poloFilter, setPoloFilter] = useState("all");
  const [vendedorFilter, setVendedorFilter] = useState("all");
  const [docFilter, setDocFilter] = useState("all");
  const [declFilter, setDeclFilter] = useState("all");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [viewRow, setViewRow] = useState<any>(null);


  const { data: rows, isLoading } = useQuery({
    queryKey: ["sp-envios-rows"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("documentacao_alunos")
        .select(`
          id, nome_aluno, polo, telefone, quem_vendeu, lote, data_envio, certificadora_id,
          documentacao_completa, declaracao_gerada, declaracao_data, cert_observacao,
          doc_rg_cpf, doc_comprovante_residencia, doc_historico_fundamental, doc_historico_fundamental_medio, doc_outros,
          arquivos_paths,
          cert_digital_enviado, cert_fisico_recebido, cert_fisico_enviado_aluno, cert_fisico_rastreio,
          certificadoras(nome),
          alunos(polo_id, polos(nome))
        `)
        .not("data_envio", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });


  const { data: certs } = useQuery({
    queryKey: ["sp-certs-active"],
    queryFn: async () => {
      const { data } = await sb.from("certificadoras").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const vendedores = useMemo(
    () => Array.from(new Set((rows ?? []).map((r: any) => r.quem_vendeu).filter(Boolean))),
    [rows]
  );

  const lotesComContagem = useMemo(() => {
    const map = new Map<string, number>();
    (rows ?? []).forEach((r: any) => {
      if (!r.lote) return;
      map.set(r.lote, (map.get(r.lote) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([lote, count]) => ({ lote, count }))
      .sort((a, b) => a.lote.localeCompare(b.lote));
  }, [rows]);

  const lotes = useMemo(() => lotesComContagem.map((l) => l.lote), [lotesComContagem]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = (rows ?? []).filter((r: any) => {
      if (s) {
        const dateStr = r.data_envio ? new Date(r.data_envio).toLocaleDateString("pt-BR") : "";
        if (!r.nome_aluno?.toLowerCase().includes(s) && !dateStr.includes(s) && !(r.data_envio ?? "").includes(s)) return false;
      }
      if (certFilter !== "all" && r.certificadora_id !== certFilter) return false;
      if (loteFilter !== "all" && r.lote !== loteFilter) return false;
      if (poloFilter !== "all") {
        const p = r.alunos?.polos?.nome ?? r.polo;
        if (p !== poloFilter) return false;
      }
      if (vendedorFilter !== "all" && r.quem_vendeu !== vendedorFilter) return false;
      if (docFilter === "completa" && !r.documentacao_completa) return false;
      if (docFilter === "incompleta" && r.documentacao_completa) return false;
      if (declFilter === "gerada" && !r.declaracao_gerada) return false;
      if (declFilter === "nao" && r.declaracao_gerada) return false;
      if (dataIni && (!r.data_envio || r.data_envio < dataIni)) return false;
      if (dataFim && (!r.data_envio || r.data_envio > dataFim)) return false;
      return true;
    });
    return [...list].sort((a: any, b: any) => (b.data_envio ?? "").localeCompare(a.data_envio ?? ""));
  }, [rows, search, certFilter, loteFilter, poloFilter, vendedorFilter, docFilter, declFilter, dataIni, dataFim]);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4 overflow-x-auto">
        {lotesComContagem.length > 0 && (
          <div className="pb-6 mb-2 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">Lotes</h3>
            <div className="flex flex-wrap gap-2">
              {lotesComContagem.map(({ lote, count }) => {
                const active = loteFilter === lote;
                return (
                  <button
                    key={lote}
                    type="button"
                    onClick={() => setLoteFilter(active ? "all" : lote)}
                    className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                      active
                        ? "bg-blue-700 text-white hover:bg-blue-800"
                        : "bg-blue-100 text-blue-900 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:hover:bg-blue-900"
                    }`}
                  >
                    {lote}
                    <span className={`ml-2 font-normal ${active ? "text-blue-100" : "text-blue-700 dark:text-blue-300"}`}>
                      {count} {count === 1 ? "aluno" : "alunos"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[420px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou data..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={certFilter} onValueChange={setCertFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Certificadora" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Certificadoras</SelectItem>
              {(certs ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={loteFilter} onValueChange={setLoteFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Lote" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Lotes</SelectItem>
              {lotes.map((l: any) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={poloFilter} onValueChange={setPoloFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Polo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Polos</SelectItem>
              {POLOS_FIXOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Vendedores</SelectItem>
              {vendedores.map((v: any) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={docFilter} onValueChange={setDocFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Documentação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="completa">Completa</SelectItem>
              <SelectItem value="incompleta">Incompleta</SelectItem>
            </SelectContent>
          </Select>
          <Select value={declFilter} onValueChange={setDeclFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Declaração" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="gerada">Gerada</SelectItem>
              <SelectItem value="nao">Não Gerada</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="w-[150px]" title="Data início" />
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-[150px]" title="Data fim" />
        </div>

        <Table>



          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Polo</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Certificadora</TableHead>
              <TableHead>Data Envio</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Documentação</TableHead>
              <TableHead>Declaração</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum envio registrado.</TableCell></TableRow>
            ) : filtered.map((r: any) => (

              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.nome_aluno}</TableCell>
                <TableCell>{r.alunos?.polos?.nome ?? r.polo ?? "-"}</TableCell>
                <TableCell>{r.quem_vendeu ?? "-"}</TableCell>
                <TableCell>{r.certificadoras?.nome ?? "-"}</TableCell>
                <TableCell>{r.data_envio ? new Date(r.data_envio).toLocaleDateString("pt-BR") : "-"}</TableCell>
                <TableCell>{r.lote ?? "-"}</TableCell>
                <TableCell>
                  {r.documentacao_completa ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✅ Completa</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">⚠️ Incompleta</Badge>
                  )}

                </TableCell>
                <TableCell>
                  {r.declaracao_gerada ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      ✅ Gerada{r.declaracao_data ? ` em ${new Date(r.declaracao_data).toLocaleDateString("pt-BR")}` : ""}
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setDeclDoc({ id: r.id, nome: r.nome_aluno })}>
                      <FileText className="h-3 w-3 mr-1" /> Gerar Declaração
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" title="Ver Detalhes" onClick={() => setViewRow(r)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>

              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {declDoc && (
        <GerarDeclaracaoModal
          docId={declDoc.id}
          nomeInicial={declDoc.nome}
          textoInicial={declDoc.texto}
          onClose={() => {
            setDeclDoc(null);
            qc.invalidateQueries({ queryKey: ["sp-envios-rows"] });
          }}
        />
      )}
      {viewRow && <VisualizarCertModal row={viewRow} onClose={() => setViewRow(null)} />}
    </Card>
  );
}



function _UnusedNovoLoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
  const qc = useQueryClient();
  const selectedPoloId = usePoloFilter();
  const [search, setSearch] = useState("");
  const [loteFilter, setLoteFilter] = useState("all");
  const [poloFilter, setPoloFilter] = useState("all");
  const [certFilter, setCertFilter] = useState("all");
  const [docFilter, setDocFilter] = useState("all");
  const [fisFilter, setFisFilter] = useState("all");
  const [enviarDigRow, setEnviarDigRow] = useState<any>(null);
  const [receberFisRow, setReceberFisRow] = useState<any>(null);
  const [obsRow, setObsRow] = useState<any>(null);
  const [viewRow, setViewRow] = useState<any>(null);



  const { data: rows, isLoading } = useQuery({
    queryKey: ["sp-certificados", selectedPoloId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("documentacao_alunos")
        .select(`
          id, nome_aluno, polo, telefone, quem_vendeu, lote, data_envio, certificadora_id,
          documentacao_completa, declaracao_gerada, declaracao_data, cert_observacao,
          doc_rg_cpf, doc_comprovante_residencia, doc_historico_fundamental, doc_historico_fundamental_medio, doc_outros,
          arquivos_paths,
          cert_digital_enviado, cert_fisico_recebido, cert_fisico_enviado_aluno, cert_fisico_rastreio,
          certificadoras(nome),
          alunos(polo_id, polos(nome))
        `)

        .not("data_envio", "is", null)
        .order("data_envio", { ascending: false });
      if (error) throw error;
      let list = data ?? [];
      if (selectedPoloId !== "all") {
        list = list.filter((r: any) => r.alunos?.polo_id === selectedPoloId);
      }
      return list;
    },
  });

  const { data: certs } = useQuery({
    queryKey: ["sp-certs-active"],
    queryFn: async () => {
      const { data } = await sb.from("certificadoras").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const lotesUnicos = useMemo(
    () => Array.from(new Set((rows ?? []).map((r: any) => r.lote).filter(Boolean))),
    [rows]
  );

  const filtered = useMemo(() => {
    return (rows ?? []).filter((r: any) => {
      if (search && !r.nome_aluno?.toLowerCase().includes(search.toLowerCase())) return false;
      if (loteFilter !== "all" && r.lote !== loteFilter) return false;
      if (poloFilter !== "all") {
        const p = r.alunos?.polos?.nome ?? r.polo;
        if (p !== poloFilter) return false;
      }
      if (certFilter !== "all" && r.certificadora_id !== certFilter) return false;
      if (docFilter === "completa" && !r.documentacao_completa) return false;
      if (docFilter === "incompleta" && r.documentacao_completa) return false;
      if (fisFilter === "aguardando" && r.cert_fisico_recebido) return false;
      if (fisFilter === "recebido" && !(r.cert_fisico_recebido && !r.cert_fisico_enviado_aluno)) return false;
      if (fisFilter === "enviado" && !r.cert_fisico_enviado_aluno) return false;
      return true;
    });
  }, [rows, search, loteFilter, poloFilter, certFilter, docFilter, fisFilter]);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4 overflow-x-auto">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar aluno..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={loteFilter} onValueChange={setLoteFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Lote" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Lotes</SelectItem>
              {lotesUnicos.map((l: any) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={poloFilter} onValueChange={setPoloFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Polo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Polos</SelectItem>
              {POLOS_FIXOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={certFilter} onValueChange={setCertFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Certificadora" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Certificadoras</SelectItem>
              {(certs ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={docFilter} onValueChange={setDocFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Documentação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="completa">Completa</SelectItem>
              <SelectItem value="incompleta">Incompleta</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fisFilter} onValueChange={setFisFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status Cert. Físico" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="aguardando">Aguardando chegada</SelectItem>
              <SelectItem value="recebido">Recebido na escola</SelectItem>
              <SelectItem value="enviado">Enviado ao aluno</SelectItem>
            </SelectContent>
          </Select>
        </div>



        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Certificadora</TableHead>
              <TableHead>Cert. Digital</TableHead>
              <TableHead>Cert. Físico</TableHead>
              <TableHead>Rastreio</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum certificado.</TableCell></TableRow>
            ) : filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.nome_aluno}</div>
                  <div className="text-xs text-muted-foreground">{r.telefone ?? "-"}</div>
                </TableCell>
                <TableCell>{r.lote ?? "-"}</TableCell>
                <TableCell>{r.certificadoras?.nome ?? "-"}</TableCell>
                <TableCell>
                  {r.cert_digital_enviado ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✉️ Enviado</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">🚫 Não enviado</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {r.cert_fisico_enviado_aluno ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✅ Enviado ao aluno</Badge>
                  ) : r.cert_fisico_recebido ? (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">📦 Recebido</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">⏳ Aguardando chegada</Badge>
                  )}
                </TableCell>
                <TableCell>{r.cert_fisico_rastreio || "-"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" title="Enviar Certificado Digital" onClick={() => setEnviarDigRow(r)}>
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" title="Certificado Físico Recebido" onClick={() => setReceberFisRow(r)}>
                    <Package className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" title="Observação do Certificado" onClick={() => setObsRow(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" title="Ver Detalhes" onClick={() => setViewRow(r)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {enviarDigRow && <EnviarDigitalModal row={enviarDigRow} onClose={() => { setEnviarDigRow(null); qc.invalidateQueries({ queryKey: ["sp-certificados"] }); }} />}
      {receberFisRow && <ReceberFisicoModal row={receberFisRow} onClose={() => { setReceberFisRow(null); qc.invalidateQueries({ queryKey: ["sp-certificados"] }); }} />}
      {obsRow && <ObservacaoCertModal row={obsRow} onClose={() => { setObsRow(null); qc.invalidateQueries({ queryKey: ["sp-certificados"] }); }} />}
      {viewRow && <VisualizarCertModal row={viewRow} onClose={() => setViewRow(null)} />}

    </Card>
  );
}

function EnviarDigitalModal({ row, onClose }: { row: any; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const confirmar = async () => {
    setLoading(true);
    const { error } = await sb.from("documentacao_alunos").update({
      cert_digital_enviado: true,
      cert_digital_data: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Certificado digital enviado");
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar Certificado Digital</DialogTitle>
          <DialogDescription>
            Confirmar envio do certificado digital para <b>{row.nome_aluno}</b>?
            <br /><span className="text-xs text-muted-foreground">A data de envio será registrada automaticamente.</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirmar} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar Envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceberFisicoModal({ row, onClose }: { row: any; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const confirmar = async () => {
    setLoading(true);
    const { error } = await sb.from("documentacao_alunos").update({
      cert_fisico_recebido: true,
      cert_fisico_data_recebimento: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Recebimento registrado");
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Certificado Físico Recebido</DialogTitle>
          <DialogDescription>
            Confirmar recebimento do certificado físico de <b>{row.nome_aluno}</b> na escola?
            <br /><span className="text-xs text-muted-foreground">A data de recebimento será registrada automaticamente.</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirmar} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar Recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ObservacaoCertModal({ row, onClose }: { row: any; onClose: () => void }) {
  const [obs, setObs] = useState<string>(row.cert_observacao ?? "");
  const [loading, setLoading] = useState(false);
  const salvar = async () => {
    setLoading(true);
    const { error } = await sb.from("documentacao_alunos").update({
      cert_observacao: obs || null,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Observação salva");
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Observação do Certificado</DialogTitle>
          <DialogDescription>Aluno: {row.nome_aluno}</DialogDescription>
        </DialogHeader>
        <Textarea placeholder="Observação..." rows={6} value={obs} onChange={(e) => setObs(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VisualizarCertModal({ row, onClose }: { row: any; onClose: () => void }) {
  const arquivos: string[] = Array.isArray(row.arquivos_paths) ? row.arquivos_paths : [];
  const docs = [
    { k: "doc_rg_cpf", label: "RG/CPF" },
    { k: "doc_comprovante_residencia", label: "Comprovante de Residência" },
    { k: "doc_historico_fundamental", label: "Histórico Fundamental" },
    { k: "doc_historico_fundamental_medio", label: "Histórico Fundamental/Médio" },
    { k: "doc_outros", label: "Outros" },
  ];
  const getUrl = async (path: string) => {
    const { data } = await sb.storage.from("documentos-alunos").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Detalhes — {row.nome_aluno}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div><b>Aluno:</b> {row.nome_aluno}</div>
            <div><b>Polo:</b> {row.alunos?.polos?.nome ?? row.polo ?? "-"}</div>
            <div><b>Vendedor:</b> {row.quem_vendeu ?? "-"}</div>
            <div><b>Telefone:</b> {row.telefone ?? "-"}</div>
            <div><b>Certificadora:</b> {row.certificadoras?.nome ?? "-"}</div>
            <div><b>Lote:</b> {row.lote ?? "-"}</div>
            <div><b>Data de Envio:</b> {row.data_envio ? new Date(row.data_envio).toLocaleDateString("pt-BR") : "-"}</div>
            <div><b>Declaração:</b> {row.declaracao_gerada ? `Gerada${row.declaracao_data ? ` em ${new Date(row.declaracao_data).toLocaleDateString("pt-BR")}` : ""}` : "Não gerada"}</div>
          </div>

          <div>
            <div className="font-semibold mb-1">Documentos recebidos</div>
            <div className="grid grid-cols-2 gap-1">
              {docs.map((d) => (
                <div key={d.k}>{row[d.k] ? "✅" : "❌"} {d.label}</div>
              ))}
            </div>
          </div>

          <div>
            <div className="font-semibold mb-1">Arquivos Anexados</div>
            {arquivos.length === 0 ? (
              <div className="text-muted-foreground">Nenhum arquivo.</div>
            ) : (
              <ul className="list-disc pl-5">
                {arquivos.map((p, i) => (
                  <li key={i}>
                    <button className="text-blue-600 hover:underline" onClick={() => getUrl(p)}>
                      {p.split("/").pop()}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="font-semibold mb-1">Certificados</div>
            <div className="flex flex-wrap gap-2">
              {row.cert_digital_enviado ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✉️ Digital enviado</Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">🚫 Digital não enviado</Badge>
              )}
              {row.cert_fisico_enviado_aluno ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✅ Físico enviado ao aluno</Badge>
              ) : row.cert_fisico_recebido ? (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">📦 Físico recebido</Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">⏳ Físico aguardando</Badge>
              )}
              {row.cert_fisico_rastreio && <Badge variant="outline">Rastreio: {row.cert_fisico_rastreio}</Badge>}
            </div>
          </div>

          {row.cert_observacao && (
            <div>
              <div className="font-semibold mb-1">Observação</div>
              <div className="whitespace-pre-wrap">{row.cert_observacao}</div>
            </div>
          )}

          <div className="pt-2 border-t">
            {row.documentacao_completa ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✅ Doc. Completa</Badge>
            ) : (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">⚠️ Doc. Incompleta</Badge>
            )}
          </div>
        </div>
        <DialogFooter><Button onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
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
          {[
            { id: "rec_firma", label: "Rec. Firma" },
            { id: "d_oficial", label: "D. Oficial" },
            { id: "visto_confere", label: "Visto Confere" },
          ].map((f) => (
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
