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

export const Route = createFileRoute("/_admin/alunos/$id/editar")({
  head: () => ({ meta: [{ title: "Editar aluno — EduManager" }] }),
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
      const { error } = await supabase
        .from("alunos")
        .update({ ...v, responsavel_email: v.responsavel_email || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados do aluno atualizados!");
      qc.invalidateQueries({ queryKey: ["alunos"] });
      qc.invalidateQueries({ queryKey: ["aluno", id] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar dados", { description: e.message }),
  });

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
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="cursos">Cursos</TabsTrigger>
          <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="animate-in fade-in-50 duration-300">
          <AlunoForm
            initialValues={aluno}
            isEdit={true}
            submitting={updateAluno.isPending}
            submitLabel="Salvar alterações"
            onSubmit={(v) => updateAluno.mutate(v)}
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
      </Tabs>
    </div>
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

  const filtered = cursosDisponiveis.filter((c: any) => 
    c.nome.toLowerCase().includes(search.toLowerCase())
  );

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto pr-2">
          {filtered.map((c: any) => (
            <div 
              key={c.id}
              className={cn(
                "flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50",
                selected.includes(c.id) && "bg-primary/5 border-primary"
              )}
              onClick={() => {
                setSelected(prev => 
                  prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                );
              }}
            >
              <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => {}} />
              <span className="text-sm font-medium">{c.nome}</span>
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
  const [baixaData, setBaixaData] = useState<{ id: string, date: Date } | null>(null);

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
      tipo: 'parcela',
      numero: maxNum + 1,
      valor: 0,
      data_vencimento: format(new Date(), 'yyyy-MM-dd'),
      status: 'aberto'
    };

    const { data, error } = await supabase.from("parcelas").insert(newParcela).select().single();
    if (error) {
      toast.error("Erro ao criar parcela: " + error.message);
      return;
    }
    
    setLocalParcelas(prev => [...prev, data]);
    toast.success("Nova parcela adicionada!");
  };

  const confirmBaixa = async () => {
    if (!baixaData) return;
    try {
      const { error } = await supabase
        .from("parcelas")
        .update({
          status: 'pago',
          data_pagamento: format(baixaData.date, 'yyyy-MM-dd')
        })
        .eq("id", baixaData.id);
      
      if (error) throw error;
      
      toast.success("Baixa realizada!");
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
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </div>

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
                        setBaixaData({ id: p.id, date: new Date() });
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

      <Dialog open={showBaixaModal} onOpenChange={setShowBaixaModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Data do Pagamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {baixaData?.date ? format(baixaData.date, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={baixaData?.date}
                    onSelect={(d) => d && setBaixaData(prev => prev ? { ...prev, date: d } : null)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBaixaModal(false)}>Cancelar</Button>
            <Button onClick={confirmBaixa}>Confirmar Baixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
