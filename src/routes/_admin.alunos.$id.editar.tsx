import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2, Check, Search, Calendar as CalendarIcon, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/PageHeader";
import { AlunoForm } from "@/components/admin/AlunoForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { BaixaModal } from "@/components/admin/BaixaModal";
import { ResumoBaixaModal } from "@/components/admin/ResumoBaixaModal";
import { AgendamentoProvaFinal } from "@/components/admin/AgendamentoProvaFinal";
import { formatCurrency } from "@/lib/format";
import { notifyPagamentoRecebido } from "@/lib/notify";

export const Route = createFileRoute("/_admin/alunos/$id/editar")({
  head: () => ({ meta: [{ title: "Editar aluno — Soluções Online" }] }),
  component: EditarAluno,
});

function EditarAluno() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("dados");

  const { data: aluno, isLoading: loadingAluno } = useQuery({
    queryKey: ["aluno", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: matricula, isLoading: loadingMatricula } = useQuery({
    queryKey: ["aluno-matricula-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("matriculas").select("id").eq("aluno_id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: cursosDisponiveis } = useQuery({
    queryKey: ["cursos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cursos").select("*").eq("ativo", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: cursosAtuais, refetch: refetchCursos } = useQuery({
    queryKey: ["aluno-cursos-edit", id],
    enabled: !!matricula,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matricula_cursos")
        .select("curso_id")
        .eq("matricula_id", matricula!.id);
      if (error) throw error;
      return data.map(c => c.curso_id);
    },
  });

  const { data: parcelasAtuais, refetch: refetchParcelas } = useQuery({
    queryKey: ["aluno-parcelas-edit", id],
    enabled: !!matricula,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas")
        .select("*")
        .eq("matricula_id", matricula!.id)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const updateAluno = useMutation({
    mutationFn: async (v: any) => {
      const { email, ...rest } = v;
      let finalEmail = email || null;

      // Se o email foi removido e não tem um, gera o fictício baseado no CTR existente
      if (!finalEmail && aluno?.ctr) {
        finalEmail = `ctr${aluno.ctr}@solucoesonline.com.br`;
      }

      const vendedoraAnterior = aluno?.vendedora ?? null;
      const vendedoraNova = rest.vendedora ?? null;

      const { error } = await supabase
        .from("alunos")
        .update({
          ...rest,
          email: finalEmail,
          responsavel_email: v.responsavel_email || null
        })
        .eq("id", id);
      if (error) throw error;

      // Reatribuir comissões quando o vendedor é alterado
      let vendedoraFoiAlterada = false;
      if (vendedoraNova !== vendedoraAnterior) {
        const { data: matriculasAluno } = await supabase
          .from("matriculas")
          .select("id")
          .eq("aluno_id", id);
        const matriculaIds = (matriculasAluno ?? []).map((m: any) => m.id);

        // Resolver novo colaborador pelo nome (Agente IA / Admin / vazio = sem colaborador)
        let novoColaborador: { id: string; comissao_avista: number | null; comissao_parcelado: number | null } | null = null;
        if (vendedoraNova && !["🤖 Agente IA", "👤 Admin"].includes(vendedoraNova)) {
          const { data: colab } = await supabase
            .from("colaboradores")
            .select("id, comissao_avista, comissao_parcelado")
            .eq("nome", vendedoraNova)
            .maybeSingle();
          novoColaborador = colab as any;
        }

        // Atualizar colaborador_id em todas as matrículas do aluno
        if (matriculaIds.length > 0) {
          await supabase
            .from("matriculas")
            .update({ colaborador_id: novoColaborador?.id ?? null })
            .in("id", matriculaIds);

          // Atualizar comissões existentes IN-PLACE (transferir para nova vendedora)
          const { data: comissoesExistentes } = await supabase
            .from("comissoes")
            .select("id, tipo_pagamento")
            .in("matricula_id", matriculaIds)
            .eq("estornado", false);

          if (comissoesExistentes && comissoesExistentes.length > 0) {
            for (const c of comissoesExistentes as any[]) {
              const novoValor = novoColaborador
                ? (c.tipo_pagamento === "avista"
                    ? Number(novoColaborador.comissao_avista ?? 120)
                    : Number(novoColaborador.comissao_parcelado ?? 50))
                : 0;
              await supabase
                .from("comissoes")
                .update({
                  vendedora: vendedoraNova ?? "",
                  valor: novoValor,
                })
                .eq("id", c.id);
            }
          }
          vendedoraFoiAlterada = true;
        }
      }


      // Parte 4 — Estorno de comissões ao inativar
      const virouInativo = rest.status === "inativo" && aluno?.status !== "inativo";
      if (virouInativo) {
        const houveDevolucao = typeof window !== "undefined"
          && window.confirm("Houve devolução de valor para o aluno?\n\nSe sim, as comissões geradas serão marcadas como estornadas na competência deste mês.");
        if (houveDevolucao) {
          const hoje = new Date();
          const competencia = format(new Date(hoje.getFullYear(), hoje.getMonth(), 1), "yyyy-MM-dd");
          const { error: estErr } = await supabase
            .from("comissoes")
            .update({ estornado: true, estornado_em: new Date().toISOString(), estorno_competencia: competencia })
            .eq("aluno_id", id)
            .eq("estornado", false);
          if (estErr) throw estErr;
        }
      }

      return { vendedoraAlterada: vendedoraFoiAlterada, vendedoraNova };
    },

    onSuccess: (result) => {
      if (result?.vendedoraAlterada) {
        toast.success("Vendedora e comissões atualizadas com sucesso!");
      } else {
        toast.success("Dados do aluno atualizados!");
      }
      qc.invalidateQueries({ queryKey: ["alunos"] });
      qc.invalidateQueries({ queryKey: ["aluno", id] });
      qc.invalidateQueries({ queryKey: ["comissoes"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar dados", { description: e.message }),
  });

  const handleSubmitAluno = (v: any) => {
    const vendedoraAnterior = aluno?.vendedora ?? null;
    const vendedoraNova = v.vendedora ?? null;
    if (vendedoraNova !== vendedoraAnterior) {
      const nomeExibicao = vendedoraNova || "(sem vendedora)";
      const ok = window.confirm(
        `A vendedora foi alterada. As comissões desta matrícula serão transferidas para ${nomeExibicao}. Confirmar?`
      );
      if (!ok) return;
    }

    // Verifica mudança de primeiro nome → oferecer redefinição de senha
    const primeiroNomeAntigo = String(aluno?.nome ?? "").trim().split(/\s+/)[0] ?? "";
    const primeiroNomeNovo = String(v?.nome ?? "").trim().split(/\s+/)[0] ?? "";
    const mudouPrimeiroNome =
      !!primeiroNomeNovo &&
      !!primeiroNomeAntigo &&
      primeiroNomeNovo.toLowerCase() !== primeiroNomeAntigo.toLowerCase();

    let resetSenha = false;
    if (mudouPrimeiroNome) {
      const novaSenha = "1234" + primeiroNomeNovo.toLowerCase();
      resetSenha = window.confirm(
        `O primeiro nome foi alterado de "${primeiroNomeAntigo}" para "${primeiroNomeNovo}". Deseja redefinir a senha para ${novaSenha}?`
      );
    }

    updateAluno.mutate(v, {
      onSuccess: async () => {
        if (!mudouPrimeiroNome) return;
        if (!resetSenha) {
          toast.info("Nome atualizado. Senha mantida.");
          return;
        }
        const novaSenha = "1234" + primeiroNomeNovo.toLowerCase();
        const emailAlvo = aluno?.email || (aluno?.ctr ? `ctr${aluno.ctr}@solucoesonline.com.br` : null);
        if (!emailAlvo) {
          toast.error("E-mail do aluno não encontrado para redefinir senha.");
          return;
        }
        const { error } = await supabase.rpc("redefinir_senha_aluno", {
          p_email: emailAlvo,
          p_nova_senha: novaSenha,
        });
        if (error) {
          toast.error("Erro ao redefinir senha", { description: error.message });
        } else {
          toast.success("Nome e senha atualizados com sucesso!");
        }
      },
    });
  };


  if (loadingAluno) return <div className="p-8 text-center">Carregando aluno...</div>;
  if (!aluno) return <div className="p-8 text-center">Aluno não encontrado.</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Editando: ${aluno.nome}`}
        actions={
          <Button asChild variant="outline">
            <Link to="/alunos/$id" params={{ id }}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="cursos">Cursos</TabsTrigger>
          <TabsTrigger value="parcelas">Financeiro</TabsTrigger>
          <TabsTrigger value="prova-final">Prova Final</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="animate-in fade-in-50 duration-300">
          <AlunoForm
            initialValues={aluno}
            isEdit={true}
            submitting={updateAluno.isPending}
            submitLabel="Salvar alterações"
            onSubmit={handleSubmitAluno}
          />
        </TabsContent>

        <TabsContent value="cursos" className="animate-in fade-in-50 duration-300">
          <EditarCursos 
            matriculaId={matricula?.id} 
            alunoId={id}
            cursosDisponiveis={cursosDisponiveis || []} 
            cursosAtuais={cursosAtuais || []}
            onSuccess={() => refetchCursos()}
          />
        </TabsContent>

        <TabsContent value="parcelas" className="animate-in fade-in-50 duration-300">
          <EditarParcelas 
            matriculaId={matricula?.id}
            alunoId={id}
            parcelas={parcelasAtuais || []}
            onSuccess={() => {
              refetchParcelas();
              qc.invalidateQueries({ queryKey: ["aluno-parcelas", id] });
            }}
          />
        </TabsContent>

        <TabsContent value="prova-final" className="animate-in fade-in-50 duration-300">
          <div className="space-y-6">
            <ConfigurarProvaFinal 
              aluno={aluno}
              matriculaId={matricula?.id}
              onSuccess={() => {
                qc.invalidateQueries({ queryKey: ["aluno", id] });
                qc.invalidateQueries({ queryKey: ["aluno-matricula-edit", id] });
              }}
            />
            <AgendamentoProvaFinal alunoId={id} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConfigurarProvaFinal({ aluno, matriculaId, onSuccess }: any) {
  const [dias, setDias] = useState(aluno.dias_prova_final || 60);
  const [saving, setSaving] = useState(false);

  const dataMatricula = new Date(aluno.created_at);
  const dataLiberacao = new Date(dataMatricula);
  dataLiberacao.setDate(dataMatricula.getDate() + Number(dias));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = dataLiberacao.getTime() - today.getTime();
  const diasRestantes = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));



  const handleSave = async () => {
    setSaving(true);
    try {
      const dataLiberacaoStr = format(dataLiberacao, 'yyyy-MM-dd');
      
      // 1. Update aluno
      const { error: errA } = await supabase
        .from("alunos")
        .update({
          dias_prova_final: Number(dias),
          data_liberacao_prova: dataLiberacaoStr,
        })

        .eq("id", aluno.id);
      
      if (errA) throw errA;

      // 2. Update data_liberacao in matricula_cursos for Prova Final course
      if (matriculaId) {
        const { data: cursoPF } = await supabase
          .from("cursos")
          .select("id")
          .eq("is_prova_final", true)
          .maybeSingle();

        if (cursoPF) {
          const { error: errMC } = await supabase
            .from("matricula_cursos")
            .update({ data_liberacao: dataLiberacaoStr })
            .eq("matricula_id", matriculaId)
            .eq("curso_id", cursoPF.id);
          
          if (errMC) {
            console.error("Erro ao atualizar data_liberacao em matricula_cursos:", errMC);
          }
        }
      }

      toast.success("Configurações da Prova Final salvas!");
      onSuccess();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Configurações da Prova Final</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <Label>Prazo em dias</Label>
            <Input 
              type="number" 
              value={dias} 
              onChange={(e) => setDias(e.target.value)}
              min={0}
            />
          </div>

          <div className="space-y-2">
            <Label>Data da Matrícula</Label>
            <div className="p-2 border rounded-md bg-muted/50 text-sm">
              {format(dataMatricula, 'dd/MM/yyyy')}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Liberação Calculada</Label>
            <div className="p-2 border rounded-md bg-muted/50 text-sm font-bold text-blue-600">
              {format(dataLiberacao, 'dd/MM/yyyy')}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dias Restantes</Label>
            <div className="p-2 border rounded-md bg-muted/50 text-sm font-bold">
              {diasRestantes} dias
            </div>
          </div>
        </div>


        <div className="pt-4">
          <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EditarCursos({ matriculaId, alunoId, cursosDisponiveis, cursosAtuais, onSuccess }: any) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSelected(cursosAtuais);
  }, [cursosAtuais]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let targetMatriculaId = matriculaId;

      if (!targetMatriculaId) {
        const { data: newM, error: errM } = await supabase
          .from("matriculas")
          .insert({ aluno_id: alunoId })
          .select("id")
          .single();
        if (errM) throw errM;
        targetMatriculaId = newM.id;
      }

      // 1. Delete old
      const { error: errD } = await supabase
        .from("matricula_cursos")
        .delete()
        .eq("matricula_id", targetMatriculaId);
      if (errD) throw errD;

      // 2. Insert new
      if (selected.length > 0) {
        const toInsert = selected.map(cid => ({
          matricula_id: targetMatriculaId,
          curso_id: cid
        }));
        const { error: errI } = await supabase.from("matricula_cursos").insert(toInsert);
        if (errI) throw errI;
      }

      toast.success("Cursos atualizados!");
      onSuccess();
    } catch (e: any) {
      toast.error("Erro ao atualizar cursos", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const { data: segmentos } = useQuery({
    queryKey: ["segmentos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("segmentos")
        .select("id, nome")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const termo = search.toLowerCase();
  const filtered = cursosDisponiveis.filter((c: any) =>
    c.nome.toLowerCase().includes(termo)
  );

  const grupos: { id: string | null; nome: string; cursos: any[] }[] = [
    ...(segmentos || []).map((s: any) => ({
      id: s.id,
      nome: s.nome,
      cursos: filtered.filter((c: any) => c.segmento_id === s.id),
    })),
    {
      id: null,
      nome: "Sem segmento",
      cursos: filtered.filter((c: any) => !c.segmento_id),
    },
  ].filter((g) => g.cursos.length > 0);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar curso..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar Cursos
          </Button>
        </div>

        <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
          {grupos.map((g) => (
            <div key={g.id ?? "sem-segmento"} className="space-y-2">
              <h4 className="text-sm font-bold uppercase tracking-wide text-muted-foreground border-b pb-1">
                {g.nome}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {g.cursos.map((c: any) => (
                  <div
                    key={c.id}
                    className={cn(
                      "flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50",
                      selected.includes(c.id) && "bg-primary/5 border-primary"
                    )}
                    onClick={() => {
                      setSelected((prev) =>
                        prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                      );
                    }}
                  >
                    <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => {}} />
                    <span className="text-sm font-medium">{c.nome}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EditarParcelas({ matriculaId, alunoId, parcelas, onSuccess }: any) {
  const [localParcelas, setLocalParcelas] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [showBaixaModal, setShowBaixaModal] = useState(false);
  const [baixaData, setBaixaData] = useState<{ id: string, valor: number } | null>(null);
  const [resumoBaixa, setResumoBaixa] = useState<{
    formaPagamento: string;
    parcelas?: number;
    valorBruto: number;
    taxa?: number;
    valorLiquido: number;
    dataPagamento: string;
  } | null>(null);
  const [showDiaModal, setShowDiaModal] = useState(false);
  const [novoDia, setNovoDia] = useState("");
  const [alterandoDia, setAlterandoDia] = useState(false);

  const handleAlterarDia = async () => {
    const dia = parseInt(novoDia);
    if (isNaN(dia) || dia < 1 || dia > 31) {
      toast.error("Informe um dia válido entre 1 e 31");
      return;
    }
    setAlterandoDia(true);
    try {
      const pendentes = localParcelas.filter((p) => p.status === 'aberto');
      let count = 0;
      for (const p of pendentes) {
        const venc = typeof p.data_vencimento === 'string'
          ? new Date(p.data_vencimento + 'T00:00:00')
          : new Date(p.data_vencimento);
        const ano = venc.getFullYear();
        const mes = venc.getMonth();
        const ultimoDia = new Date(ano, mes + 1, 0).getDate();
        const diaFinal = Math.min(dia, ultimoDia);
        const novaData = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`;
        const { error } = await supabase.from("parcelas").update({ data_vencimento: novaData }).eq("id", p.id);
        if (error) throw error;
        count++;
      }
      toast.success(`${count} parcelas atualizadas com sucesso!`);
      setShowDiaModal(false);
      onSuccess();
    } catch (e: any) {
      toast.error("Erro ao alterar vencimentos", { description: e.message });
    } finally {
      setAlterandoDia(false);
    }
  };

  useEffect(() => {
    setLocalParcelas(parcelas);
  }, [parcelas]);

  const handleUpdateLocal = (id: string, field: string, value: any) => {
    setLocalParcelas(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = localParcelas.map(p => ({
        id: p.id,
        valor: Number(p.valor),
        data_vencimento: typeof p.data_vencimento === 'string' ? p.data_vencimento : format(p.data_vencimento, 'yyyy-MM-dd'),
        status: p.status,
        data_pagamento: p.data_pagamento
      }));

      for (const upd of updates) {
        const { error } = await supabase.from("parcelas").update(upd).eq("id", upd.id);
        if (error) throw error;
      }

      toast.success("Parcelas salvas!");
      onSuccess();
    } catch (e: any) {
      toast.error("Erro ao salvar parcelas", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const addParcela = async () => {
    if (!matriculaId) {
      toast.error("O aluno precisa de uma matrícula primeiro (adicione um curso).");
      return;
    }
    
    const maxNum = Math.max(0, ...localParcelas.filter(p => p.tipo === 'parcela').map(p => p.numero || 0));
    
    const newParcela = {
      matricula_id: matriculaId,
      tipo: 'parcela' as const,
      numero: maxNum + 1,
      valor: 0,
      data_vencimento: format(new Date(), 'yyyy-MM-dd'),
      status: 'aberto' as const
    };

    const { data, error } = await supabase.from("parcelas").insert(newParcela).select().single();
    if (error) {
      toast.error("Erro ao criar parcela: " + error.message);
      return;
    }
    
    setLocalParcelas(prev => [...prev, data]);
    toast.success("Nova parcela adicionada!");
  };

  const confirmBaixa = async (data: any) => {
    if (!baixaData) return;
    try {
      const { error } = await supabase
        .from("parcelas")
        .update({
          status: 'pago',
          ...data
        })
        .eq("id", baixaData.id);
      
      if (error) throw error;
      notifyPagamentoRecebido(baixaData.id, baixaData.valor, data.forma_pagamento);
      
      
      if (data.forma_pagamento === 'cartao') {
        setResumoBaixa({
          formaPagamento: 'cartao',
          parcelas: data.parcelas_cartao,
          valorBruto: baixaData.valor,
          taxa: data.taxa_cartao,
          valorLiquido: data.valor_liquido,
          dataPagamento: data.data_pagamento,
        });
      } else {
        toast.success("Baixa realizada!");
      }
      
      setShowBaixaModal(false);
      setBaixaData(null);
      onSuccess();
    } catch (e: any) {
      toast.error("Erro ao dar baixa", { description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Gestão Financeira</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addParcela}>
            <Plus className="h-4 w-4 mr-2" /> Nova Parcela
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setNovoDia(""); setShowDiaModal(true); }}>
            <CalendarIcon className="h-4 w-4 mr-2" /> Alterar dia de vencimento
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </div>

      <Dialog open={showDiaModal} onOpenChange={setShowDiaModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar dia de vencimento das parcelas</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="novo-dia">Novo dia de vencimento</Label>
              <Input id="novo-dia" type="number" min={1} max={31} value={novoDia} onChange={(e) => setNovoDia(e.target.value)} placeholder="Ex: 10" />
            </div>
            <p className="text-sm text-muted-foreground">
              Apenas parcelas com status 'pendente' serão alteradas. Parcelas já pagas não serão afetadas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiaModal(false)} disabled={alterandoDia}>Cancelar</Button>
            <Button onClick={handleAlterarDia} disabled={alterandoDia}>
              {alterandoDia && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Tipo / Nº</th>
              <th className="px-4 py-2 text-left font-medium">Vencimento</th>
              <th className="px-4 py-2 text-left font-medium">Valor (R$)</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {localParcelas.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-4 py-2">
                  <span className="font-medium text-xs">
                    {p.tipo === 'taxa_matricula' ? 'Taxa' : `Parcela ${p.numero}`}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <Input 
                    type="date" 
                    className="h-8 py-0"
                    value={p.data_vencimento}
                    onChange={(e) => handleUpdateLocal(p.id, 'data_vencimento', e.target.value)}
                  />
                </td>
                <td className="px-4 py-2">
                  <Input 
                    type="number" 
                    className="h-8 py-0 w-24"
                    value={p.valor}
                    onChange={(e) => handleUpdateLocal(p.id, 'valor', e.target.value)}
                  />
                </td>
                <td className="px-4 py-2">
                  <Select 
                    value={p.status} 
                    onValueChange={(v) => handleUpdateLocal(p.id, 'status', v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aberto">Aberto</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="isento">Isento</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-2 text-right">
                  {p.status === 'aberto' && (
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-green-600"
                      onClick={() => {
                        setBaixaData({ id: p.id, valor: Number(p.valor) });
                        setShowBaixaModal(true);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BaixaModal 
        open={showBaixaModal}
        onOpenChange={setShowBaixaModal}
        isLoading={saving}
        valorOriginal={baixaData?.valor || 0}
        onConfirm={confirmBaixa}
      />

      <ResumoBaixaModal 
        open={!!resumoBaixa}
        onOpenChange={(open) => !open && setResumoBaixa(null)}
        data={resumoBaixa}
      />
    </div>
  );
}
