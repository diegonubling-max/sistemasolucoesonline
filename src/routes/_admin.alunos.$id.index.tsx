import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, GraduationCap, Key, Loader2, Wallet, Calendar as CalendarIcon, CheckCircle2, AlertCircle, ShoppingBag, Plus, Trash2, Lock, Receipt, Copy, MessageSquare } from "lucide-react";
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

export const Route = createFileRoute("/_admin/alunos/$id/")({
  head: () => ({ meta: [{ title: "Aluno — Soluções Online" }] }),
  component: AlunoDetalhes,
});

function AlunoDetalhes() {
  const { id } = Route.useParams();
  const [showResetModal, setShowResetModal] = useState(false);
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
  const [dataPagamento, setDataPagamento] = useState<Date>(new Date());
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
      const senhaPadrao = '123' + primeiroNome.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

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

  const { data: allCourses } = useQuery({
    queryKey: ["all-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cursos").select("id, nome").order("nome");
      if (error) throw error;
      return data;
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

  const updateVitrine = useMutation({
    mutationFn: async () => {
      if (!editingVitrineItem) return;
      const { error } = await supabase
        .from("cursos_vitrine")
        .update({
          preco_pix: Number(editVitrinePrecoPix),
          preco_cartao: Number(editVitrinePrecoCartao),
          max_parcelas: Number(editVitrineMaxParcelas),
          ativo: editVitrineAtivo,
        })
        .eq("id", editingVitrineItem.id);
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

  const handleGenerateAsaas = async (type: 'PIX' | 'BOLETO') => {
    if (!selectedParcela || !id) return;
    setIsGeneratingAsaas(true);
    try {
      const response = await generateAsaasCobrar(selectedParcela.id, type);

      if (response.error) {
        throw new Error(response.error);
      }

      const { payment, pixData, updateParcela } = response;
      
      // Mapear campos para garantir que o modal exiba corretamente
      const result = { 
        ...payment, 
        pixData,
        // Priorizar o campo identificationField da consulta detalhada
        identificationField: updateParcela?.asaas_barcode || payment.identificationField || payment.fullCycleCode,
        bankSlipUrl: updateParcela?.asaas_url || payment.bankSlipUrl || payment.invoiceUrl
      };

      setAsaasResult(result);
      setShowAsaasModal(false);
      setShowAsaasResultModal(true);
      qc.invalidateQueries({ queryKey: ["aluno-parcelas", id] });
      qc.invalidateQueries({ queryKey: ["aluno", id] });
      toast.success("Cobrança gerada no Asaas!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsGeneratingAsaas(false);
    }
  };

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
    const senhaGerada = '123' + primeiroNome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(' ')[0];
      
    const text = `*SEJA BEM VINDO*\n\n` +
                 `Gostaríamos de dar as Boas Vindas e que você seja bem vindo(a) a nossa Escola.\n` +
                 `Abaixo segue o seu Login e Senha para assistir as aulas do seu Preparatório e acesso as Apostilas.\n\n` +
                 `*Login:* ${aluno.ctr}\n` +
                 `*Senha:* ${senhaGerada}\n\n` +
                 `Suas aulas já estão liberadas para assistir.\n` +
                 `Agora basta acessar o Link abaixo e colocar seu Login e Senha.\n\n` +
                 `Segue abaixo o link de acesso a Plataforma da Escola Soluções Online\n` +
                 `https://sistemasolucoesonline.lovable.app/aluno/login`;
    
    navigator.clipboard.writeText(text);
    toast.success("Dados copiados para a área de transferência!");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!aluno) return <p className="text-muted-foreground">Aluno não encontrado.</p>;

  return (
    <div>
      <PageHeader
        title={`${aluno.nome} | CTR #${aluno.ctr}`}
        description={aluno.email ?? "Sem e-mail"}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/alunos">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Link>
            </Button>
            <Button 
              variant="outline" 
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
              onClick={handleCopyAccessData}
            >
              {copied ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Key className="h-4 w-4 mr-2" />}
              {copied ? "Copiado!" : "Copiar dados de acesso"}
            </Button>
            <Button 
              variant="outline" 
              className="border-green-500 text-green-600 hover:bg-green-50"
              onClick={() => {
                if (!aluno) return;
                const primeiroNome = aluno.nome.split(" ")[0];
                const senhaGerada = '123' + primeiroNome
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .split(' ')[0];
                  
                const text = `*SEJA BEM VINDO*\n\n` +
                             `Gostaríamos de dar as Boas Vindas e que você seja bem vindo(a) a nossa Escola.\n` +
                             `Abaixo segue o seu Login e Senha para assistir as aulas do seu Preparatório e acesso as Apostilas.\n\n` +
                             `*Login:* ${aluno.ctr}\n` +
                             `*Senha:* ${senhaGerada}\n\n` +
                             `Suas aulas já estão liberadas para assistir.\n` +
                             `Agora basta acessar o Link abaixo e colocar seu Login e Senha.\n\n` +
                             `Segue abaixo o link de acesso a Plataforma da Escola Soluções Online\n` +
                             `https://sistemasolucoesonline.lovable.app/aluno/login`;
                
                const phone = aluno.telefone?.replace(/\D/g, "");
                window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, "_blank");
              }}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Enviar por WhatsApp
            </Button>
            <Button variant="outline" onClick={() => setShowResetDefaultModal(true)}>
              <Key className="h-4 w-4 mr-2" />
              Redefinir Senha Padrão
            </Button>
            <Button asChild>
              <Link to="/alunos/$id/editar" params={{ id }}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Dados cadastrais
                {aluno.ativo ? (
                  <Badge className="bg-accent text-accent-foreground hover:bg-accent">Ativo</Badge>
                ) : (
                  <Badge variant="secondary">Inativo</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Telefone" value={aluno.telefone} />
              <Info label="Sexo" value={aluno.sexo} />
              <Info label="CPF" value={aluno.cpf} />
              <Info label="Nascimento" value={formatDate(aluno.data_nascimento)} />
              <Info label="Menor de idade" value={aluno.menor_de_idade ? "Sim" : "Não"} />
              <Info label="Como nos conheceu" value={aluno.origem_detalhe ? `${aluno.origem} (${aluno.origem_detalhe})` : aluno.origem} />
              <Info label="Vendedora" value={aluno.vendedora} />
              <Info label="Cadastrado em" value={formatDate(aluno.created_at)} />
              {aluno.menor_de_idade && (
                <>
                  <div className="col-span-2 mt-4 pt-4 border-t">
                    <h3 className="font-semibold mb-3">Responsável</h3>
                  </div>
                  <Info label="Nome" value={aluno.responsavel_nome} />
                  <Info label="Telefone" value={aluno.responsavel_telefone} />
                  <Info label="CPF" value={aluno.responsavel_cpf} />
                  <Info label="E-mail" value={aluno.responsavel_email} />
                </>
              )}
            </CardContent>
          </Card>

          {aluno.observacao && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{aluno.observacao}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="sticky top-5 max-h-screen overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                Cursos liberados
                <Button size="sm" variant="outline" disabled title="Em breve">
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Matricular
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!cursos || cursos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum curso liberado.</p>
              ) : (
                <ul className="space-y-2">
                  {cursos.map((c, i) => {
                    const curso = c.cursos as { id: string; nome: string; descricao: string | null } | null;
                    if (!curso) return null;
                    return (
                      <li key={i} className="p-3 rounded-md border">
                        <p className="font-medium text-sm">{curso.nome}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Liberado em {formatDate(c.data_liberacao)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      <div className="mt-8 space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          Financeiro
        </h2>

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <p className="text-sm text-green-700 font-medium">Total Pago</p>
              <p className="text-2xl font-black text-green-900">R$ {totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="pt-6">
              <p className="text-sm text-yellow-700 font-medium">Total em Aberto</p>
              <p className="text-2xl font-black text-yellow-900">R$ {totalAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <p className="text-sm text-primary font-medium">Total Geral</p>
              <p className="text-2xl font-black text-primary">R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Mensalidades / Parcelas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">Nº</th>
                    <th className="text-left py-2 font-medium">Descrição</th>
                    <th className="text-left py-2 font-medium">Forma Pag.</th>
                    <th className="text-left py-2 font-medium">Vencimento</th>
                    <th className="text-left py-2 font-medium">Valor</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-right py-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelas?.map((p) => {
                    const isVencido = p.status === 'aberto' && isBefore(startOfDay(new Date(p.data_vencimento)), startOfDay(new Date()));
                    const description = p.tipo === 'taxa_matricula' ? 'Taxa de Matrícula' : 'Parcela';
                    const number = p.tipo === 'taxa_matricula' ? '-' : p.numero;
                    
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-4 font-medium flex items-center gap-2">
                          {number}
                          {p.asaas_id ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] px-1 h-4">Asaas</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1 h-4">Carnê</Badge>
                          )}
                        </td>
                        <td className="py-4">{description}</td>
                        <td className="py-4">
                          {p.status === 'pago' && p.forma_pagamento && (
                            <Badge 
                              className={cn(
                                "font-bold",
                                p.forma_pagamento === 'boleto' ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
                                p.forma_pagamento === 'pix' ? "bg-green-100 text-green-700 hover:bg-green-100" :
                                "bg-purple-100 text-purple-700 hover:bg-purple-100"
                              )}
                            >
                              {p.forma_pagamento === 'boleto' ? 'Boleto' : 
                               p.forma_pagamento === 'pix' ? 'PIX' : 
                               `Cartão ${p.parcelas_cartao}x`}
                            </Badge>
                          )}
                        </td>
                        <td className="py-4">{formatDate(p.data_vencimento)}</td>
                        <td className="py-4 font-bold">
                          {p.forma_pagamento === 'cartao' && p.valor_liquido ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground line-through">{formatCurrency(p.valor)}</span>
                              <span className="text-green-600">{formatCurrency(p.valor_liquido)}</span>
                            </div>
                          ) : (
                            formatCurrency(p.valor)
                          )}
                        </td>
                        <td className="py-4">
                          <div className="flex flex-wrap gap-1">
                            <Badge 
                              variant="secondary"
                              className={cn(
                                p.status === 'pago' ? "bg-green-100 text-green-800 border-green-200" :
                                p.status === 'isento' ? "bg-gray-100 text-gray-700 border-gray-200" :
                                isVencido ? "bg-red-100 text-red-800 border-red-200" :
                                "bg-yellow-100 text-yellow-800 border-yellow-200"
                              )}
                            >
                              {p.status === 'pago' ? 'Pago' : p.status === 'isento' ? 'Isento' : isVencido ? 'Vencido' : 'Aberto'}
                              {isVencido && <AlertCircle className="h-3 w-3 ml-1 inline" />}
                            </Badge>
                            
                            <Badge variant="outline" className={cn(
                              p.asaas_id ? "border-purple-200 text-purple-700 bg-purple-50" : "border-blue-200 text-blue-700 bg-blue-50"
                            )}>
                              {p.asaas_id ? 'Asaas' : 'Carnê'}
                            </Badge>

                            {p.descricao?.includes('(Negociado)') && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                                Negociado
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {p.status === 'aberto' && !p.asaas_id && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => {
                                  setSelectedParcela(p);
                                  setShowAsaasModal(true);
                                }}
                              >
                                <Receipt className="h-4 w-4 mr-1" />
                                Asaas
                              </Button>
                            )}
                            {p.asaas_id && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-purple-600 border-purple-200 hover:bg-purple-50"
                                onClick={async () => {
                                  setIsFetchingAsaas(p.id);
                                  try {
                                    const response = await generateAsaasCobrar(p.id, null, 'fetch');
                                    if (response.error) throw new Error(response.error);
                                    
                                    const { payment, pixData, updateParcela } = response;
                                    setAsaasResult({
                                      id: payment.id,
                                      invoiceUrl: payment.invoiceUrl,
                                      bankSlipUrl: updateParcela?.asaas_url || payment.bankSlipUrl,
                                      pixData,
                                      identificationField: updateParcela?.asaas_barcode || payment.identificationField || payment.fullCycleCode,
                                      value: payment.value,
                                      dueDate: payment.dueDate,
                                      description: payment.description
                                    });
                                    setShowAsaasResultModal(true);
                                    qc.invalidateQueries({ queryKey: ["aluno-parcelas", id] });
                                  } catch (error: any) {
                                    toast.error("Erro ao carregar cobrança: " + error.message);
                                  } finally {
                                    setIsFetchingAsaas(null);
                                  }
                                }}
                                disabled={isFetchingAsaas === p.id}
                              >
                                {isFetchingAsaas === p.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Receipt className="h-4 w-4 mr-1" />}
                                Cobrança
                              </Button>
                            )}
                            {p.status === 'aberto' && (
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => {
                                  setSelectedParcelaId(p.id);
                                  setSelectedParcelaValor(Number(p.valor));
                                  setShowBaixaModal(true);
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Baixa
                              </Button>
                            )}
                          </div>
                          {p.status === 'pago' && (
                            <span className="text-xs text-muted-foreground flex items-center justify-end">
                              Pago em {formatDate(p.data_pagamento)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!isLoading && (!parcelas || parcelas.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        Nenhuma parcela gerada para este aluno.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <BaixaModal 
        open={showBaixaModal}
        onOpenChange={setShowBaixaModal}
        isLoading={darBaixa.isPending}
        valorOriginal={selectedParcelaValor}
        onConfirm={(data) => darBaixa.mutate(data)}
      />

      <ResumoBaixaModal 
        open={!!resumoBaixa}
        onOpenChange={(open) => !open && setResumoBaixa(null)}
        data={resumoBaixa}
      />

      <Dialog open={showResetDefaultModal} onOpenChange={setShowResetDefaultModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Redefinição</DialogTitle>
            <DialogDescription>
              Deseja redefinir a senha de <strong>{aluno.nome}</strong> para a senha padrão?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              Senha padrão que será definida: <code className="bg-muted px-1 rounded">123{aluno.nome.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}</code>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDefaultModal(false)}>Cancelar</Button>
            <Button 
              onClick={() => resetToDefaultPassword.mutate()}
              disabled={resetToDefaultPassword.isPending}
            >
              {resetToDefaultPassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordResult} onOpenChange={setShowPasswordResult}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Senha redefinida com sucesso!</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Login:</span>
                <span className="text-sm font-bold">{aluno.ctr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Nova senha:</span>
                <span className="text-sm font-bold text-primary">{passwordToDisplay}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              className="w-full" 
              onClick={() => {
                const text = `*SEJA BEM VINDO*\n\n` +
                             `Gostaríamos de dar as Boas Vindas e que você seja bem vindo(a) a nossa Escola.\n` +
                             `Abaixo segue o seu Login e Senha para assistir as aulas do seu Preparatório e acesso as Apostilas.\n\n` +
                             `*Login:* ${aluno.ctr}\n` +
                             `*Senha:* ${passwordToDisplay}\n\n` +
                             `Suas aulas já estão liberadas para assistir.\n` +
                             `Agora basta acessar o Link abaixo e colocar seu Login e Senha.\n\n` +
                             `Segue abaixo o link de acesso a Plataforma da Escola Soluções Online\n` +
                             `https://sistemasolucoesonline.lovable.app/aluno/login`;
                navigator.clipboard.writeText(text);
                toast.success("Dados copiados!");
              }}
            >
              <Copy className="h-4 w-4 mr-2" /> Copiar dados
            </Button>
            <Button 
              className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white" 
              onClick={() => {
                const text = `*SEJA BEM VINDO*\n\n` +
                             `Gostaríamos de dar as Boas Vindas e que você seja bem vindo(a) a nossa Escola.\n` +
                             `Abaixo segue o seu Login e Senha para assistir as aulas do seu Preparatório e acesso as Apostilas.\n\n` +
                             `*Login:* ${aluno.ctr}\n` +
                             `*Senha:* ${passwordToDisplay}\n\n` +
                             `Suas aulas já estão liberadas para assistir.\n` +
                             `Agora basta acessar o Link abaixo e colocar seu Login e Senha.\n\n` +
                             `Segue abaixo o link de acesso a Plataforma da Escola Soluções Online\n` +
                             `https://sistemasolucoesonline.lovable.app/aluno/login`;
                const phone = aluno.telefone?.replace(/\D/g, "");
                window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, "_blank");
              }}
            >
              <MessageSquare className="h-4 w-4 mr-2" /> WhatsApp
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setShowPasswordResult(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="mt-12 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Lock className="h-6 w-6 text-primary" />
            🔒 Vitrine de Cursos
          </h2>
          <p className="text-sm text-muted-foreground">
            Cursos bloqueados visíveis para o aluno na área de membros
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setShowVitrineModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar curso à vitrine
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!vitrine || vitrine.length === 0 ? (
            <div className="col-span-full">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center py-8 text-muted-foreground">Nenhum curso na vitrine deste aluno.</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            vitrine.map((item) => (
              <Card key={item.id} className="relative group">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📚</span>
                        <h3 className="font-bold text-gray-900">{(item.cursos as any)?.nome}</h3>
                        {!item.ativo && <Badge variant="secondary" className="text-[10px] h-5">Inativo</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        PIX: <span className="font-semibold">{formatCurrency(item.preco_pix)}</span> | 
                        Cartão: <span className="font-semibold">até {item.max_parcelas}x</span>
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => {
                          setEditingVitrineItem(item);
                          setEditVitrinePrecoPix(item.preco_pix?.toString() || "");
                          setEditVitrinePrecoCartao(item.preco_cartao?.toString() || "");
                          setEditVitrineMaxParcelas(item.max_parcelas?.toString() || "12");
                          setEditVitrineAtivo(item.ativo ?? true);
                          setShowEditVitrineModal(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (confirm("Deseja remover este curso da vitrine?")) {
                            removeFromVitrine.mutate(item.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={showVitrineModal} onOpenChange={setShowVitrineModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Curso à Vitrine</DialogTitle>
            <DialogDescription>
              Escolha um curso e defina os preços personalizados para este aluno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Curso</Label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={vitrineCursoId}
                onChange={(e) => setVitrineCursoId(e.target.value)}
              >
                <option value="">Selecione um curso...</option>
                {allCourses?.filter(c => 
                  !cursos?.some(mc => (mc.cursos as any)?.id === c.id) && 
                  !vitrine?.some(v => v.curso_id === c.id)
                ).map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preço PIX</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={vitrinePrecoPix}
                  onChange={(e) => setVitrinePrecoPix(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Preço Cartão</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={vitrinePrecoCartao}
                  onChange={(e) => setVitrinePrecoCartao(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Máx. parcelas</Label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={vitrineMaxParcelas}
                onChange={(e) => setVitrineMaxParcelas(e.target.value)}
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}x</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVitrineModal(false)}>Cancelar</Button>
            <Button 
              onClick={() => addToVitrine.mutate()}
              disabled={addToVitrine.isPending || !vitrineCursoId || !vitrinePrecoPix || !vitrinePrecoCartao}
            >
              {addToVitrine.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showEditVitrineModal} onOpenChange={setShowEditVitrineModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Vitrine</DialogTitle>
            <DialogDescription>
              Ajuste as configurações do curso na vitrine deste aluno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Curso</Label>
              <Input 
                value={(editingVitrineItem?.cursos as any)?.nome || ""} 
                disabled 
                className="bg-muted"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preço PIX</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={editVitrinePrecoPix}
                  onChange={(e) => setEditVitrinePrecoPix(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Preço Cartão</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={editVitrinePrecoCartao}
                  onChange={(e) => setEditVitrinePrecoCartao(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Máx. parcelas</Label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={editVitrineMaxParcelas}
                onChange={(e) => setEditVitrineMaxParcelas(e.target.value)}
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}x</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Status do Curso</Label>
                <p className="text-xs text-muted-foreground">
                  {editVitrineAtivo ? "Visível na vitrine do aluno" : "Oculto na vitrine do aluno"}
                </p>
              </div>
              <Switch 
                checked={editVitrineAtivo}
                onCheckedChange={setEditVitrineAtivo}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditVitrineModal(false)}>Cancelar</Button>
            <Button 
              onClick={() => updateVitrine.mutate()}
              disabled={updateVitrine.isPending || !editVitrinePrecoPix || !editVitrinePrecoCartao}
            >
              {updateVitrine.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAsaasModal} onOpenChange={setShowAsaasModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar cobrança no Asaas</DialogTitle>
            <DialogDescription>
              Escolha a forma de cobrança para "{selectedParcela?.descricao || (selectedParcela?.tipo === 'taxa_matricula' ? 'Taxa de Matrícula' : `Parcela ${selectedParcela?.numero}`)}".
            </DialogDescription>
          </DialogHeader>
          {!aluno?.asaas_customer_id && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4 flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-amber-900">ID Asaas Ausente</p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  O sistema tentará criar o cliente automaticamente ao clicar nos botões abaixo, 
                  mas certifique-se de que o CPF e E-mail do aluno estão preenchidos corretamente.
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button 
              variant="outline" 
              className="h-24 flex flex-col gap-2 border-green-200 hover:bg-green-50 hover:text-green-700"
              onClick={() => handleGenerateAsaas('PIX')}
              disabled={isGeneratingAsaas}
            >
              <span className="text-2xl">💠</span>
              <span className="font-bold">PIX</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex flex-col gap-2 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              onClick={() => handleGenerateAsaas('BOLETO')}
              disabled={isGeneratingAsaas}
            >
              <span className="text-2xl">🏦</span>
              <span className="font-bold">Boleto</span>
            </Button>
          </div>
          {isGeneratingAsaas && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando cobrança no Asaas...
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAsaasResultModal} onOpenChange={setShowAsaasResultModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {asaasResult?.pixData ? '💠 PIX Gerado!' : '🏦 Boleto Gerado!'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {asaasResult?.pixData ? (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-xl border-2 border-green-100">
                  <QRCodeSVG value={asaasResult.pixData.payload} size={200} />
                </div>
                <div className="w-full space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={asaasResult.pixData.payload} className="text-xs font-mono bg-muted" />
                    <Button size="icon" onClick={() => {
                      navigator.clipboard.writeText(asaasResult.pixData.payload);
                      toast.success("Chave PIX copiada!");
                    }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-full space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Código de barras</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={asaasResult?.identificationField || ""} className="text-xs font-mono bg-muted" />
                    <Button size="icon" onClick={() => {
                      navigator.clipboard.writeText(asaasResult?.identificationField || "");
                      toast.success("Código de barras copiado!");
                    }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => {
                      if (asaasResult?.bankSlipUrl) {
                        window.open(asaasResult.bankSlipUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    Ver PDF do Boleto
                  </Button>
                  <a 
                    href={asaasResult?.bankSlipUrl || "#"} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-center text-xs text-blue-500 hover:underline"
                  >
                    Clique aqui se o PDF não abrir
                  </a>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t text-sm">
              <div>
                <p className="text-muted-foreground">Vencimento</p>
                <p className="font-bold">{formatDate(asaasResult?.dueDate)}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Valor</p>
                <p className="font-bold text-lg">{formatCurrency(asaasResult?.value || 0)}</p>
              </div>
            </div>

            <Button 
              className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold gap-2"
              onClick={() => {
                const message = `Olá ${aluno?.nome}! Segue seu ${asaasResult?.pixData ? 'PIX' : 'boleto'}:\n\n${asaasResult?.pixData ? asaasResult.pixData.payload : asaasResult?.bankSlipUrl}\n\nVencimento: ${formatDate(asaasResult?.dueDate)}\nValor: ${formatCurrency(asaasResult?.value || 0)}`;
                window.open(`https://wa.me/55${aluno?.telefone?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
              }}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Enviar por WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
