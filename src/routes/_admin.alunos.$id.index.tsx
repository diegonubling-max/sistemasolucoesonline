import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, GraduationCap, Key, Loader2, Wallet, Calendar as CalendarIcon, CheckCircle2, AlertCircle, ShoppingBag, Plus, Trash2, Lock, Receipt, Copy, MessageSquare, History, Clock, BookOpen, PlayCircle, LogIn, LogOut as LogOutIcon, FileCheck, FileText } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isBefore, startOfDay } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { formatDate } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BaixaModal } from "@/components/admin/BaixaModal";
import { ResumoBaixaModal } from "@/components/admin/ResumoBaixaModal";
import { formatCurrency } from "@/lib/format";
import { Switch } from "@/components/ui/switch";
import { generateAsaasCobrar } from "@/services/asaas";
import { QRCodeSVG } from "qrcode.react";
import declaracaoTemplate from "@/templates/declaracao-matricula.html?raw";
import { ProgressoAulas } from "@/components/admin/alunos/ProgressoAulas";
import { StatusAlunoBadge, type AlunoStatus } from "@/lib/aluno-status";
import { notifyPagamentoRecebido } from "@/lib/notify";


export const Route = createFileRoute("/_admin/alunos/$id/")({
  head: () => ({ meta: [{ title: "Aluno — Soluções Online" }] }),
  component: AlunoDetalhes,
});

function AlunoDetalhes() {
  const { id } = Route.useParams();
  const [showResetDefaultModal, setShowResetDefaultModal] = useState(false);
  const [showPasswordResult, setShowPasswordResult] = useState(false);
  const [showBaixaModal, setShowBaixaModal] = useState(false);
  const [showVitrineModal, setShowVitrineModal] = useState(false);
  const [showEditVitrineModal, setShowEditVitrineModal] = useState(false);
  const [editingVitrineItem, setEditingVitrineItem] = useState<any>(null);
  const [selectedParcelaId, setSelectedParcelaId] = useState<string | null>(null);
  const [selectedParcela, setSelectedParcela] = useState<any>(null);
  const [selectedParcelaValor, setSelectedParcelaValor] = useState<number>(0);
  const [showAsaasModal, setShowAsaasModal] = useState(false);
  const [showAsaasResultModal, setShowAsaasResultModal] = useState(false);
  const [asaasResult, setAsaasResult] = useState<any>(null);
  const [isGeneratingAsaas, setIsGeneratingAsaas] = useState(false);
  const [isFetchingAsaas, setIsFetchingAsaas] = useState<string | null>(null);
  const [resumoBaixa, setResumoBaixa] = useState<{
    formaPagamento: string;
    parcelas?: number;
    valorBruto: number;
    taxa?: number;
    valorLiquido: number;
    dataPagamento: string;
  } | null>(null);
  const qc = useQueryClient();
  const [passwordToDisplay, setPasswordToDisplay] = useState("");

  // Vitrine fields
  const [vitrineCursoId, setVitrineCursoId] = useState("");
  const [vitrinePrecoPix, setVitrinePrecoPix] = useState("");
  const [vitrinePrecoCartao, setVitrinePrecoCartao] = useState("");
  const [vitrineMaxParcelas, setVitrineMaxParcelas] = useState("12");
  const [editVitrinePrecoPix, setEditVitrinePrecoPix] = useState("");
  const [editVitrinePrecoCartao, setEditVitrinePrecoCartao] = useState("");
  const [editVitrineMaxParcelas, setEditVitrineMaxParcelas] = useState("12");
  const [editVitrineAtivo, setEditVitrineAtivo] = useState(true);

  const { data: aluno, isLoading } = useQuery({
    queryKey: ["aluno", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: cursos } = useQuery({
    queryKey: ["aluno-cursos", id],
    queryFn: async () => {
      const { data: ms } = await supabase.from("matriculas").select("id").eq("aluno_id", id);
      const ids = (ms ?? []).map((m) => m.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("matricula_cursos")
        .select("data_liberacao, cursos(id, nome, descricao)")
        .in("matricula_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: parcelas } = useQuery({
    queryKey: ["aluno-parcelas", id],
    queryFn: async () => {
      const { data: ms } = await supabase.from("matriculas").select("id").eq("aluno_id", id);
      const ids = (ms ?? []).map((m) => m.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("parcelas")
        .select("*")
        .in("matricula_id", ids)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: vitrine } = useQuery({
    queryKey: ["aluno-vitrine", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos_vitrine")
        .select("*, cursos(nome)")
        .eq("aluno_id", id);
      if (error) throw error;
      return data;
    },
  });

  const { data: allCourses } = useQuery({
    queryKey: ["all-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cursos").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: sessoes } = useQuery({
    queryKey: ["aluno-sessoes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aluno_sessoes")
        .select("*")
        .eq("aluno_id", id)
        .order("login_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: aulasAssistidas } = useQuery({
    queryKey: ["aluno-aulas-assistidas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aluno_aulas_assistidas")
        .select("*, cursos(nome), aulas(titulo)")
        .eq("aluno_id", id)
        .order("assistida_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: declaracoes } = useQuery({
    queryKey: ["aluno-declaracoes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("declaracoes_matricula")
        .select("*, gerado_por_colab:colaboradores(nome)")
        .eq("aluno_id", id)
        .order("gerado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: poloInfo } = useQuery({
    queryKey: ["polo-info", aluno?.polo_id],
    queryFn: async () => {
      if (!aluno?.polo_id) return null;
      const { data, error } = await supabase
        .from("polos")
        .select("nome, cnpj, endereco, cidade")
        .eq("id", aluno.polo_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!aluno?.polo_id,
  });

  const gerarDeclaracao = useMutation({
    mutationFn: async () => {
      if (!aluno) throw new Error("Dados do aluno não carregados");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: colab } = await supabase
        .from("colaboradores")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { error } = await supabase.from("declaracoes_matricula").insert({
        aluno_id: id,
        gerado_por: colab?.id,
      });

      if (error) throw error;
      
      // Generate HTML for Print
      const hoje = new Date();
      const cidade = poloInfo?.cidade || "Florianópolis";
      const dataExtenso = `${cidade}, ${hoje.getDate().toString().padStart(2, '0')} de ${hoje.toLocaleString('pt-BR', { month: 'long' })} de ${hoje.getFullYear()}`;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error("Não foi possível abrir a janela de impressão. Verifique se o bloqueador de popups está ativado.");
      }

      const htmlContent = declaracaoTemplate
        .replace(/\{\{NOME_ALUNO\}\}/g, aluno.nome ?? "")
        .replace(/\{\{CPF_ALUNO\}\}/g, aluno.cpf ?? "")
        .replace(/\{\{CIDADE\}\}/g, cidade)
        .replace(/\{\{DATA_EXTENSO\}\}/g, dataExtenso)
        .replace(
          /<\/body>/i,
          `<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 600); });</script></body>`
        );

      printWindow.document.write(htmlContent);
      printWindow.document.close();
    },
    onSuccess: () => {
      toast.success("Declaração gerada e registrada com sucesso!");
      qc.invalidateQueries({ queryKey: ["aluno-declaracoes", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: contratoAssinado } = useQuery({
    queryKey: ["aluno-contrato", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("data_assinatura")
        .eq("aluno_id", id)
        .not("data_assinatura", "is", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const darBaixa = useMutation({
    mutationFn: async (data: {
      data_pagamento: string;
      forma_pagamento: string;
      parcelas_cartao?: number;
      taxa_cartao?: number;
      valor_liquido?: number;
    }) => {
      if (!selectedParcelaId) return;
      const { error } = await supabase
        .from("parcelas")
        .update({
          status: "pago",
          ...data
        })
        .eq("id", selectedParcelaId);
      if (error) throw error;
      notifyPagamentoRecebido(selectedParcelaId, selectedParcelaValor, data.forma_pagamento);
      return data;
    },
    onSuccess: (data: any) => {
      if (data.forma_pagamento === 'cartao') {
        setResumoBaixa({
          formaPagamento: 'cartao',
          parcelas: data.parcelas_cartao,
          valorBruto: selectedParcelaValor,
          taxa: data.taxa_cartao,
          valorLiquido: data.valor_liquido,
          dataPagamento: data.data_pagamento,
        });
      } else {
        toast.success("Baixa realizada com sucesso!");
      }
      setShowBaixaModal(false);
      setSelectedParcelaId(null);
      qc.invalidateQueries({ queryKey: ["aluno-parcelas", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetToDefaultPassword = useMutation({
    mutationFn: async () => {
      if (!aluno?.email || !aluno?.nome) return;
      const primeiroNome = aluno.nome.split(' ')[0];
      const senhaPadrao = '1234' + primeiroNome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const { error } = await supabase.rpc('redefinir_senha_aluno', {
        p_email: aluno.email,
        p_nova_senha: senhaPadrao
      });
      if (error) throw error;
      return senhaPadrao;
    },
    onSuccess: (senhaGerada) => {
      if (!senhaGerada) return;
      toast.success("Senha redefinida com sucesso");
      setPasswordToDisplay(senhaGerada);
      setShowResetDefaultModal(false);
      setShowPasswordResult(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addToVitrine = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cursos_vitrine").insert({
        aluno_id: id,
        curso_id: vitrineCursoId,
        preco_pix: Number(vitrinePrecoPix),
        preco_cartao: Number(vitrinePrecoCartao),
        max_parcelas: Number(vitrineMaxParcelas),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Curso adicionado à vitrine!");
      setShowVitrineModal(false);
      setVitrineCursoId("");
      setVitrinePrecoPix("");
      setVitrinePrecoCartao("");
      setVitrineMaxParcelas("12");
      qc.invalidateQueries({ queryKey: ["aluno-vitrine", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateVitrine = useMutation({
    mutationFn: async () => {
      if (!editingVitrineItem) return;
      const { error } = await supabase.from("cursos_vitrine").update({
        preco_pix: Number(editVitrinePrecoPix),
        preco_cartao: Number(editVitrinePrecoCartao),
        max_parcelas: Number(editVitrineMaxParcelas),
        ativo: editVitrineAtivo,
      }).eq("id", editingVitrineItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vitrine atualizada com sucesso!");
      setShowEditVitrineModal(false);
      setEditingVitrineItem(null);
      qc.invalidateQueries({ queryKey: ["aluno-vitrine", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeFromVitrine = useMutation({
    mutationFn: async (vitrineId: string) => {
      const { error } = await supabase.from("cursos_vitrine").delete().eq("id", vitrineId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Curso removido da vitrine!");
      qc.invalidateQueries({ queryKey: ["aluno-vitrine", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleGenerateAsaas = async (type: 'PIX' | 'BOLETO') => {
    if (!selectedParcela || !id) return;
    setIsGeneratingAsaas(true);
    try {
      const response = await generateAsaasCobrar(selectedParcela.id, type);
      if (response.error) throw new Error(response.error);
      const { payment, pixData, updateParcela } = response;
      const result = { 
        ...payment, 
        pixData,
        identificationField: updateParcela?.asaas_barcode || payment.identificationField || payment.fullCycleCode,
        bankSlipUrl: updateParcela?.asaas_url || payment.bankSlipUrl || payment.invoiceUrl
      };
      setAsaasResult(result);
      setShowAsaasModal(false);
      setShowAsaasResultModal(true);
      qc.invalidateQueries({ queryKey: ["aluno-parcelas", id] });
      toast.success("Cobrança gerada no Asaas!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsGeneratingAsaas(false);
    }
  };

  const stats = {
    totalAcessos: sessoes?.length || 0,
    tempoMedio: sessoes?.length 
      ? Math.round(sessoes.reduce((acc, s) => acc + (s.duracao_minutos || 0), 0) / sessoes.length)
      : 0,
    totalAulas: aulasAssistidas?.length || 0,
    ultimoAcesso: sessoes?.[0]?.login_em || null
  };

  const totalPago = parcelas?.filter(p => p.status === 'pago').reduce((acc, p) => {
    const isCartao = p.forma_pagamento === 'cartao';
    const val = isCartao && p.valor_liquido ? Number(p.valor_liquido) : Number(p.valor);
    return acc + val;
  }, 0) || 0;
  const totalAberto = parcelas?.filter(p => p.status === 'aberto').reduce((acc, p) => acc + Number(p.valor), 0) || 0;
  const totalGeral = parcelas?.filter(p => p.status !== 'isento').reduce((acc, p) => acc + Number(p.valor), 0) || 0;

  const [copied, setCopied] = useState(false);

  const handleCopyAccessData = () => {
    if (!aluno) return;
    const primeiroNome = aluno.nome.split(" ")[0];
    const senhaGerada = '1234' + primeiroNome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ')[0];
    const text = `*SEJA BEM VINDO*\n\nLogin: ${aluno.ctr}\nSenha: ${senhaGerada}\n\nhttps://sistemasolucoesonline.lovable.app/aluno/login`;
    navigator.clipboard.writeText(text);
    toast.success("Dados copiados!");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateStatus = useMutation({
    mutationFn: async (novo: AlunoStatus) => {
      const patch: any = { status: novo };
      if (novo === "trancado") patch.trancado_em = new Date().toISOString();
      if (novo === "formado") patch.formado_em = new Date().toISOString();
      if (novo === "inativo") patch.ativo = false;
      if (novo === "ativo") patch.ativo = true;
      const { error } = await supabase.from("alunos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, novo) => {
      toast.success(`Status atualizado para ${novo}`);
      qc.invalidateQueries({ queryKey: ["aluno", id] });
      qc.invalidateQueries({ queryKey: ["alunos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!aluno) return <p className="text-muted-foreground">Aluno não encontrado.</p>;

  const statusAtual = ((aluno as any).status ?? "ativo") as AlunoStatus;

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title={`${aluno.nome} | CTR #${aluno.ctr}`}
        description={aluno.email ?? "Sem e-mail"}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/alunos">
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Link>
            </Button>
            <Button variant="outline" className="border-blue-500 text-blue-600" onClick={handleCopyAccessData}>
              {copied ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Key className="h-4 w-4 mr-2" />}
              {copied ? "Copiado!" : "Copiar acesso"}
            </Button>
            <Button variant="outline" onClick={() => setShowResetDefaultModal(true)}>
              <Key className="h-4 w-4 mr-2" /> Senha Padrão
            </Button>
            <Button asChild>
              <Link to="/alunos/$id/editar" params={{ id }}>
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </Link>
            </Button>
            <Button variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => gerarDeclaracao.mutate()} disabled={gerarDeclaracao.isPending}>
              {gerarDeclaracao.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              Gerar Declaração
            </Button>
            {statusAtual !== "trancado" && statusAtual !== "formado" && statusAtual !== "inativo" && (
              <Button variant="outline" className="text-yellow-700 border-yellow-300 hover:bg-yellow-50" onClick={() => updateStatus.mutate("trancado")} disabled={updateStatus.isPending}>
                <Lock className="h-4 w-4 mr-2" /> Trancar Matrícula
              </Button>
            )}
            {statusAtual !== "ativo" && (
              <Button variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={() => updateStatus.mutate("ativo")} disabled={updateStatus.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Reativar
              </Button>
            )}
            {statusAtual !== "formado" && (
              <Button variant="outline" className="text-blue-700 border-blue-300 hover:bg-blue-50" onClick={() => updateStatus.mutate("formado")} disabled={updateStatus.isPending}>
                <GraduationCap className="h-4 w-4 mr-2" /> Marcar como Formado
              </Button>
            )}
            {statusAtual !== "inativo" && (
              <Button variant="outline" className="text-gray-700 border-gray-300 hover:bg-gray-50" onClick={() => updateStatus.mutate("inativo")} disabled={updateStatus.isPending}>
                <AlertCircle className="h-4 w-4 mr-2" /> Inativar
              </Button>
            )}
          </>
        }
      />

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="geral">Dados Gerais</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="vitrine">Vitrine</TabsTrigger>
          <TabsTrigger value="progresso">Progresso</TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>

        </TabsList>

        <TabsContent value="geral">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Dados cadastrais
                    <StatusAlunoBadge status={(aluno as any).status} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  <Info label="Telefone" value={aluno.telefone} />
                  <Info label="Sexo" value={aluno.sexo} />
                  <Info label="CPF" value={aluno.cpf} />
                  <Info label="Nascimento" value={formatDate(aluno.data_nascimento)} />
                  <Info label="Origem" value={aluno.origem} />
                  <Info label="Vendedora" value={aluno.vendedora} />
                  <Info label="Cadastrado por" value={(aluno as any).cadastrado_por} />
                  <Info label="Data do cadastro" value={formatDate(aluno.created_at)} />
                </CardContent>
              </Card>
              {aluno.observacao && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
                  <CardContent><p className="text-sm whitespace-pre-wrap">{aluno.observacao}</p></CardContent>
                </Card>
              )}
            </div>
            <div className="sticky top-5">
              <Card>
                <CardHeader><CardTitle className="text-base">Cursos liberados</CardTitle></CardHeader>
                <CardContent>
                  {!cursos?.length ? <p className="text-sm text-muted-foreground">Nenhum curso.</p> : (
                    <ul className="space-y-2">
                      {cursos.map((c, i) => (
                        <li key={i} className="p-3 rounded-md border text-sm font-medium">
                          {(c.cursos as any)?.nome}
                          <p className="text-[10px] text-muted-foreground mt-1">Liberado em {formatDate(c.data_liberacao)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-green-50"><CardContent className="pt-6"><p className="text-xs text-green-700">Pago</p><p className="text-xl font-bold">R$ {totalPago.toLocaleString("pt-BR")}</p></CardContent></Card>
            <Card className="bg-yellow-50"><CardContent className="pt-6"><p className="text-xs text-yellow-700">Aberto</p><p className="text-xl font-bold">R$ {totalAberto.toLocaleString("pt-BR")}</p></CardContent></Card>
            <Card className="bg-primary/5"><CardContent className="pt-6"><p className="text-xs text-primary">Geral</p><p className="text-xl font-bold">R$ {totalGeral.toLocaleString("pt-BR")}</p></CardContent></Card>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-2">Parcela</th><th className="text-left py-2">Vencimento</th><th className="text-left py-2">Valor</th><th className="text-left py-2">Status</th><th className="text-right py-2">Ações</th></tr></thead>
                  <tbody>
                    {parcelas?.map((p) => (
                      <tr key={p.id} className="border-b">
                        <td className="py-3">{p.tipo === 'taxa_matricula' ? 'Matrícula' : `Parcela ${p.numero}`}</td>
                        <td className="py-3">{formatDate(p.data_vencimento)}</td>
                        <td className="py-3 font-bold">{formatCurrency(p.valor)}</td>
                        <td className="py-3">
                          <Badge variant={p.status === 'pago' ? "outline" : "secondary"} className={cn(p.status === 'pago' && "bg-green-50 text-green-700")}>{p.status}</Badge>
                        </td>
                        <td className="py-3 text-right">
                          {p.status === 'aberto' && (
                            <Button size="sm" variant="ghost" className="text-green-600" onClick={() => { setSelectedParcelaId(p.id); setSelectedParcelaValor(Number(p.valor)); setShowBaixaModal(true); }}>Baixa</Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vitrine" className="space-y-6">
          <div className="flex justify-end"><Button onClick={() => setShowVitrineModal(true)}><Plus className="h-4 w-4 mr-2" /> Adicionar</Button></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {vitrine?.map((item) => (
              <Card key={item.id}><CardContent className="pt-6 flex justify-between items-start">
                <div><p className="font-bold">{(item.cursos as any)?.nome}</p><p className="text-xs text-muted-foreground">{formatCurrency(item.preco_pix)}</p></div>
                <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removeFromVitrine.mutate(item.id)}><Trash2 className="h-4 w-4" /></Button>
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <Card><CardContent className="pt-6 text-center"><LogIn className="h-4 w-4 mx-auto mb-2" /><p className="text-2xl font-bold">{stats.totalAcessos}</p><p className="text-xs text-muted-foreground">Acessos</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><Clock className="h-4 w-4 mx-auto mb-2" /><p className="text-2xl font-bold">{stats.tempoMedio} min</p><p className="text-xs text-muted-foreground">Média/Sessão</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><BookOpen className="h-4 w-4 mx-auto mb-2" /><p className="text-2xl font-bold">{stats.totalAulas}</p><p className="text-xs text-muted-foreground">Aulas Assistidas</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><CalendarIcon className="h-4 w-4 mx-auto mb-2" /><p className="text-sm font-bold">{stats.ultimoAcesso ? formatDate(stats.ultimoAcesso) : "—"}</p><p className="text-xs text-muted-foreground">Último Acesso</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-lg">Linha do Tempo</CardTitle></CardHeader>
            <CardContent className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:w-0.5 before:bg-gray-200">
                {contratoAssinado && (
                  <div className="relative flex items-center gap-6 pl-10">
                    <div className="absolute left-0 flex items-center justify-center w-10 h-10 rounded-full bg-green-500 text-white"><FileCheck className="h-5 w-5" /></div>
                    <div><p className="font-bold">Contrato Assinado</p><p className="text-xs text-muted-foreground">{format(new Date(contratoAssinado.data_assinatura!), "dd/MM/yyyy HH:mm")}</p></div>
                  </div>
                )}
                {sessoes?.map((s) => (
                  <div key={s.id} className="relative flex items-center gap-6 pl-10">
                    <div className="absolute left-0 flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 text-white"><LogIn className="h-5 w-5" /></div>
                    <div>
                      <p className="font-bold">Sessão Iniciada</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(s.login_em), "dd/MM/yyyy HH:mm")} • {s.duracao_minutos || "?"} min</p>
                      {aulasAssistidas?.filter(a => {
                        const da = new Date(a.assistida_em);
                        const dl = new Date(s.login_em);
                        const lo = s.logout_em ? new Date(s.logout_em) : new Date();
                        return da >= dl && da <= lo;
                      }).map(a => (
                        <div key={a.id} className="flex items-center gap-2 text-[10px] mt-1 text-blue-600"><PlayCircle className="h-3 w-3" /> {(a.aulas as any)?.titulo}</div>
                      ))}
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" /> Histórico de Declarações</CardTitle></CardHeader>
            <CardContent>
              {!declaracoes?.length ? (
                <p className="text-sm text-muted-foreground">Nenhuma declaração gerada ainda.</p>
              ) : (
                <div className="space-y-4">
                  {declaracoes.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-3 border rounded-md text-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-50 rounded-full text-orange-600"><FileText className="h-4 w-4" /></div>
                        <div>
                          <p className="font-medium">Declaração de Matrícula</p>
                          <p className="text-xs text-muted-foreground">Gerado por: {(d.gerado_por_colab as any)?.nome || "Sistema"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium">{format(new Date(d.gerado_em), "dd/MM/yyyy")}</p>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(d.gerado_em), "HH:mm")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progresso" className="space-y-6">
          <ProgressoAulas alunoId={id} />
        </TabsContent>
      </Tabs>



      <BaixaModal open={showBaixaModal} onOpenChange={setShowBaixaModal} isLoading={darBaixa.isPending} valorOriginal={selectedParcelaValor} onConfirm={(data) => darBaixa.mutate(data)} />
      <ResumoBaixaModal open={!!resumoBaixa} onOpenChange={() => setResumoBaixa(null)} data={resumoBaixa} />
      <Dialog open={showResetDefaultModal} onOpenChange={setShowResetDefaultModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar</DialogTitle></DialogHeader>
          <div className="py-4 text-sm">Deseja redefinir a senha de <strong>{aluno.nome}</strong>?</div>
          <DialogFooter><Button variant="outline" onClick={() => setShowResetDefaultModal(false)}>Não</Button><Button onClick={() => resetToDefaultPassword.mutate()}>Sim, redefinir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showPasswordResult} onOpenChange={setShowPasswordResult}>
        <DialogContent><DialogHeader><DialogTitle>Senha Redefinida!</DialogTitle></DialogHeader><div className="bg-muted p-4 rounded text-sm"><p>Login: <b>{aluno.ctr}</b></p><p>Senha: <b>{passwordToDisplay}</b></p></div><Button onClick={() => setShowPasswordResult(false)}>Fechar</Button></DialogContent>
      </Dialog>
      <Dialog open={showVitrineModal} onOpenChange={setShowVitrineModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar à Vitrine</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <select className="w-full p-2 border rounded" value={vitrineCursoId} onChange={(e) => setVitrineCursoId(e.target.value)}>
              <option value="">Selecione...</option>
              {allCourses?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <Input placeholder="Preço PIX" type="number" value={vitrinePrecoPix} onChange={(e) => setVitrinePrecoPix(e.target.value)} />
            <Input placeholder="Preço Cartão" type="number" value={vitrinePrecoCartao} onChange={(e) => setVitrinePrecoCartao(e.target.value)} />
          </div>
          <Button onClick={() => addToVitrine.mutate()}>Adicionar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (<div><p className="text-[10px] text-muted-foreground uppercase">{label}</p><p className="font-medium">{value || "—"}</p></div>);
}
