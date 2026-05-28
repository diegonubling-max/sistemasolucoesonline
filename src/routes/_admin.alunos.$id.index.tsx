import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, GraduationCap, Key, Loader2, Wallet, Calendar as CalendarIcon, CheckCircle2, AlertCircle, ShoppingBag, Plus, Trash2, Lock } from "lucide-react";
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
  const [selectedParcelaValor, setSelectedParcelaValor] = useState<number>(0);
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
      
    const text = `Olá ${primeiroNome}! Seus dados de acesso:
Login: ${aluno.ctr}
Senha: ${senhaGerada}
Acesse: https://sistemasolucoesonline.lovable.app/aluno/login`;
    
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
                        <td className="py-4 font-medium">{number}</td>
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
                        </td>
                        <td className="py-4 text-right">
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
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Dar baixa
                            </Button>
                          )}
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
                const text = `Olá ${aluno.nome.split(" ")[0]}! Seus dados de acesso:
Login: ${aluno.ctr}
Senha: ${passwordToDisplay}
Acesse: https://sistemasolucoesonline.lovable.app/aluno/login`;
                navigator.clipboard.writeText(text);
                toast.success("Dados copiados!");
              }}
            >
              Copiar dados
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
                      </div>
                      <p className="text-sm text-muted-foreground">
                        PIX: <span className="font-semibold">{formatCurrency(item.preco_pix)}</span> | 
                        Cartão: <span className="font-semibold">até {item.max_parcelas}x</span>
                      </p>
                    </div>
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
