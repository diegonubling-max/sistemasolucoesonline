import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Check, ArrowLeft, ArrowRight, Loader2, GraduationCap, Copy, Calendar as CalendarIcon, Trash2, Plus, Wallet, ChevronDown, ChevronRight, FileText, Link, ShieldPlus, MessageSquare, Receipt } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addMonths, setDate, lastDayOfMonth, compareAsc } from "date-fns";
import { cn } from "@/lib/utils";
import { AlunoForm, type AlunoFormValues } from "./AlunoForm";
import { maskCPF, maskPhone, isValidCPF, calcAge, generateStudentPassword } from "@/lib/format";
import { toast } from "sonner";
import { createOrGetAsaasCustomer, generateAsaasCobrar } from "@/services/asaas";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { sendPushNotification } from "@/lib/notify";


type Step = 1 | 2 | 3 | 4 | 5;

export function MatriculaFlow({
  initialAlunoId,
  initialMatriculaId,
  initialStep,
}: {
  initialAlunoId?: string;
  initialMatriculaId?: string;
  initialStep?: Step;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(initialStep ?? 1);
  const [unlockedSteps, setUnlockedSteps] = useState<Step[]>(() => {
    const s = initialStep ?? 1;
    const all: Step[] = [1, 2, 3, 4, 5];
    return all.filter((x) => x <= s) as Step[];
  });
  const [alunoId, setAlunoId] = useState<string | undefined>(initialAlunoId);
  const [matriculaId, setMatriculaId] = useState<string | undefined>(initialMatriculaId);

  
  // State for Step 2: Cursos
  const [selectedCursos, setSelectedCursos] = useState<string[]>([]);
  const [searchCurso, setSearchCurso] = useState("");
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);
  
  // State for Step 3: Pacotes
  const [selectedPacote, setSelectedPacote] = useState<string | null>(null);
  const [isNegociacaoPersonalizada, setIsNegociacaoPersonalizada] = useState(false);
  const [negociacao, setNegociacao] = useState({
    formaPagamento: "carnê",
    valorEntrada: 0,
    numeroParcelas: 1,
    valorParcela: 0,
    observacao: ""
  });

  // State for Step 4: Pagamentos
  const [taxaStatus, setTaxaStatus] = useState<"cobrar" | "isentar">("cobrar");
  const [taxaVencimento, setTaxaVencimento] = useState<Date>(new Date());
  const [melhorDia, setMelhorDia] = useState<string>("");
  const [parcelasGeradas, setParcelasGeradas] = useState<any[]>([]);
  const [tipoCobranca, setTipoCobranca] = useState<"carne" | "asaas">("carne");
  const [asaasTipo, setAsaasTipo] = useState<"PIX" | "BOLETO">("PIX");
  const [isProcessingAsaas, setIsProcessingAsaas] = useState(false);
  const [asaasProgress, setAsaasProgress] = useState({ current: 0, total: 0 });

  const [showConclusion, setShowConclusion] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showModelSelection, setShowModelSelection] = useState(false);
  const [selectedModeloId, setSelectedModeloId] = useState<string | null>(null);
  const [contractContent, setContractContent] = useState("");
  const [contractLink, setContractLink] = useState<string | null>(null);
  const [accessData, setAccessData] = useState<{ email: string; pass: string; ctr?: number; nome?: string } | null>(null);

  const { data: modelos } = useQuery({
    queryKey: ["modelos-contrato"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modelos_contrato" as any)
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: segmentos } = useQuery({
    queryKey: ["segmentos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("segmentos")
        .select("id, nome")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cursos } = useQuery({
    queryKey: ["cursos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select("id, nome, segmento_id, aulas(count)")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: pacotes } = useQuery({
    queryKey: ["pacotes-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacotes")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Resume flow: hidrata cursos e pacote selecionados quando vier com matrículaId
  useEffect(() => {
    (async () => {
      if (!initialMatriculaId) return;
      const { data: mc } = await supabase
        .from("matricula_cursos")
        .select("curso_id")
        .eq("matricula_id", initialMatriculaId);
      if (mc && mc.length > 0) {
        setSelectedCursos(mc.map((r: any) => r.curso_id));
      }
      const { data: mp } = await supabase
        .from("matricula_pacotes")
        .select("pacote_id")
        .eq("matricula_id", initialMatriculaId)
        .maybeSingle();
      if (mp) {
        if (mp.pacote_id) setSelectedPacote(mp.pacote_id);
        else setIsNegociacaoPersonalizada(true);
      }
    })();
  }, [initialMatriculaId]);

  const { data: aluno } = useQuery({
    queryKey: ["aluno-matricula", alunoId as string],
    enabled: !!alunoId,
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("*").eq("id", alunoId!).single();
      if (error) throw error;
      return data;
    },
  });

  const resolveColaboradorId = async (): Promise<string | null> => {
    // 1. Usuário logado colaborador?
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user.id) {
      const { data: colab } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('user_id', sessionData.session.user.id)
        .maybeSingle();
      if (colab?.id) return colab.id;
    }
    // 2. Fallback: vendedora selecionada no cadastro do aluno (admin)
    const vendedoraNome = (aluno as any)?.vendedora;
    if (vendedoraNome) {
      const { data: colab } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('nome', vendedoraNome)
        .eq('setor', 'Vendedor')
        .eq('ativo', true)
        .maybeSingle();
      if (colab?.id) return colab.id;
    }
    return null;
  };

  const saveStep2 = useMutation({
    mutationFn: async () => {
      if (!alunoId) throw new Error("Aluno não identificado");

      const colaboradorId = await resolveColaboradorId();

      // 1. Create matricula
      const { data: m, error: me } = await supabase
        .from("matriculas")
        .insert({ aluno_id: alunoId, polo_id: aluno?.polo_id, colaborador_id: colaboradorId })
        .select("id")
        .single();
      if (me) throw me;

      // 2. Add cursos
      const coursesToInsert = selectedCursos.map(cid => ({
        matricula_id: m.id,
        curso_id: cid
      }));
      const { error: ce } = await supabase.from("matricula_cursos").insert(coursesToInsert);
      if (ce) throw ce;

      return m.id;
    },
    onSuccess: (id) => {
      setMatriculaId(id);
      setUnlockedSteps(prev => [...prev, 3]);
      setStep(3);
      toast.success("Cursos vinculados!");
    },
    onError: (e: any) => toast.error(e.message)
  });

  const saveStep3 = useMutation({
    mutationFn: async () => {
      if (!matriculaId || (!selectedPacote && !isNegociacaoPersonalizada)) throw new Error("Dados incompletos");

      // 1. Save package record (even if null for personalized)
      const { error: pe } = await supabase.from("matricula_pacotes").insert({
        matricula_id: matriculaId,
        pacote_id: isNegociacaoPersonalizada ? null : selectedPacote
      });
      if (pe) throw pe;

      // 2. Save observation if personalized
      if (isNegociacaoPersonalizada && negociacao.observacao) {
        const { error: me } = await supabase
          .from("matriculas")
          .update({ observacao: negociacao.observacao })
          .eq("id", matriculaId);
        if (me) throw me;
      }

      return true;
    },
    onSuccess: () => {
      setUnlockedSteps(prev => [...prev, 4]);
      setStep(4);
      toast.success("Pacote selecionado!");
    },
    onError: (e: any) => toast.error(e.message)
  });

  const concludeMatricula = useMutation({
    mutationFn: async () => {
      if (!matriculaId || !aluno || !contractContent) throw new Error("Dados incompletos");

      // Buscar ID do colaborador logado
      const { data: sessionData } = await supabase.auth.getSession();
      let colaboradorId = null;
      if (sessionData.session?.user.id) {
        const { data: colab } = await supabase.from('colaboradores').select('id').eq('user_id', sessionData.session.user.id).maybeSingle();
        colaboradorId = colab?.id;
      }

      // Atualizar matrícula com colaborador_id
      if (colaboradorId) {
        await supabase.from('matriculas').update({ colaborador_id: colaboradorId }).eq('id', matriculaId);
      }

      const currentPacote = !isNegociacaoPersonalizada ? pacotes?.find(p => p.id === selectedPacote) : null;
      if (!isNegociacaoPersonalizada && !currentPacote) throw new Error("Pacote não encontrado");

      // 1. Salvar Parcelas
      const allParcelas: any[] = [];
      const sortedItems = getSortedParcelas();

      sortedItems.forEach((p) => {
        allParcelas.push({
          matricula_id: matriculaId,
          polo_id: aluno.polo_id,
          tipo: p.tipo,
          numero: p.tipo === 'taxa_matricula' ? 0 : p.numero,
          valor: p.valor,
          data_vencimento: format(p.vencimento, 'yyyy-MM-dd'),
          status: p.status,
          descricao: p.descricao || (p.tipo === 'taxa_matricula' ? 'Taxa de Matrícula' : 'Parcela')
        });
      });

      const { data: savedParcelas, error: errorParcelas } = await supabase
        .from('parcelas')
        .insert(allParcelas)
        .select('id');
        
      if (errorParcelas) throw errorParcelas;

      // 2. Salvar Contrato
      const { data: contractData, error: errorContrato } = await supabase
        .from('contratos')
        .insert({
          aluno_id: aluno.id,
          matricula_id: matriculaId,
          conteudo_html: contractContent,
          status: 'pendente'
        })
        .select('token_unico')
        .single();

      if (errorContrato) throw errorContrato;

      // Integrar com Asaas
      try {
        // Garantir cliente no Asaas
        await createOrGetAsaasCustomer({
          id: aluno.id,
          nome: aluno.nome,
          cpf: aluno.cpf,
          email: aluno.email || "",
          telefone: aluno.telefone || ""
        });
        
        // Se tipo for Asaas, gerar cobranças automaticamente
        if (tipoCobranca === "asaas" && savedParcelas && savedParcelas.length > 0) {
          setIsProcessingAsaas(true);
          setAsaasProgress({ current: 0, total: savedParcelas.length });
          
          let count = 0;
          for (const p of savedParcelas) {
            count++;
            setAsaasProgress({ current: count, total: savedParcelas.length });
            try {
              await generateAsaasCobrar(p.id, asaasTipo);
            } catch (err) {
              console.error(`Erro ao gerar parcela ${p.id} no Asaas:`, err);
              // Continuamos com as próximas mesmo se uma falhar, 
              // mas talvez devessemos avisar o usuário
            }
          }
          toast.success(`${savedParcelas.length} cobranças geradas no Asaas!`);
        }
        
        console.log("Integração Asaas concluída");
      } catch (asaasError) {
        console.error("Erro na integração Asaas:", asaasError);
        if (tipoCobranca === "asaas") {
          toast.error("Matrícula concluída, mas houve erro ao gerar cobranças no Asaas.");
        }
      } finally {
        setIsProcessingAsaas(false);
      }

      return {
        token: contractData.token_unico,
        link: `https://sistemasolucoesonline.lovable.app/contrato/${contractData.token_unico}`
      };
    },
    onSuccess: async (data) => {
      // Push notification ANTES de abrir o modal de sucesso
      console.log("Enviando push notification...");
      try {
        const [{ data: polo }, { data: colab }] = await Promise.all([
          aluno?.polo_id
            ? supabase.from("polos").select("nome").eq("id", aluno.polo_id).maybeSingle()
            : Promise.resolve({ data: null } as any),
          (async () => {
            const { data: s } = await supabase.auth.getSession();
            const uid = s.session?.user.id;
            if (!uid) return { data: null } as any;
            return supabase.from("colaboradores").select("nome").eq("user_id", uid).maybeSingle();
          })(),
        ]);
        await sendPushNotification(
          "🎉 Nova Matrícula!",
          `Aluno: ${aluno?.nome ?? ""} | Polo: ${(polo as any)?.nome ?? "—"} | Vendedora: ${(colab as any)?.nome ?? "—"}`,
        );
        console.log("Push enviado!");
      } catch (e) {
        console.error("Erro push:", e);
      }

      // WhatsApp boas-vindas (Z-API) — não bloqueia o fluxo
      try {
        const { sendBoasVindasMatricula } = await import("@/services/zApiService");
        if (aluno?.telefone && aluno?.ctr != null) {
          await sendBoasVindasMatricula({
            telefone: aluno.telefone,
            nome: aluno.nome,
            ctr: aluno.ctr,
          });
        }
      } catch (e) {
        console.error("Erro WhatsApp boas-vindas:", e);
      }

      // Marca cadastro completo do aluno
      try {
        if (aluno?.id) {
          await supabase.from("alunos").update({ cadastro_completo: true } as any).eq("id", aluno.id);
        }
      } catch (e) {
        console.error("Erro ao marcar cadastro_completo:", e);
      }

      // Só depois abre o modal de sucesso
      setContractLink(data.link);
      if (aluno) {
        const primeiroNome = (aluno.nome || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
        setAccessData({
          email: aluno.email ?? "",
          pass: `1234${primeiroNome}`,
          ctr: aluno.ctr,
          nome: aluno.nome,
        });
      }
      setShowConclusion(true);
      qc.invalidateQueries({ queryKey: ["alunos"] });

    },


    onError: (e: any) => {
      setIsProcessingAsaas(false);
      toast.error(e.message);
    }
  });

  const generateContract = async (modeloId: string) => {
    if (!aluno || (!selectedPacote && !isNegociacaoPersonalizada)) return;

    const modelo = modelos?.find((m: any) => m.id === modeloId);
    if (!modelo) {
      toast.error("Modelo de contrato não encontrado.");
      return;
    }

    let template = (modelo as any).conteudo_html;
    const currentPacote = pacotes?.find(p => p.id === selectedPacote);
    const sortedParcelas = getSortedParcelas();
    const parcelaNormal = sortedParcelas.find(p => p.tipo === 'parcela');
    const primeiraParcela = sortedParcelas.find(p => p.tipo === 'parcela' || p.tipo === 'taxa_matricula');

    const variables: Record<string, string> = {
      "[NOME_ALUNO]": aluno.nome,
      "[CPF_ALUNO]": aluno.cpf,
      "[EMAIL_ALUNO]": aluno.email || "N/A",
      "[TELEFONE_ALUNO]": aluno.telefone || "N/A",
      "[DATA_NASCIMENTO]": format(new Date(aluno.data_nascimento), "dd/MM/yyyy"),
      "[PACOTE_NOME]": isNegociacaoPersonalizada ? "Negociação Personalizada" : (currentPacote?.nome || ""),
      "[FORMA_PAGAMENTO]": isNegociacaoPersonalizada ? negociacao.formaPagamento : (currentPacote?.tipo || ""),
      "[VALOR_ENTRADA]": isNegociacaoPersonalizada 
        ? negociacao.valorEntrada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : (currentPacote?.valor_matricula.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || ""),
      "[VALOR_PARCELA]": parcelaNormal?.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "",
      "[NUMERO_PARCELAS]": isNegociacaoPersonalizada 
        ? negociacao.numeroParcelas.toString()
        : (currentPacote?.numero_parcelas || 0).toString(),
      "[VALOR_TOTAL]": isNegociacaoPersonalizada
        ? (negociacao.valorEntrada + (negociacao.numeroParcelas * negociacao.valorParcela)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : (currentPacote?.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || ""),
      "[DATA_MATRICULA]": format(new Date(), "dd/MM/yyyy"),
      "[NOME_ESCOLA]": "Soluções Online", 
      "[DATA_CONTRATO]": format(new Date(), "dd/MM/yyyy"),
      "[DATA_HOJE]": format(new Date(), "dd/MM/yyyy"),
      "[DATA_PRIMEIRA_PARCELA]": primeiraParcela ? format(primeiraParcela.vencimento, "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy")
    };

    Object.entries(variables).forEach(([key, value]) => {
      template = template.replaceAll(key, value);
    });

    setContractContent(template);
    setShowModelSelection(false);
    setShowContractModal(true);
  };

  const createContract = useMutation({
    mutationFn: async () => {
      if (!alunoId || !contractContent) throw new Error("Dados incompletos");

      const { data, error } = await supabase
        .from('contratos')
        .insert({
          aluno_id: alunoId,
          matricula_id: matriculaId,
          conteudo_html: contractContent,
          status: 'pendente'
        })
        .select('token_unico')
        .single();

      if (error) throw error;
      return `https://sistemasolucoesonline.lovable.app/contrato/${data.token_unico}`;
    },
    onSuccess: (link) => {
      setContractLink(link);
      toast.success("Contrato gerado com sucesso!");
    },
    onError: (e: any) => toast.error("Erro ao gerar contrato: " + e.message)
  });

  const getSortedParcelas = () => {
    const currentPacote = pacotes?.find(p => p.id === selectedPacote);
    const items: any[] = [];

    // Taxa de Matrícula / Entrada
    if (isNegociacaoPersonalizada) {
      if (negociacao.valorEntrada > 0) {
        items.push({
          id: 'entrada-row',
          tipo: 'taxa_matricula',
          numero: 0,
          vencimento: taxaVencimento,
          valor: negociacao.valorEntrada,
          status: 'aberto',
          descricao: 'Entrada (Negociado)'
        });
      }
    } else if (currentPacote) {
      items.push({
        id: 'taxa-row',
        tipo: 'taxa_matricula',
        numero: 0,
        vencimento: taxaVencimento,
        valor: taxaStatus === 'isentar' ? 0 : currentPacote.valor_matricula,
        status: taxaStatus === 'isentar' ? 'isento' : 'aberto'
      });
    }

    // Outras parcelas
    parcelasGeradas.forEach(p => {
      items.push({
        ...p,
        tipo: p.tipo || 'parcela',
        status: 'aberto'
      });
    });

    // Ordenar por data crescente
    const sorted = [...items].sort((a, b) => compareAsc(a.vencimento, b.vencimento));

    // Reatribuir números após ordenação (exceto taxa se for para manter numeração cronológica)
    let parcelaCount = 1;
    return sorted.map((item) => {
      if (item.tipo === 'parcela') {
        return { ...item, numero: parcelaCount++ };
      }
      return item;
    });
  };

  const filteredCursos = (cursos || []).filter(c => 
    c.nome.toLowerCase().includes(searchCurso.toLowerCase())
  );

  const toggleCurso = (id: string) => {
    setSelectedCursos(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSegmento = (segmentoId: string | null, checked: boolean) => {
    const coursesInSegment = filteredCursos
      .filter(c => c.segmento_id === segmentoId)
      .map(c => c.id);
    
    if (checked) {
      setSelectedCursos(prev => [...new Set([...prev, ...coursesInSegment])]);
    } else {
      setSelectedCursos(prev => prev.filter(id => !coursesInSegment.includes(id)));
    }
  };

  const handleAllCursos = (checked: boolean) => {
    if (checked) {
      setSelectedCursos(filteredCursos.map(c => c.id));
    } else {
      setSelectedCursos([]);
    }
  };

  // Group courses by segment
  const groupedCursos = (segmentos || []).map(seg => ({
    ...seg,
    cursos: filteredCursos.filter(c => c.segmento_id === seg.id)
  })).filter(g => g.cursos.length > 0);

  // Add courses without segment or with invalid segment
  const otherCursos = filteredCursos.filter(c => !segmentos?.some(s => s.id === c.segmento_id));
  if (otherCursos.length > 0) {
    groupedCursos.push({
      id: "others",
      nome: "Outros",
      cursos: otherCursos
    } as any);
  }

  return (
    <div className="space-y-8">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center max-w-2xl mx-auto mb-10">
        {[1, 2, 3, 4, 5].map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div 
              className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                step === s ? "border-primary bg-primary text-primary-foreground" : 
                unlockedSteps.includes(s as Step) ? "border-green-500 bg-white text-green-500" : 
                "border-gray-300 bg-gray-50 text-gray-400"
              }`}
            >
              {unlockedSteps.includes((s + 1) as Step) && s < 5 ? (
                <Check className="h-5 w-5" />
              ) : (
                <span className="text-sm font-bold">{s}</span>
              )}
              <span className="absolute -bottom-7 w-32 text-center text-xs font-medium text-muted-foreground">
                {s === 1 ? "Dados do Aluno" : s === 2 ? "Cursos" : s === 3 ? "Pacote" : s === 4 ? "Pagamentos" : "Contrato"}
              </span>
            </div>
            {i < 4 && (
              <div className={`flex-1 h-0.5 mx-2 ${unlockedSteps.includes((s + 1) as Step) ? "bg-green-500" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <AlunoForm
            submitLabel="Salvar e continuar"
            onSubmit={async (v) => {
              const primeiroNome = v.nome.split(' ')[0];
              const senhaGerada = '1234' + primeiroNome
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .split(' ')[0];

              // Identifica quem está cadastrando
              const { data: { user: currentUser } } = await supabase.auth.getUser();
              let cadastradoPorNome: string | null = null;
              let cadastradoPorId: string | null = currentUser?.id ?? null;
              if (currentUser) {
                if (currentUser.email === 'diegonubling@gmail.com') {
                  cadastradoPorNome = 'Diego (Admin)';
                } else {
                  const { data: colab } = await supabase
                    .from('colaboradores')
                    .select('nome')
                    .eq('user_id', currentUser.id)
                    .maybeSingle();
                  cadastradoPorNome = colab?.nome ?? currentUser.email ?? null;
                }
              }

              const { email, ...rest } = v;
              const studentToInsert = {
                ...rest,
                responsavel_email: v.responsavel_email || null,
                menor_de_idade: calcAge(v.data_nascimento) < 18,
                email: email || null,
                cadastrado_por: cadastradoPorNome,
                cadastrado_por_id: cadastradoPorId,
              };

              // 1. Create student record
              const { data: studentData, error: studentError } = await supabase.from("alunos").insert(studentToInsert).select("id, nome, email, ctr").single();
              
              if (studentError) {
                console.error("Erro ao salvar aluno:", studentError);
                toast.error(`Erro ao salvar: ${studentError.message}`);
                return;
              }

              let finalEmail = studentData.email;

              // Se o email não foi informado, gera o fictício
              if (!finalEmail) {
                finalEmail = `ctr${studentData.ctr}@solucoesonline.com.br`;
                const { error: updateError } = await supabase
                  .from("alunos")
                  .update({ email: finalEmail })
                  .eq("id", studentData.id);
                
                if (updateError) {
                  console.error("Erro ao atualizar email fictício:", updateError);
                }
              }

              // 2. Create Auth user via RPC
              if (finalEmail) {
                console.log('Criando acesso:', finalEmail, senhaGerada, studentData.ctr);
                const { error: erroAcesso } = await supabase.rpc('criar_acesso_aluno', {
                  p_email: finalEmail,
                  p_senha: senhaGerada,
                  p_ctr: studentData.ctr
                });

                if (erroAcesso) {
                  console.error('Erro RPC:', erroAcesso);
                  toast.error('Aluno salvo, mas erro ao criar acesso: ' + erroAcesso.message);
                } else {
                  toast.success('Aluno cadastrado com sucesso!');
                }
              }
              
              setAlunoId(studentData.id);
              setAccessData({
                email: finalEmail ?? "",
                pass: senhaGerada,
                ctr: studentData.ctr,
                nome: studentData.nome
              });
              setUnlockedSteps(prev => prev.includes(2) ? prev : [...prev, 2]);
              setStep(2);

            }}
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Pesquisar curso..." 
                    value={searchCurso}
                    onChange={(e) => setSearchCurso(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="text-sm font-medium">
                  {selectedCursos.length} curso(s) selecionado(s)
                </div>
              </div>

              <div className="flex items-center space-x-2 p-2 border-b">
                <Checkbox 
                  id="all" 
                  checked={selectedCursos.length === filteredCursos.length && filteredCursos.length > 0}
                  onCheckedChange={(c) => handleAllCursos(!!c)}
                />
                <label htmlFor="all" className="text-sm font-bold cursor-pointer">Marcar todos os cursos</label>
              </div>

              <div className="space-y-3 pt-2">
                {groupedCursos.map(group => {
                  const isExpanded = expandedSegment === group.id;
                  const selectedInGroup = group.cursos.filter(c => selectedCursos.includes(c.id)).length;
                  const allSelectedInGroup = selectedInGroup === group.cursos.length && group.cursos.length > 0;

                  return (
                    <div key={group.id} className="border rounded-xl overflow-hidden bg-white shadow-sm transition-all">
                      <div 
                        className={cn(
                          "flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                          isExpanded && "bg-muted/30 border-b"
                        )}
                        onClick={() => setExpandedSegment(isExpanded ? null : group.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                            isExpanded ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          </div>
                          <div>
                            <h3 className="font-bold text-sm uppercase tracking-tight">{group.nome}</h3>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                              {group.cursos.length} cursos disponíveis
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {selectedInGroup > 0 && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                              {selectedInGroup} selecionados
                            </Badge>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-4 bg-muted/10 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center space-x-2 pb-2 border-b border-muted">
                            <Checkbox 
                              id={`seg-${group.id}`}
                              checked={allSelectedInGroup}
                              onCheckedChange={(c) => toggleSegmento(group.id === "others" ? null : group.id, !!c)}
                            />
                            <label htmlFor={`seg-${group.id}`} className="text-xs font-bold uppercase tracking-wider cursor-pointer">
                              Selecionar todos de {group.nome}
                            </label>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {group.cursos.map(curso => {
                              const aulasCount = Array.isArray(curso.aulas) ? (curso.aulas[0]?.count ?? 0) : 0;
                              const isSelected = selectedCursos.includes(curso.id);
                              return (
                                <div 
                                  key={curso.id}
                                  className={cn(
                                    "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer group",
                                    isSelected 
                                      ? "border-primary bg-primary/5 shadow-sm" 
                                      : "border-muted-foreground/10 bg-white hover:border-primary/50"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCurso(curso.id);
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <Checkbox 
                                      checked={isSelected} 
                                      onCheckedChange={() => {}} 
                                      className="pointer-events-none"
                                    />
                                    <div>
                                      <p className="font-semibold text-sm leading-none mb-1">{curso.nome}</p>
                                      <div className="flex items-center gap-1.5">
                                        <GraduationCap className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                                          {aulasCount} aulas
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredCursos.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum curso encontrado para "{searchCurso}"
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Button 
              disabled={selectedCursos.length === 0 || saveStep2.isPending}
              onClick={() => saveStep2.mutate()}
            >
              {saveStep2.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar e continuar <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Seção 0: Tipo de Cobrança */}
            <Card className="md:col-span-3 border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Tipo de Cobrança
                </CardTitle>
                <CardDescription>Defina como o aluno irá realizar os pagamentos</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup 
                  value={tipoCobranca} 
                  onValueChange={(v: any) => setTipoCobranca(v)}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem value="carne" id="carne" className="peer sr-only" />
                    <Label
                      htmlFor="carne"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer h-full"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                        <span className="text-base font-bold">Carnê da Escola</span>
                        <p className="text-xs text-center text-muted-foreground">
                          Pagamento direto na escola. Baixa manual pelo painel financeiro. Sem taxas automáticas.
                        </p>
                      </div>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="asaas" id="asaas" className="peer sr-only" />
                    <Label
                      htmlFor="asaas"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer h-full"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Wallet className="h-6 w-6 text-primary" />
                        <span className="text-base font-bold">Integração Asaas</span>
                        <p className="text-xs text-center text-muted-foreground">
                          Geração automática de boletos ou PIX. Baixa automática e links de pagamento.
                        </p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>

                {tipoCobranca === "asaas" && (
                  <div className="mt-6 p-4 bg-white rounded-lg border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-300">
                    <Label className="text-sm font-semibold mb-3 block">Selecione o tipo de cobrança Asaas:</Label>
                    <RadioGroup 
                      value={asaasTipo} 
                      onValueChange={(v: any) => setAsaasTipo(v)}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="PIX" id="pix_asaas" />
                        <Label htmlFor="pix_asaas" className="flex items-center gap-2 cursor-pointer">
                          <span>💠</span> PIX
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="BOLETO" id="boleto_asaas" />
                        <Label htmlFor="boleto_asaas" className="flex items-center gap-2 cursor-pointer">
                          <span>🏦</span> Boleto
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seção 1: Taxa de Matrícula */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  Taxa de Matrícula
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-lg flex justify-between items-center">
                  <span className="text-sm font-medium">Valor da Taxa</span>
                  <span className="text-xl font-bold text-primary">
                    R$ {pacotes?.find(p => p.id === selectedPacote)?.valor_matricula.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <RadioGroup 
                  value={taxaStatus} 
                  onValueChange={(v: any) => setTaxaStatus(v)}
                  className="grid grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem value="cobrar" id="cobrar" className="peer sr-only" />
                    <Label
                      htmlFor="cobrar"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <span className="text-sm font-semibold">Cobrar</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="isentar" id="isentar" className="peer sr-only" />
                    <Label
                      htmlFor="isentar"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <span className="text-sm font-semibold">Isentar</span>
                    </Label>
                  </div>
                </RadioGroup>

                {taxaStatus === "cobrar" && (
                  <div className="space-y-2">
                    <Label>Data de Vencimento</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !taxaVencimento && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {taxaVencimento ? format(taxaVencimento, "dd/MM/yyyy") : <span>Selecione uma data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={taxaVencimento}
                          onSelect={(d) => d && setTaxaVencimento(d)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seção 2: Parcelas Control */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  Geração de Parcelas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="melhorDia">Melhor dia de vencimento (1 a 31)</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="melhorDia"
                      type="number"
                      min="1"
                      max="31"
                      placeholder="Ex: 10"
                      value={melhorDia}
                      onChange={(e) => setMelhorDia(e.target.value)}
                    />
                    <Button 
                      onClick={() => {
                        const pacote = pacotes?.find(p => p.id === selectedPacote);
                        if (!pacote && !isNegociacaoPersonalizada) return;
                        const dia = parseInt(melhorDia);
                        if (isNaN(dia) || dia < 1 || dia > 31) {
                          toast.error("Informe um dia válido entre 1 e 31");
                          return;
                        }

                        const novasParcelas = [];
                        const hoje = new Date();
                        
                        if (!isNegociacaoPersonalizada && pacote?.tipo === 'cartao') {
                          // Se for cartão, gera apenas uma linha de pagamento do cartão com o valor total (sem a taxa)
                          novasParcelas.push({
                            id: Math.random().toString(36).substr(2, 9),
                            tipo: 'parcela',
                            numero: 1,
                            descricao: "Pagamento Cartão",
                            vencimento: hoje,
                            valor: pacote.valor_total - pacote.valor_matricula
                          });
                        } else if (isNegociacaoPersonalizada) {
                          const offsetInicial = hoje.getDate() <= dia ? 0 : 1;
                          for (let i = 1; i <= negociacao.numeroParcelas; i++) {
                            let dataVenc = addMonths(hoje, offsetInicial + (i - 1));
                            const ultimoDia = lastDayOfMonth(dataVenc);
                            if (dia > ultimoDia.getDate()) {
                              dataVenc = ultimoDia;
                            } else {
                              dataVenc = setDate(dataVenc, dia);
                            }

                            novasParcelas.push({
                              id: Math.random().toString(36).substr(2, 9),
                              numero: i,
                              vencimento: dataVenc,
                              valor: negociacao.valorParcela,
                              descricao: `Parcela ${i} (Negociado)`
                            });
                          }
                        } else {
                          const offsetInicial = hoje.getDate() <= dia ? 0 : 1;
                          for (let i = 1; i <= (pacote?.numero_parcelas || 0); i++) {
                            let dataVenc = addMonths(hoje, offsetInicial + (i - 1));
                            
                            // Lógica para dia do mês
                            const ultimoDia = lastDayOfMonth(dataVenc);
                            if (dia > ultimoDia.getDate()) {
                              dataVenc = ultimoDia;
                            } else {
                              dataVenc = setDate(dataVenc, dia);
                            }

                            novasParcelas.push({
                              id: Math.random().toString(36).substr(2, 9),
                              numero: i,
                              vencimento: dataVenc,
                              valor: pacote?.valor_parcela || 0
                            });
                          }
                        }

                        setParcelasGeradas(novasParcelas);
                        toast.success((!isNegociacaoPersonalizada && pacote?.tipo === 'cartao') ? "Cobrança única de cartão gerada!" : "Parcelas geradas com sucesso!");
                      }}
                    >
                      Gerar parcelas
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg flex justify-between items-center">
                  <span className="text-sm font-medium">Configuração do Pacote</span>
                  <span className="text-sm font-bold">
                    {isNegociacaoPersonalizada 
                      ? `${negociacao.numeroParcelas}x de R$ ${negociacao.valorParcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : `${pacotes?.find(p => p.id === selectedPacote)?.numero_parcelas}x de R$ ${pacotes?.find(p => p.id === selectedPacote)?.valor_parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    }
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Parcelas */}
          {parcelasGeradas.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-bold">Nº</th>
                        <th className="text-left py-2 font-bold">Descrição</th>
                        <th className="text-left py-2 font-bold">Vencimento</th>
                        <th className="text-left py-2 font-bold">Valor</th>
                        <th className="text-left py-2 font-bold">Status</th>
                        <th className="text-right py-2 font-bold">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedParcelas().map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="py-3">
                            {p.tipo === 'taxa_matricula' ? (
                              <Badge variant="outline" className="font-bold border-primary text-primary">Taxa</Badge>
                            ) : p.numero}
                          </td>
                          <td className="py-3">
                            <div className="flex flex-col">
                              <span>{p.descricao || (p.tipo === 'taxa_matricula' ? 'Taxa de Matrícula' : `Parcela ${p.numero}`)}</span>
                              {p.descricao?.includes('(Negociado)') && (
                                <Badge variant="outline" className="w-fit text-[10px] h-4 px-1 bg-blue-50 text-blue-600 border-blue-200">Negociado</Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
                                  {p.status === 'isento' ? '—' : format(p.vencimento, "dd/MM/yyyy")}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={p.vencimento}
                                  onSelect={(d) => {
                                    if (!d) return;
                                    if (p.tipo === 'taxa_matricula') {
                                      setTaxaVencimento(d);
                                    } else {
                                      const updated = parcelasGeradas.map(item => 
                                        item.id === p.id ? { ...item, vencimento: d } : item
                                      );
                                      setParcelasGeradas(updated);
                                    }
                                  }}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </td>
                          <td className="py-3">
                            {p.status === 'isento' ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">R$</span>
                                <Input 
                                  className="h-8 w-24 text-xs"
                                  type="number"
                                  step="0.01"
                                  value={p.valor}
                                  readOnly={p.tipo === 'taxa_matricula'}
                                  onChange={(e) => {
                                    if (p.tipo === 'taxa_matricula') return;
                                    const updated = parcelasGeradas.map(item => 
                                      item.id === p.id ? { ...item, valor: parseFloat(e.target.value) || 0 } : item
                                    );
                                    setParcelasGeradas(updated);
                                  }}
                                />
                              </div>
                            )}
                          </td>
                          <td className="py-3">
                            {p.status === 'isento' ? (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-800 border-gray-200">Isento</Badge>
                            ) : (
                              <div className="flex gap-1">
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Aberto</Badge>
                                {p.descricao?.includes('(Negociado)') && (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">Negociado</Badge>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            {p.tipo === ('parcela' as any) && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive"
                                onClick={() => {
                                  setParcelasGeradas(prev => prev.filter(item => item.id !== p.id));
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      const lastNum = parcelasGeradas.length > 0 ? parcelasGeradas[parcelasGeradas.length - 1].numero : 0;
                      const lastDate = parcelasGeradas.length > 0 ? parcelasGeradas[parcelasGeradas.length - 1].vencimento : new Date();
                      const lastVal = parcelasGeradas.length > 0 ? parcelasGeradas[parcelasGeradas.length - 1].valor : 0;
                      
                      setParcelasGeradas([
                        ...parcelasGeradas,
                        {
                          id: Math.random().toString(36).substr(2, 9),
                          numero: lastNum + 1,
                          vencimento: addMonths(lastDate, 1),
                          valor: lastVal
                        }
                      ]);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Adicionar parcela
                  </Button>
                </div>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-muted/50 rounded-xl border-2 border-dashed border-muted-foreground/20">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Total de parcelas</p>
                    <p className="text-xl font-bold">{parcelasGeradas.length}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Valor das parcelas</p>
                    <p className="text-xl font-bold">R$ {parcelasGeradas.reduce((acc, p) => acc + p.valor, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Taxa de matrícula</p>
                    <p className="text-xl font-bold">
                      {isNegociacaoPersonalizada 
                        ? `R$ ${negociacao.valorEntrada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : (taxaStatus === 'isentar' ? "Isenta" : `R$ ${pacotes?.find(p => p.id === selectedPacote)?.valor_matricula.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`)
                      }
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Total Geral</p>
                    <p className="text-2xl font-black text-primary">
                      R$ {(parcelasGeradas.reduce((acc, p) => acc + p.valor, 0) + 
                        (isNegociacaoPersonalizada 
                          ? negociacao.valorEntrada 
                          : (taxaStatus === 'cobrar' ? (pacotes?.find(p => p.id === selectedPacote)?.valor_matricula || 0) : 0)
                        )).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-3 pt-8">
            <Button variant="outline" onClick={() => setStep(3)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Button 
              size="lg"
              className="bg-primary hover:bg-primary/90 font-bold"
              disabled={parcelasGeradas.length === 0}
              onClick={() => {
                setUnlockedSteps(prev => [...prev, 5]);
                setStep(5);
              }}
            >
              Continuar para Contrato <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
          <div className="space-y-8">
            {['pix', 'boleto', 'cartao'].map(tipo => {
              const pacotesDoTipo = pacotes?.filter(p => p.tipo === tipo) || [];
              if (pacotesDoTipo.length === 0) return null;

              return (
                <div key={tipo} className="space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b">
                    <div className={cn(
                      "w-1 h-4 rounded-full",
                      tipo === 'pix' ? "bg-green-500" : tipo === 'boleto' ? "bg-blue-500" : "bg-purple-500"
                    )} />
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                      Grupo {tipo === 'pix' ? 'PIX' : tipo === 'boleto' ? 'Boleto' : 'Cartão'}
                    </h3>
                  </div>
                  
                  <div className="grid gap-2">
                    {pacotesDoTipo.map(p => {
                      const isSelected = selectedPacote === p.id;
                      return (
                        <div 
                          key={p.id}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer bg-white hover:border-primary/30 group",
                            isSelected ? "border-primary shadow-sm ring-1 ring-primary/10" : "border-muted"
                          )}
                          onClick={() => {
                            setSelectedPacote(p.id);
                            setIsNegociacaoPersonalizada(false);
                          }}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <Badge className={cn(
                              "font-bold px-2 py-0.5 text-[10px] uppercase",
                              tipo === 'pix' ? "bg-green-100 text-green-700 hover:bg-green-100" : 
                              tipo === 'boleto' ? "bg-blue-100 text-blue-700 hover:bg-blue-100" : 
                              "bg-purple-100 text-purple-700 hover:bg-purple-100"
                            )}>
                              {tipo}
                            </Badge>
                            
                            <div className="flex-1">
                              <p className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">{p.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.numero_parcelas}x R$ {p.valor_parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total</p>
                              <p className="font-black text-base text-primary">
                                R$ {p.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                              isSelected ? "border-primary bg-primary text-white" : "border-muted-foreground/30"
                            )}>
                              {isSelected && <Check className="h-3 w-3" strokeWidth={4} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Negociação Personalizada Option */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b">
                <div className="w-1 h-4 rounded-full bg-orange-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Outras Opções
                </h3>
              </div>
              
              <div 
                className={cn(
                  "flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer bg-white hover:border-primary/30 group",
                  isNegociacaoPersonalizada ? "border-primary shadow-sm ring-1 ring-primary/10" : "border-muted"
                )}
                onClick={() => {
                  setIsNegociacaoPersonalizada(true);
                  setSelectedPacote(null);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge className="font-bold px-2 py-0.5 text-[10px] uppercase bg-orange-100 text-orange-700 hover:bg-orange-100">
                      Personalizado
                    </Badge>
                    <div>
                      <p className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">Negociação Personalizada</p>
                      <p className="text-xs text-muted-foreground">Defina manualmente os valores e parcelas</p>
                    </div>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                    isNegociacaoPersonalizada ? "border-primary bg-primary text-white" : "border-muted-foreground/30"
                  )}>
                    {isNegociacaoPersonalizada && <Check className="h-3 w-3" strokeWidth={4} />}
                  </div>
                </div>

                {isNegociacaoPersonalizada && (
                  <div className="mt-6 space-y-4 p-4 bg-muted/20 rounded-lg animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Forma de Pagamento</Label>
                        <RadioGroup 
                          value={negociacao.formaPagamento} 
                          onValueChange={(v) => setNegociacao(prev => ({ ...prev, formaPagamento: v }))}
                          className="flex flex-wrap gap-4 mt-2"
                        >
                          {["PIX", "Boleto", "Cartão", "Carnê"].map(opt => (
                            <div key={opt} className="flex items-center space-x-2">
                              <RadioGroupItem value={opt.toLowerCase()} id={`neg-${opt}`} />
                              <Label htmlFor={`neg-${opt}`} className="text-xs font-medium cursor-pointer">{opt}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="valorEntrada">Valor da Entrada (R$)</Label>
                        <Input 
                          id="valorEntrada"
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={negociacao.valorEntrada || ""}
                          onChange={(e) => setNegociacao(prev => ({ ...prev, valorEntrada: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="numParcelas">Número de Parcelas</Label>
                        <Input 
                          id="numParcelas"
                          type="number"
                          placeholder="Ex: 12"
                          value={negociacao.numeroParcelas || ""}
                          onChange={(e) => setNegociacao(prev => ({ ...prev, numeroParcelas: parseInt(e.target.value) || 0 }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="valorParcela">Valor de cada Parcela (R$)</Label>
                        <Input 
                          id="valorParcela"
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={negociacao.valorParcela || ""}
                          onChange={(e) => setNegociacao(prev => ({ ...prev, valorParcela: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="obsNegociacao">Observação / Justificativa</Label>
                      <Input 
                        id="obsNegociacao"
                        placeholder="Ex: Negociado em 2x de R$ 634"
                        value={negociacao.observacao}
                        onChange={(e) => setNegociacao(prev => ({ ...prev, observacao: e.target.value }))}
                      />
                    </div>

                    <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg flex justify-between items-center">
                      <span className="text-xs font-semibold text-primary uppercase">Valor Total Negociado</span>
                      <span className="text-lg font-black text-primary">
                        R$ {(negociacao.valorEntrada + (negociacao.numeroParcelas * negociacao.valorParcela)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Resumo Fixo no Rodapé */}
          {(selectedPacote || isNegociacaoPersonalizada) && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50 animate-in slide-in-from-bottom-full duration-500 shadow-[0_-8px_30px_rgb(0,0,0,0.12)]">
              <div className="max-w-4xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pacote Selecionado</p>
                    <p className="font-bold text-sm">
                      {isNegociacaoPersonalizada ? "Negociação Personalizada" : pacotes?.find(p => p.id === selectedPacote)?.nome}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-muted" />
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Entrada</p>
                    <p className="font-bold text-sm">
                      R$ {isNegociacaoPersonalizada 
                        ? negociacao.valorEntrada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                        : pacotes?.find(p => p.id === selectedPacote)?.valor_matricula.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                      }
                    </p>
                  </div>
                  <div className="h-8 w-px bg-muted" />
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Valor Total</p>
                    <p className="font-black text-lg text-primary">
                      R$ {isNegociacaoPersonalizada 
                        ? (negociacao.valorEntrada + (negociacao.numeroParcelas * negociacao.valorParcela)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                        : pacotes?.find(p => p.id === selectedPacote)?.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                  </Button>
                  <Button 
                    size="lg"
                    className="px-8 font-bold"
                    disabled={saveStep3.isPending}
                    onClick={() => saveStep3.mutate()}
                  >
                    {saveStep3.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Confirmar e avançar <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!selectedPacote && !isNegociacaoPersonalizada && (
            <div className="flex justify-between pt-6">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Button>
              <Button disabled variant="outline">
                Selecione um pacote para continuar
              </Button>
            </div>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {!selectedModeloId ? (
            <Card>
              <CardHeader>
                <CardTitle>Selecionar Modelo de Contrato</CardTitle>
                <CardDescription>Escolha um dos modelos abaixo para gerar o contrato desta matrícula.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {modelos?.map((modelo: any) => (
                  <Button
                    key={modelo.id}
                    variant="outline"
                    className="h-auto py-6 flex flex-col items-center gap-3 hover:border-primary hover:bg-primary/5 transition-all group"
                    onClick={() => {
                      setSelectedModeloId(modelo.id);
                      generateContract(modelo.id);
                    }}
                  >
                    <FileText className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
                    <span className="font-bold text-base">{modelo.nome}</span>
                  </Button>
                ))}
                {(!modelos || modelos.length === 0) && (
                  <div className="col-span-full text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                    <p>Nenhum modelo de contrato encontrado.</p>
                    <Button variant="link" onClick={() => navigate({ to: "/configuracoes" })}>
                      Cadastrar modelos em Configurações
                    </Button>
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-muted/30 border-t p-4">
                <Button variant="ghost" onClick={() => setStep(4)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Pagamentos
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card className="flex flex-col min-h-[600px]">
              <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                <div>
                  <CardTitle>Edição do Contrato</CardTitle>
                  <CardDescription>Revise e ajuste o conteúdo se necessário antes de finalizar.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedModeloId(null)}>
                  Trocar Modelo
                </Button>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                <RichTextEditor 
                  content={contractContent} 
                  onChange={setContractContent}
                  className="min-h-[500px]"
                />

              </CardContent>
              <CardFooter className="border-t p-6 flex justify-between bg-white sticky bottom-0 z-10">
                <Button variant="outline" onClick={() => setStep(4)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
                <Button 
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 font-bold px-10"
                  disabled={concludeMatricula.isPending}
                  onClick={() => concludeMatricula.mutate()}
                >
                  {concludeMatricula.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  Finalizar Matrícula
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      )}

      <Dialog open={showAccessModal} onOpenChange={(o) => {
        if (!o) {
          setShowAccessModal(false);
          setUnlockedSteps(prev => prev.includes(2) ? prev : [...prev, 2]);
          setStep(2);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">✅ Aluno cadastrado com sucesso!</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <p className="text-center font-bold text-sm border-b pb-2">Dados de acesso do aluno</p>
              
              <div className="space-y-1">
                <p className="text-sm"><strong>Nome:</strong> {accessData?.nome}</p>
                <p className="text-sm"><strong>CTR:</strong> {accessData?.ctr}</p>
              </div>

              <div className="space-y-1 pt-2">
                <p className="text-sm flex justify-between">
                  <span>🔑 <strong>Login:</strong></span>
                  <span className="font-mono">{accessData?.ctr}</span>
                </p>
                <p className="text-sm flex justify-between">
                  <span>🔒 <strong>Senha:</strong></span>
                  <span className="font-mono text-primary font-bold">{accessData?.pass}</span>
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md text-center">
              <p className="text-[11px] text-yellow-800 font-medium">
                ⚠️ Anote e envie esses dados ao aluno. A senha não será exibida novamente.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                const text = `*SEJA BEM VINDO*\n\n` +
                             `Gostaríamos de dar as Boas Vindas e que você seja bem vindo(a) a nossa Escola.\n` +
                             `Abaixo segue o seu Login e Senha para assistir as aulas do seu Preparatório e acesso as Apostilas.\n\n` +
                             `*Login:* ${accessData?.ctr}\n` +
                             `*Senha:* ${accessData?.pass}\n\n` +
                             `Suas aulas já estão liberadas para assistir.\n` +
                             `Agora basta acessar o Link abaixo e colocar seu Login e Senha.\n\n` +
                             `Segue abaixo o link de acesso a Plataforma da Escola Soluções Online\n` +
                             `https://sistemasolucoesonline.lovable.app/aluno/login`;
                navigator.clipboard.writeText(text);
                toast.success("Dados copiados para a área de transferência!");
              }}
            >
              <Copy className="h-4 w-4 mr-2" /> Copiar dados
            </Button>
            <Button 
              className="flex-1"
              onClick={() => {
                setShowAccessModal(false);
                setUnlockedSteps(prev => prev.includes(2) ? prev : [...prev, 2]);
                setStep(2);
              }}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isProcessingAsaas && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl border-2 border-primary/20 max-w-sm w-full space-y-6">
            <div className="relative">
              <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{asaasProgress.total > 0 ? Math.round((asaasProgress.current / asaasProgress.total) * 100) : 0}%</span>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-primary">Integrando com Asaas</h3>
              <p className="text-muted-foreground text-sm">
                Gerando cobrança {asaasProgress.current} de {asaasProgress.total}...
              </p>
              <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-300" 
                  style={{ width: `${asaasProgress.total > 0 ? (asaasProgress.current / asaasProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Isso pode levar alguns segundos. Por favor, não feche a janela.</p>
          </div>
        </div>
      )}


      <Dialog open={showConclusion} onOpenChange={(o) => !o && navigate({ to: "/alunos" })}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="text-center text-3xl font-black">Matrícula Realizada com Sucesso!</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Acesso do Aluno */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <ShieldPlus className="h-4 w-4" /> Acesso do Aluno
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 p-4 rounded-xl border relative group">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Login (CTR)</p>
                  <p className="font-mono font-bold text-lg">{accessData?.ctr}</p>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-2 top-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      navigator.clipboard.writeText(accessData?.ctr?.toString() || "");
                      toast.success("Login copiado!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="bg-muted/50 p-4 rounded-xl border relative group">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Senha Padrão</p>
                  <p className="font-mono font-bold text-lg text-primary">{accessData?.pass}</p>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-2 top-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      navigator.clipboard.writeText(accessData?.pass || "");
                      toast.success("Senha copiada!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Link do Contrato */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Link do Contrato
              </h3>
              <div className="flex gap-2">
                <Input value={contractLink || ""} readOnly className="font-mono text-sm h-12 bg-muted/30" />
                <Button 
                  variant="outline"
                  className="h-12 px-4"
                  onClick={() => {
                    navigator.clipboard.writeText(contractLink || "");
                    toast.success("Link do contrato copiado!");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button className="w-full" onClick={() => navigate({ to: "/alunos" })}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
