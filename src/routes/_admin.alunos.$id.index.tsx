import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, GraduationCap, Key, Loader2, Wallet, Calendar as CalendarIcon, CheckCircle2, AlertCircle, ShoppingBag, Plus, Trash2, Lock, Receipt, Copy, MessageSquare, History, Clock, BookOpen, PlayCircle, LogIn, LogOut as LogOutIcon, FileCheck, FileText, MoreHorizontal, Sparkles, Eye, Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
import { Textarea } from "@/components/ui/textarea";
import { BaixaModal } from "@/components/admin/BaixaModal";
import { ResumoBaixaModal } from "@/components/admin/ResumoBaixaModal";
import { HistoricoPagamentosModal } from "@/components/admin/HistoricoPagamentosModal";
import { formatCurrency } from "@/lib/format";
import { Switch } from "@/components/ui/switch";
import { generateAsaasCobrar, asaasRequest } from "@/services/asaas";
import { QRCodeSVG } from "qrcode.react";
import declaracaoTemplate from "@/templates/declaracao-matricula.html?raw";
import { ProgressoAulas } from "@/components/admin/alunos/ProgressoAulas";

import { MensagensTab } from "@/components/admin/alunos/MensagensTab";
import { TrocarPacoteModal } from "@/components/admin/TrocarPacoteModal";

import { StatusAlunoBadge, type AlunoStatus } from "@/lib/aluno-status";
import { notifyPagamentoRecebido } from "@/lib/notify";


export const Route = createFileRoute("/_admin/alunos/$id/")({
  head: () => ({ meta: [{ title: "Aluno — Soluções Online" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: AlunoDetalhes,
});

function AlunoDetalhes() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { tab: initialTab } = Route.useSearch();
  const [showResetDefaultModal, setShowResetDefaultModal] = useState(false);
  const [showPasswordResult, setShowPasswordResult] = useState(false);
  const [showBaixaModal, setShowBaixaModal] = useState(false);
  const [showVitrineModal, setShowVitrineModal] = useState(false);
  const [showTrocarPacote, setShowTrocarPacote] = useState(false);
  const [showEditVitrineModal, setShowEditVitrineModal] = useState(false);
  const [editingVitrineItem, setEditingVitrineItem] = useState<any>(null);
  const [selectedParcelaId, setSelectedParcelaId] = useState<string | null>(null);
  const [selectedParcela, setSelectedParcela] = useState<any>(null);
  const [selectedParcelaValor, setSelectedParcelaValor] = useState<number>(0);
  const [selectedParcelaPagoAtual, setSelectedParcelaPagoAtual] = useState<number>(0);
  const [historicoParcelaId, setHistoricoParcelaId] = useState<string | null>(null);
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
  const [vitrinePrecoNormal, setVitrinePrecoNormal] = useState("");
  const [vitrinePrecoComPontos, setVitrinePrecoComPontos] = useState("");
  const [vitrinePontosNecessarios, setVitrinePontosNecessarios] = useState("300");
  const [vitrineValorPixDesconto, setVitrineValorPixDesconto] = useState("");
  const [vitrineValorCartaoDesconto, setVitrineValorCartaoDesconto] = useState("");
  const [vitrinePontosDesconto, setVitrinePontosDesconto] = useState("");
  const [vitrineFiltroSegmento, setVitrineFiltroSegmento] = useState<string>("todos");
  const [vitrineFiltroSegmentoInit, setVitrineFiltroSegmentoInit] = useState(false);
  const [editVitrinePrecoPix, setEditVitrinePrecoPix] = useState("");
  const [editVitrinePrecoCartao, setEditVitrinePrecoCartao] = useState("");
  const [editVitrineValorPixDesconto, setEditVitrineValorPixDesconto] = useState("");
  const [editVitrineValorCartaoDesconto, setEditVitrineValorCartaoDesconto] = useState("");
  const [editVitrinePontosDesconto, setEditVitrinePontosDesconto] = useState("");
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

  const { data: milhas } = useQuery({
    queryKey: ["aluno-milhas", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("milhas_eja")
        .select("pontos_total, pontos_disponiveis, nivel")
        .eq("aluno_id", id)
        .maybeSingle();
      return data;
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
    queryKey: ["all-courses-with-segmento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select("id, nome, segmento_id, segmentos(nome)")
        .order("nome");
      if (error) throw error;
      return (data ?? []).filter((c: any) => (c.segmentos as any)?.nome !== "Curso Preparatório");
    },
  });

  const { data: perfilVocacional } = useQuery({
    queryKey: ["aluno-perfil-vocacional-vitrine", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("aluno_perfil_vocacional")
        .select("segmentos_recomendados, perfil_identificado, created_at")
        .eq("aluno_id", id)
        .maybeSingle();
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
      const dataExtenso = `${hoje.getDate().toString().padStart(2, '0')} de ${hoje.toLocaleString('pt-BR', { month: 'long' })} de ${hoje.getFullYear()}`;

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
      valor_pago: number;
      parcelas_cartao?: number;
      taxa_cartao?: number;
      valor_liquido?: number;
    }) => {
      if (!selectedParcelaId) return;
      const { data: res, error } = await supabase.rpc("registrar_pagamento_parcela", {
        p_parcela_id: selectedParcelaId,
        p_valor_pago: data.valor_pago,
        p_data_pagamento: data.data_pagamento,
        p_forma_pagamento: data.forma_pagamento,
        p_parcelas_cartao: data.parcelas_cartao ?? undefined,
        p_taxa_cartao: data.taxa_cartao ?? undefined,
        p_valor_liquido: data.valor_liquido ?? undefined,
        p_observacao: undefined,
      });
      if (error) throw error;
      const resObj = res as { status: string; restante: number } | null;
      if (resObj?.status === "pago") {
        notifyPagamentoRecebido(selectedParcelaId, selectedParcelaValor, data.forma_pagamento);

        // Gera comissão automaticamente apenas na baixa TOTAL da Parcela 1
        try {
          const { data: parcela } = await supabase
            .from("parcelas")
            .select("tipo, numero, matricula_id")
            .eq("id", selectedParcelaId)
            .single();

          if (parcela && parcela.tipo === "parcela" && parcela.numero === 1 && parcela.matricula_id) {
            const { data: matricula } = await supabase
              .from("matriculas")
              .select("aluno_id, colaborador_id")
              .eq("id", parcela.matricula_id)
              .single();

            if (matricula?.colaborador_id) {
              const { count } = await supabase
                .from("comissoes")
                .select("id", { count: "exact", head: true })
                .eq("matricula_id", parcela.matricula_id);

              if ((count ?? 0) === 0) {
                const { data: colaborador } = await supabase
                  .from("colaboradores")
                  .select("nome, comissao_avista, comissao_parcelado")
                  .eq("id", matricula.colaborador_id)
                  .single();

                if (colaborador?.nome) {
                  const tipo = data.forma_pagamento === "boleto" ? "boleto" : "avista";
                  const valor = tipo === "boleto"
                    ? Number(colaborador.comissao_parcelado ?? 50)
                    : Number(colaborador.comissao_avista ?? 120);

                  await supabase.from("comissoes").insert({
                    aluno_id: matricula.aluno_id,
                    matricula_id: parcela.matricula_id,
                    vendedora: colaborador.nome,
                    valor,
                    status: "pendente",
                    competencia: data.data_pagamento,
                    tipo_pagamento: tipo,
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error("Erro ao gerar comissão:", err);
        }
      }
      return { ...data, _result: resObj };
    },
    onSuccess: (data: any) => {
      const isParcial = data._result?.status === "parcial";
      if (isParcial) {
        toast.success(`Pagamento parcial registrado. Restante: R$ ${Number(data._result.restante).toFixed(2)}`);
      } else if (data.forma_pagamento === 'cartao') {
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

  const excluirParcela = useMutation({
    mutationFn: async (parcela: any) => {
      if (parcela.asaas_id) {
        try {
          await asaasRequest(`/payments/${parcela.asaas_id}`, { method: 'DELETE' });
        } catch (err) {
          console.error("Falha ao cancelar cobrança no Asaas:", err);
        }
      }
      const { error } = await supabase.from("parcelas").delete().eq("id", parcela.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parcela excluída com sucesso!");
      qc.invalidateQueries({ queryKey: ["aluno-parcelas", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const resetToDefaultPassword = useMutation({
    mutationFn: async (notify: boolean) => {
      if (!aluno?.email || !aluno?.nome) return;
      const primeiroNomeRaw = aluno.nome.split(' ')[0] ?? '';
      const primeiroNomeLower = primeiroNomeRaw.toLowerCase();
      const primeiroNomeCap = primeiroNomeRaw.charAt(0).toUpperCase() + primeiroNomeRaw.slice(1).toLowerCase();
      const senhaPadrao = `1234${primeiroNomeLower}`;
      const { error } = await supabase.rpc('redefinir_senha_aluno', {
        p_email: aluno.email,
        p_nova_senha: senhaPadrao,
      });
      if (error) throw error;
      if (notify && aluno.telefone) {
        try {
          const mensagem =
            `*🔐 Soluções Online — Senha redefinida!*\n\n` +
            `Olá, *${primeiroNomeCap}*! Sua senha foi redefinida com sucesso.\n\n` +
            `📋 *Login:* ${aluno.ctr}\n` +
            `🔑 *Nova senha:* ${senhaPadrao}\n\n` +
            `👉 Acesse: https://sistemasolucoesonline.lovable.app/aluno/login`;
          const { sendWhatsApp } = await import("@/services/zApiService");
          await sendWhatsApp(aluno.telefone, mensagem, { alunoId: aluno.id, tipo: "redefinicao_senha" });

        } catch (err) {
          console.error("Falha ao notificar aluno via WhatsApp:", err);
        }
      }
      return { senhaPadrao, notified: notify };
    },
    onSuccess: (res) => {
      if (!res) return;
      toast.success(res.notified ? "Senha redefinida e aluno notificado via WhatsApp!" : "Senha redefinida!");
      setPasswordToDisplay(res.senhaPadrao);
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
        valor_pix: Number(vitrinePrecoPix),
        valor_cartao: Number(vitrinePrecoCartao),
        valor_pix_desconto: vitrineValorPixDesconto ? Number(vitrineValorPixDesconto) : null,
        valor_cartao_desconto: vitrineValorCartaoDesconto ? Number(vitrineValorCartaoDesconto) : null,
        pontos_desconto: vitrinePontosDesconto ? Number(vitrinePontosDesconto) : null,
        max_parcelas: Number(vitrineMaxParcelas),
        preco_normal: vitrinePrecoNormal ? Number(vitrinePrecoNormal) : null,
        preco_com_pontos: vitrinePrecoComPontos ? Number(vitrinePrecoComPontos) : null,
        pontos_necessarios: vitrinePontosNecessarios ? Number(vitrinePontosNecessarios) : 300,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Curso adicionado à vitrine!");
      setShowVitrineModal(false);
      setVitrineCursoId("");
      setVitrinePrecoPix("");
      setVitrinePrecoCartao("");
      setVitrineMaxParcelas("12");
      setVitrinePrecoNormal("");
      setVitrinePrecoComPontos("");
      setVitrinePontosNecessarios("300");
      setVitrineValorPixDesconto("");
      setVitrineValorCartaoDesconto("");
      setVitrinePontosDesconto("");
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
        valor_pix: Number(editVitrinePrecoPix),
        valor_cartao: Number(editVitrinePrecoCartao),
        valor_pix_desconto: editVitrineValorPixDesconto ? Number(editVitrineValorPixDesconto) : null,
        valor_cartao_desconto: editVitrineValorCartaoDesconto ? Number(editVitrineValorCartaoDesconto) : null,
        pontos_desconto: editVitrinePontosDesconto ? Number(editVitrinePontosDesconto) : null,
        max_parcelas: Number(editVitrineMaxParcelas),
        ativo: editVitrineAtivo,
      } as never).eq("id", editingVitrineItem.id);
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

  const totalPago = parcelas?.reduce((acc, p) => {
    if (p.status === 'pago') {
      const isCartao = p.forma_pagamento === 'cartao';
      return acc + (isCartao && p.valor_liquido ? Number(p.valor_liquido) : Number(p.valor));
    }
    if (p.status === 'parcial') {
      return acc + Number((p as any).valor_pago_total || 0);
    }
    return acc;
  }, 0) || 0;
  const totalAberto = parcelas?.reduce((acc, p) => {
    if (p.status === 'aberto') return acc + Number(p.valor);
    if (p.status === 'parcial') return acc + (Number(p.valor) - Number((p as any).valor_pago_total || 0));
    return acc;
  }, 0) || 0;
  const totalGeral = parcelas?.filter(p => p.status !== 'isento').reduce((acc, p) => acc + Number(p.valor), 0) || 0;

  const [sendingAccess, setSendingAccess] = useState(false);

  const handleResendAccess = async () => {
    if (!aluno) return;
    if (!aluno.telefone) {
      toast.error("Aluno sem telefone cadastrado.");
      return;
    }
    try {
      setSendingAccess(true);
      const primeiroNomeRaw = aluno.nome.split(" ")[0] ?? "";
      const primeiroNomeLower = primeiroNomeRaw.toLowerCase();
      const primeiroNomeCap = primeiroNomeRaw.charAt(0).toUpperCase() + primeiroNomeRaw.slice(1).toLowerCase();
      const senha = `1234${primeiroNomeLower}`;
      const mensagem =
        `*🔐 Soluções Online — Seus dados de acesso:*\n\n` +
        `Olá, *${primeiroNomeCap}*! Segue seus dados de acesso à área de estudos:\n\n` +
        `📋 *Login:* ${aluno.ctr}\n` +
        `🔑 *Senha:* ${senha}\n\n` +
        `👉 Acesse em: https://sistemasolucoesonline.lovable.app/aluno/login\n\n` +
        `Qualquer dúvida estamos à disposição! 😊`;
      const { sendWhatsApp } = await import("@/services/zApiService");
      await sendWhatsApp(aluno.telefone, mensagem, { alunoId: aluno.id, tipo: "reenvio_acesso" });

      toast.success("Acesso reenviado via WhatsApp!");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao reenviar acesso.");
    } finally {
      setSendingAccess(false);
    }
  };

  const updateStatus = useMutation({
    mutationFn: async (args: { novo: AlunoStatus; motivo?: string }) => {
      const { novo, motivo } = args;
      const patch: any = { status: novo };
      if (novo === "trancado") patch.trancado_em = new Date().toISOString();
      if (novo === "formado") patch.formado_em = new Date().toISOString();
      if (novo === "inativo") patch.ativo = false;
      if (novo === "ativo") patch.ativo = true;
      if (novo === "inativo" && motivo && motivo.trim()) {
        const prev = (aluno as any)?.observacao ?? "";
        const stamp = new Date().toLocaleString("pt-BR");
        patch.observacao = `${prev ? prev + "\n" : ""}[Inativado em ${stamp}] ${motivo.trim()}`;
      }
      const { error } = await supabase.from("alunos").update(patch).eq("id", id);
      if (error) throw error;

      // Cascata ao inativar: cancelar parcelas em aberto e pós-vendas pendentes
      if (novo === "inativo") {
        const { data: mats } = await supabase.from("matriculas").select("id").eq("aluno_id", id);
        const matIds = (mats ?? []).map((m: any) => m.id);
        if (matIds.length) {
          await supabase
            .from("parcelas")
            .update({ status: "cancelado" })
            .in("matricula_id", matIds)
            .not("status", "in", "(pago,isento,cancelado)");
          await supabase
            .from("pos_vendas")
            .update({ status: "arquivado" })
            .in("matricula_id", matIds)
            .eq("status", "pendente");
        }
      }
    },
    onSuccess: (_d, args) => {
      toast.success(`Status atualizado para ${args.novo}`);
      qc.invalidateQueries({ queryKey: ["aluno", id] });
      qc.invalidateQueries({ queryKey: ["alunos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [showInativarDialog, setShowInativarDialog] = useState(false);
  const [showReativarDialog, setShowReativarDialog] = useState(false);
  const [motivoInativo, setMotivoInativo] = useState("");

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!aluno) return <p className="text-muted-foreground">Aluno não encontrado.</p>;

  const statusAtual = ((aluno as any).status ?? "ativo") as AlunoStatus;

  const continuarCadastro = async () => {
    try {
      const { data: ms } = await supabase
        .from("matriculas")
        .select("id")
        .eq("aluno_id", id)
        .order("created_at", { ascending: false })
        .limit(1);
      const matricula = ms && ms[0];
      if (!matricula) {
        navigate({ to: "/alunos/novo", search: { aluno: id, step: 2 } as any });
        return;
      }
      const { data: parcs } = await supabase
        .from("parcelas")
        .select("id")
        .eq("matricula_id", matricula.id)
        .limit(1);
      if (!parcs || parcs.length === 0) {
        navigate({ to: "/alunos/novo", search: { aluno: id, matricula: matricula.id, step: 3 } as any });
        return;
      }
      navigate({ to: "/alunos/novo", search: { aluno: id, matricula: matricula.id, step: 5 } as any });
    } catch (e: any) {
      toast.error(e.message);
    }
  };


  return (
    <div className="space-y-6 pb-20">
      {(aluno as any).cadastro_completo === false && (
        <div className="w-full bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 flex items-center gap-4 shadow-sm">
          <AlertCircle className="h-8 w-8 text-yellow-700 shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-yellow-900">⚠️ Cadastro incompleto</p>
            <p className="text-sm text-yellow-800">A matrícula deste aluno ainda não foi finalizada. Continue de onde parou.</p>
          </div>
          <Button onClick={continuarCadastro} className="bg-yellow-600 hover:bg-yellow-700 text-white shrink-0">
            Continuar Cadastro <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
          </Button>
        </div>
      )}


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
            <Button
              size="lg"
              onClick={() =>
                statusAtual === "inativo" ? setShowReativarDialog(true) : setShowInativarDialog(true)
              }
              className={cn(
                "rounded-full px-6 font-semibold text-white shadow-md",
                statusAtual === "inativo"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              )}
              disabled={updateStatus.isPending}
            >
              {statusAtual === "inativo" ? "⛔ Aluno Inativo" : "✅ Aluno Ativo"}
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleResendAccess} disabled={sendingAccess}>
              {sendingAccess ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              {sendingAccess ? "Enviando..." : "Reenviar acesso"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreHorizontal className="h-4 w-4 mr-2" /> Ações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setShowResetDefaultModal(true)}>
                  <Key className="h-4 w-4 mr-2" /> Redefinir Senha
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/alunos/$id/editar" params={{ id }}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => gerarDeclaracao.mutate()} disabled={gerarDeclaracao.isPending}>
                  <FileText className="h-4 w-4 mr-2" /> Gerar Declaração
                </DropdownMenuItem>
                {statusAtual !== "trancado" && statusAtual !== "formado" && statusAtual !== "inativo" && (
                  <DropdownMenuItem onClick={() => updateStatus.mutate({ novo: "trancado" })} disabled={updateStatus.isPending}>
                    <Lock className="h-4 w-4 mr-2" /> Trancar Matrícula
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {statusAtual !== "formado" && (
                  <DropdownMenuItem onClick={() => updateStatus.mutate({ novo: "formado" })} disabled={updateStatus.isPending}>
                    <GraduationCap className="h-4 w-4 mr-2" /> Marcar como Formado
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <Tabs defaultValue={initialTab || "geral"} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="geral">Dados Gerais</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="vitrine" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Vitrine
          </TabsTrigger>
          <TabsTrigger value="progresso">Progresso</TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="mensagens" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Mensagens
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
              {(() => {
                const total = milhas?.pontos_total ?? 0;
                const disp = milhas?.pontos_disponiveis ?? 0;
                const nivel = milhas?.nivel ?? "🌱 Iniciante";
                const tiers = [
                  { min: 0, max: 450, label: "🌱 Iniciante", next: 451 },
                  { min: 451, max: 700, label: "📚 Estudante", next: 701 },
                  { min: 701, max: 1200, label: "⭐ Dedicado", next: 1201 },
                  { min: 1201, max: Infinity, label: "🏆 Destaque", next: null as number | null },
                ];
                const tier = tiers.find((t) => total >= t.min && total <= t.max)!;
                const pct = tier.next ? Math.min(100, ((total - tier.min) / (tier.next - tier.min)) * 100) : 100;
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500" /> Milhas EJA
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {!milhas ? (
                        <p className="text-sm text-muted-foreground">0 pts — 🌱 Iniciante</p>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{nivel}</span>
                            <Badge variant="secondary">{disp} pts disponíveis</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{total} pts no total</p>
                          <Progress value={pct} />
                          <p className="text-[11px] text-muted-foreground">
                            {tier.next ? `${tier.next - total} pts para o próximo nível` : "Nível máximo atingido"}
                          </p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

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
          <div className="flex items-center justify-between gap-4">
            <div className="grid grid-cols-3 gap-4 flex-1">
              <Card className="bg-green-50"><CardContent className="pt-6"><p className="text-xs text-green-700">Pago</p><p className="text-xl font-bold">R$ {totalPago.toLocaleString("pt-BR")}</p></CardContent></Card>
              <Card className="bg-yellow-50"><CardContent className="pt-6"><p className="text-xs text-yellow-700">Aberto</p><p className="text-xl font-bold">R$ {totalAberto.toLocaleString("pt-BR")}</p></CardContent></Card>
              <Card className="bg-primary/5"><CardContent className="pt-6"><p className="text-xs text-primary">Geral</p><p className="text-xl font-bold">R$ {totalGeral.toLocaleString("pt-BR")}</p></CardContent></Card>
            </div>
            <Button variant="outline" onClick={() => setShowTrocarPacote(true)}>
              Trocar Pacote
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-2">Nº</th><th className="text-left py-2">Parcela</th><th className="text-left py-2">Vencimento</th><th className="text-left py-2">Valor</th><th className="text-left py-2">Status</th><th className="text-left py-2">Pago em</th><th className="text-right py-2">Ações</th></tr></thead>
                  <tbody>
                    {parcelas?.map((p) => {
                      const pagoTot = Number((p as any).valor_pago_total || 0);
                      const restante = Number(p.valor) - pagoTot;
                      const isParcial = p.status === 'parcial';
                      return (
                      <tr
                        key={p.id}
                        className={cn("border-b", isParcial && "cursor-pointer hover:bg-muted/30")}
                        onClick={() => isParcial && setHistoricoParcelaId(p.id)}
                      >
                        <td className="py-3 text-muted-foreground font-mono">{p.numero_parcela_id ?? '—'}</td>
                        <td className="py-3">{p.tipo === 'taxa_matricula' ? 'Matrícula' : `Parcela ${p.numero}`}</td>
                        <td className="py-3">{formatDate(p.data_vencimento)}</td>
                        <td className="py-3">
                          <div className="font-bold">{formatCurrency(p.valor)}</div>
                          {isParcial && (
                            <div className="text-[10px] text-muted-foreground">Pago: {formatCurrency(pagoTot)} · Restante: {formatCurrency(restante)}</div>
                          )}
                        </td>
                        <td className="py-3">
                          {p.status === 'pago' ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700">pago</Badge>
                          ) : p.status === 'parcial' ? (
                            <Badge className="bg-yellow-400 text-yellow-950">🟡 Parcial</Badge>
                          ) : (
                            <Badge variant="secondary">{p.status}</Badge>
                          )}
                        </td>
                        <td className="py-3">{(p as any).data_pagamento ? formatDate((p as any).data_pagamento) : '—'}</td>
                        <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {(p.status === 'aberto' || p.status === 'parcial') && (
                            <Button size="sm" variant="ghost" className="text-green-600" onClick={() => { setSelectedParcelaId(p.id); setSelectedParcelaValor(Number(p.valor)); setSelectedParcelaPagoAtual(pagoTot); setShowBaixaModal(true); }}>Baixa</Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={excluirParcela.isPending}
                            onClick={() => {
                              if (window.confirm("Tem certeza que deseja excluir esta parcela? Esta ação não pode ser desfeita.")) {
                                excluirParcela.mutate(p);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>

                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vitrine" className="space-y-6">
          <Card className="bg-gradient-to-br from-[#1E3A5F] to-[#2D6ADF] text-white border-0">
            <CardContent className="py-8 text-center space-y-2">
              <Sparkles className="h-8 w-8 mx-auto" />
              {perfilVocacional?.perfil_identificado ? (
                <>
                  <p className="text-sm uppercase tracking-wider opacity-80">Perfil identificado</p>
                  <h2 className="text-3xl font-bold">{perfilVocacional.perfil_identificado}</h2>
                  {perfilVocacional.created_at && (
                    <p className="text-xs opacity-70">
                      Preenchido em {formatDate(perfilVocacional.created_at as string)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-base opacity-90 pt-1">Aluno ainda não realizou o teste vocacional</p>
              )}
            </CardContent>
          </Card>
          {((perfilVocacional?.segmentos_recomendados ?? []) as string[]).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Segmentos recomendados</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {((perfilVocacional?.segmentos_recomendados ?? []) as string[]).map((s) => {
                  const cores: Record<string, string> = {
                    Administrativo: "bg-blue-100 text-blue-700 border-blue-200",
                    Tecnologia: "bg-purple-100 text-purple-700 border-purple-200",
                    "Saúde": "bg-green-100 text-green-700 border-green-200",
                    Beleza: "bg-pink-100 text-pink-700 border-pink-200",
                    Diversos: "bg-amber-100 text-amber-700 border-amber-200",
                  };
                  return (
                    <Badge key={s} variant="outline" className={cores[s] ?? ""}>{s}</Badge>
                  );
                })}
              </CardContent>
            </Card>
          )}
          <div className="flex justify-end"><Button onClick={() => setShowVitrineModal(true)}><Plus className="h-4 w-4 mr-2" /> Adicionar Curso</Button></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {vitrine?.map((item) => {
              const v = item as any;
              return (
                <Card key={item.id}><CardContent className="pt-6 flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="font-bold">{(item.cursos as any)?.nome}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(item.preco_pix)}</p>
                    {v.resgatado_com_pontos && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-yellow-100 text-yellow-800 text-[10px] font-semibold px-2 py-0.5">
                        ⭐ Resgatado com Milhas
                      </div>
                    )}
                    {v.resgatado_com_pontos && (
                      <p className="text-[10px] text-muted-foreground">
                        {v.pontos_usados} pts · {v.data_resgate ? formatDate(v.data_resgate) : "—"}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => {
                      setEditingVitrineItem(item);
                      setEditVitrinePrecoPix(String(v.preco_pix ?? v.valor_pix ?? ""));
                      setEditVitrinePrecoCartao(String(v.preco_cartao ?? v.valor_cartao ?? ""));
                      setEditVitrineValorPixDesconto(v.valor_pix_desconto != null ? String(v.valor_pix_desconto) : "");
                      setEditVitrineValorCartaoDesconto(v.valor_cartao_desconto != null ? String(v.valor_cartao_desconto) : "");
                      setEditVitrinePontosDesconto(v.pontos_desconto != null ? String(v.pontos_desconto) : "");
                      setEditVitrineMaxParcelas(String(v.max_parcelas ?? "12"));
                      setEditVitrineAtivo(v.ativo ?? true);
                      setShowEditVitrineModal(true);
                    }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removeFromVitrine.mutate(item.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent></Card>
              );
            })}
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
                {sessoes?.map((s, idx) => {
                  // sessoes ordered DESC by login_em — próxima sessão (mais recente) está em idx-1
                  const inicio = new Date(s.login_em);
                  const proxima = idx > 0 ? new Date(sessoes[idx - 1].login_em) : new Date();
                  const aulasDaSessao = aulasAssistidas?.filter(a => {
                    const da = new Date(a.assistida_em);
                    return da >= inicio && da < proxima;
                  }) ?? [];
                  return (
                    <div key={s.id} className="relative flex items-center gap-6 pl-10">
                      <div className="absolute left-0 flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 text-white"><LogIn className="h-5 w-5" /></div>
                      <div>
                        <p className="font-bold">Sessão Iniciada</p>
                        <p className="text-xs text-muted-foreground">{format(inicio, "dd/MM/yyyy HH:mm")} • {s.duracao_minutos || "?"} min</p>
                        {aulasDaSessao.length === 0 ? (
                          <p className="text-[10px] mt-1 text-muted-foreground italic">Nenhuma aula assistida nesta sessão</p>
                        ) : (
                          aulasDaSessao.map((a: any) => {
                            const pct = Number(a.percentual_assistido ?? 0);
                            const tempo = Number(a.tempo_assistido ?? 0);
                            const total = Number(a.duracao_total ?? 0);
                            const fmt = (sec: number) => {
                              const m = Math.floor(sec / 60);
                              const s = Math.floor(sec % 60);
                              return `${m}min${s.toString().padStart(2, "0")}seg`;
                            };
                            const materia = a.cursos?.nome ?? "—";
                            const aulaTit = a.aulas?.titulo ?? "Aula";
                            let Icon = Eye;
                            let cor = "text-muted-foreground";
                            if (pct >= 70) { Icon = CheckCircle2; cor = "text-green-600"; }
                            else if (pct >= 1) { Icon = Clock; cor = "text-amber-600"; }
                            const detalhe = tempo === 0
                              ? "Abriu mas não assistiu"
                              : total > 0
                                ? `${fmt(tempo)} de ${fmt(total)} (${Math.round(pct)}%)`
                                : `${Math.round(pct)}% assistido`;
                            return (
                              <div key={a.id} className={`flex items-center gap-2 text-[11px] mt-1 ${cor}`}>
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                <span><span className="font-semibold">{materia}</span> — {aulaTit} • {detalhe}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
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

        <TabsContent value="mensagens" className="space-y-6">
          <MensagensTab alunoId={id} />
        </TabsContent>
      </Tabs>




      <BaixaModal open={showBaixaModal} onOpenChange={setShowBaixaModal} isLoading={darBaixa.isPending} valorOriginal={selectedParcelaValor} valorPagoAtual={selectedParcelaPagoAtual} onConfirm={(data) => darBaixa.mutate(data)} />
      <ResumoBaixaModal open={!!resumoBaixa} onOpenChange={() => setResumoBaixa(null)} data={resumoBaixa} />
      <HistoricoPagamentosModal parcelaId={historicoParcelaId} onOpenChange={(o: boolean) => !o && setHistoricoParcelaId(null)} />
      <Dialog open={showResetDefaultModal} onOpenChange={setShowResetDefaultModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar redefinição</DialogTitle></DialogHeader>
          <div className="py-4 text-sm space-y-2">
            <p>Redefinir senha para <strong>1234{(aluno.nome?.split(' ')[0] ?? '').toLowerCase()}</strong>.</p>
            <p className="font-medium">Deseja notificar o aluno via WhatsApp sobre a nova senha?</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setShowResetDefaultModal(false)} disabled={resetToDefaultPassword.isPending}>Cancelar</Button>
            <Button variant="secondary" onClick={() => resetToDefaultPassword.mutate(false)} disabled={resetToDefaultPassword.isPending}>
              {resetToDefaultPassword.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Não, apenas redefinir
            </Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => resetToDefaultPassword.mutate(true)} disabled={resetToDefaultPassword.isPending}>
              {resetToDefaultPassword.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Sim, notificar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showPasswordResult} onOpenChange={setShowPasswordResult}>
        <DialogContent><DialogHeader><DialogTitle>Senha Redefinida!</DialogTitle></DialogHeader><div className="bg-muted p-4 rounded text-sm"><p>Login: <b>{aluno.ctr}</b></p><p>Senha: <b>{passwordToDisplay}</b></p></div><Button onClick={() => setShowPasswordResult(false)}>Fechar</Button></DialogContent>
      </Dialog>
      <Dialog open={showVitrineModal} onOpenChange={(open) => {
        setShowVitrineModal(open);
        if (open && !vitrineFiltroSegmentoInit) {
          const recs = (perfilVocacional?.segmentos_recomendados ?? []) as string[];
          const map: Record<string, string> = {
            "Beleza": "Área da Beleza",
            "Saúde": "Área da Saúde",
            "Tecnologia": "Tecnologia",
            "Administrativo": "Administrativo",
            "Diversos": "Diversos",
          };
          const sugerido = recs.map(r => map[r]).find(Boolean);
          if (sugerido) setVitrineFiltroSegmento(sugerido);
          setVitrineFiltroSegmentoInit(true);
        }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar à Vitrine</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Filtrar por segmento</label>
              <select className="w-full p-2 border rounded mt-1" value={vitrineFiltroSegmento} onChange={(e) => { setVitrineFiltroSegmento(e.target.value); setVitrineCursoId(""); }}>
                <option value="todos">Todos</option>
                <option value="Administrativo">Administrativo</option>
                <option value="Área da Beleza">Área da Beleza</option>
                <option value="Área da Saúde">Área da Saúde</option>
                <option value="Diversos">Diversos</option>
                <option value="Tecnologia">Tecnologia</option>
              </select>
            </div>
            <select className="w-full p-2 border rounded" value={vitrineCursoId} onChange={(e) => setVitrineCursoId(e.target.value)}>
              <option value="">Selecione...</option>
              {allCourses?.filter((c: any) => vitrineFiltroSegmento === "todos" || (c.segmentos as any)?.nome === vitrineFiltroSegmento).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Valores sem desconto</p>
              <Input placeholder="Valor PIX (R$)" type="number" value={vitrinePrecoPix} onChange={(e) => setVitrinePrecoPix(e.target.value)} />
              <Input placeholder="Valor Cartão (R$)" type="number" value={vitrinePrecoCartao} onChange={(e) => setVitrinePrecoCartao(e.target.value)} />
            </div>
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Preços com desconto por pontos (opcional)</p>
              <Input placeholder="Preço PIX com desconto (R$)" type="number" value={vitrineValorPixDesconto} onChange={(e) => {
                const v = e.target.value;
                setVitrineValorPixDesconto(v);
                const n = Number(v);
                if (v && !isNaN(n) && n > 0) setVitrineValorCartaoDesconto((n / 10 * 12).toFixed(2));
              }} />
              <Input placeholder="Preço Cartão com desconto (R$)" type="number" value={vitrineValorCartaoDesconto} onChange={(e) => setVitrineValorCartaoDesconto(e.target.value)} />
              <Input placeholder="Pontos necessários para o desconto" type="number" value={vitrinePontosDesconto} onChange={(e) => setVitrinePontosDesconto(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => addToVitrine.mutate()}>Adicionar</Button>
        </DialogContent>
      </Dialog>

      <TrocarPacoteModal
        open={showTrocarPacote}
        onOpenChange={setShowTrocarPacote}
        alunoId={id}
        poloId={aluno?.polo_id ?? null}
        parcelas={parcelas}
      />

      <Dialog open={showEditVitrineModal} onOpenChange={setShowEditVitrineModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Vitrine — {(editingVitrineItem?.cursos as any)?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Valores sem desconto</p>
              <Input placeholder="Valor PIX (R$)" type="number" value={editVitrinePrecoPix} onChange={(e) => setEditVitrinePrecoPix(e.target.value)} />
              <Input placeholder="Valor Cartão (R$)" type="number" value={editVitrinePrecoCartao} onChange={(e) => setEditVitrinePrecoCartao(e.target.value)} />
            </div>
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Preços com desconto por pontos (opcional)</p>
              <Input placeholder="Preço PIX com desconto (R$)" type="number" value={editVitrineValorPixDesconto} onChange={(e) => {
                const v = e.target.value;
                setEditVitrineValorPixDesconto(v);
                const n = Number(v);
                if (v && !isNaN(n) && n > 0) setEditVitrineValorCartaoDesconto((n / 10 * 12).toFixed(2));
              }} />
              <Input placeholder="Preço Cartão com desconto (R$)" type="number" value={editVitrineValorCartaoDesconto} onChange={(e) => setEditVitrineValorCartaoDesconto(e.target.value)} />
              <Input placeholder="Pontos necessários para o desconto" type="number" value={editVitrinePontosDesconto} onChange={(e) => setEditVitrinePontosDesconto(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => updateVitrine.mutate()} disabled={updateVitrine.isPending}>
            {updateVitrine.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showInativarDialog} onOpenChange={(o) => { setShowInativarDialog(o); if (!o) setMotivoInativo(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inativar aluno?</DialogTitle>
            <DialogDescription>
              O aluno perderá o acesso ao sistema. Você poderá reativar a qualquer momento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Textarea
              value={motivoInativo}
              onChange={(e) => setMotivoInativo(e.target.value)}
              placeholder="Ex.: desistência, transferência..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInativarDialog(false)}>Cancelar</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={updateStatus.isPending}
              onClick={() => {
                updateStatus.mutate(
                  { novo: "inativo", motivo: motivoInativo },
                  { onSuccess: () => { setShowInativarDialog(false); setMotivoInativo(""); } }
                );
              }}
            >
              Confirmar inativação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReativarDialog} onOpenChange={setShowReativarDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reativar aluno?</DialogTitle>
            <DialogDescription>
              O aluno voltará a ter acesso ao sistema.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReativarDialog(false)}>Cancelar</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={updateStatus.isPending}
              onClick={() => {
                updateStatus.mutate(
                  { novo: "ativo" },
                  { onSuccess: () => setShowReativarDialog(false) }
                );
              }}
            >
              Confirmar reativação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function Info({ label, value }: { label: string; value: any }) {
  return (<div><p className="text-[10px] text-muted-foreground uppercase">{label}</p><p className="font-medium">{value || "—"}</p></div>);
}
