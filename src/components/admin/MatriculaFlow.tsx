import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Check, ArrowLeft, ArrowRight, Loader2, GraduationCap, Copy, Calendar as CalendarIcon, Trash2, Plus, Wallet } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addMonths, setDate, lastDayOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { AlunoForm, type AlunoFormValues } from "./AlunoForm";
import { maskCPF, maskPhone, isValidCPF, calcAge, generateStudentPassword } from "@/lib/format";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type Step = 1 | 2 | 3 | 4;

export function MatriculaFlow({ initialAlunoId }: { initialAlunoId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [unlockedSteps, setUnlockedSteps] = useState<Step[]>([1]);
  const [alunoId, setAlunoId] = useState<string | undefined>(initialAlunoId);
  const [matriculaId, setMatriculaId] = useState<string | undefined>();
  
  // State for Step 2: Cursos
  const [selectedCursos, setSelectedCursos] = useState<string[]>([]);
  const [searchCurso, setSearchCurso] = useState("");
  
  // State for Step 3: Pacotes
  const [selectedPacote, setSelectedPacote] = useState<string | null>(null);

  // State for Step 4: Pagamentos
  const [taxaStatus, setTaxaStatus] = useState<"cobrar" | "isentar">("cobrar");
  const [taxaVencimento, setTaxaVencimento] = useState<Date>(new Date());
  const [melhorDia, setMelhorDia] = useState<string>("");
  const [parcelasGeradas, setParcelasGeradas] = useState<any[]>([]);

  const [showConclusion, setShowConclusion] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessData, setAccessData] = useState<{ email: string; pass: string; ctr?: number; nome?: string } | null>(null);

  const { data: cursos } = useQuery({
    queryKey: ["cursos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select("id, nome, aulas(count)")
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

  const { data: aluno } = useQuery({
    queryKey: ["aluno-matricula", alunoId as string],
    enabled: !!alunoId,
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("*").eq("id", alunoId!).single();
      if (error) throw error;
      return data;
    },
  });

  const saveStep2 = useMutation({
    mutationFn: async () => {
      if (!alunoId) throw new Error("Aluno não identificado");
      
      // 1. Create matricula
      const { data: m, error: me } = await supabase
        .from("matriculas")
        .insert({ aluno_id: alunoId })
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
      if (!matriculaId || !selectedPacote) throw new Error("Dados incompletos");

      // 1. Save package
      const { error: pe } = await supabase.from("matricula_pacotes").insert({
        matricula_id: matriculaId,
        pacote_id: selectedPacote
      });
      if (pe) throw pe;

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
      if (!matriculaId || !aluno) throw new Error("Dados incompletos");

      const currentPacote = pacotes?.find(p => p.id === selectedPacote);
      if (!currentPacote) throw new Error("Pacote não encontrado");

      const allParcelas: any[] = [];

      // Add Taxa de Matrícula
      allParcelas.push({
        matricula_id: matriculaId,
        tipo: 'taxa_matricula' as const,
        numero: 0,
        valor: currentPacote.valor_matricula,
        data_vencimento: taxaStatus === 'isentar' ? format(new Date(), 'yyyy-MM-dd') : format(taxaVencimento, 'yyyy-MM-dd'),
        status: taxaStatus === 'isentar' ? ('isento' as const) : ('aberto' as const)
      });

      // Add Parcelas
      parcelasGeradas.forEach(p => {
        allParcelas.push({
          matricula_id: matriculaId,
          tipo: 'parcela' as const,
          numero: p.numero,
          valor: p.valor,
          data_vencimento: format(p.vencimento, 'yyyy-MM-dd'),
          status: 'aberto' as const
        });
      });

      const { error } = await supabase.from('parcelas').insert(allParcelas);
      if (error) throw error;

      return true;
    },
    onSuccess: () => {
      setShowConclusion(true);
      qc.invalidateQueries({ queryKey: ["alunos"] });
    },
    onError: (e: any) => toast.error(e.message)
  });

  const filteredCursos = (cursos || []).filter(c => 
    c.nome.toLowerCase().includes(searchCurso.toLowerCase())
  );

  const toggleCurso = (id: string) => {
    setSelectedCursos(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAllCursos = (checked: boolean) => {
    if (checked) {
      setSelectedCursos(filteredCursos.map(c => c.id));
    } else {
      setSelectedCursos([]);
    }
  };

  return (
    <div className="space-y-8">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center max-w-2xl mx-auto mb-10">
        {[1, 2, 3, 4].map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div 
              className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                step === s ? "border-primary bg-primary text-primary-foreground" : 
                unlockedSteps.includes(s as Step) ? "border-green-500 bg-white text-green-500" : 
                "border-gray-300 bg-gray-50 text-gray-400"
              }`}
            >
              {unlockedSteps.includes((s + 1) as Step) && s < 4 ? (
                <Check className="h-5 w-5" />
              ) : (
                <span className="text-sm font-bold">{s}</span>
              )}
              <span className="absolute -bottom-7 w-32 text-center text-xs font-medium text-muted-foreground">
                {s === 1 ? "Dados do Aluno" : s === 2 ? "Cursos" : s === 3 ? "Pacote" : "Pagamentos"}
              </span>
            </div>
            {i < 3 && (
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
              const pass = generateStudentPassword(v.nome);
              
              // 1. Create student record
              const { data: studentData, error: studentError } = await supabase.from("alunos").insert({
                ...v,
                responsavel_email: v.responsavel_email || null,
                menor_de_idade: calcAge(v.data_nascimento) < 18
              }).select("id, nome, email, ctr").single();
              
              if (studentError) {
                console.error("Erro ao salvar aluno:", studentError);
                toast.error(`Erro ao salvar: ${studentError.message}`);
                return;
              }

              // 2. Create Auth user via Edge Function
              const { error: authError } = await supabase.functions.invoke("manage-student-access", {
                body: {
                  email: studentData.email,
                  nome: studentData.nome,
                  password: pass,
                  action: "create"
                }
              });

              if (authError) {
                console.error("Erro ao criar acesso:", authError);
                toast.error(`Aluno salvo, mas houve erro ao criar acesso: ${authError.message}`);
                // Proceed anyway, admin can reset later
              }
              
              setAlunoId(studentData.id);
              setAccessData({
                email: studentData.email,
                pass: pass,
                ctr: studentData.ctr,
                nome: studentData.nome
              });
              setShowAccessModal(true);
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

              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {filteredCursos.map(curso => {
                  const aulasCount = Array.isArray(curso.aulas) ? (curso.aulas[0]?.count ?? 0) : 0;
                  const isSelected = selectedCursos.includes(curso.id);
                  return (
                    <div 
                      key={curso.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer hover:bg-muted/50 ${isSelected ? "border-primary bg-primary/5 shadow-sm" : ""}`}
                      onClick={() => toggleCurso(curso.id)}
                    >
                      <div className="flex items-center gap-4">
                        <Checkbox checked={isSelected} onCheckedChange={() => {}} />
                        <div>
                          <p className="font-semibold text-sm">{curso.nome}</p>
                          <p className="text-xs text-muted-foreground">{aulasCount} aulas</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
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

      {step === 3 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pacotes?.map(p => {
              const isSelected = selectedPacote === p.id;
              return (
                <div 
                  key={p.id}
                  className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col h-full hover:border-primary/50 ${isSelected ? "border-primary bg-primary/5 shadow-md" : "border-muted bg-white"}`}
                  onClick={() => setSelectedPacote(p.id)}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Badge variant="secondary" className="mb-2 capitalize">{p.tipo}</Badge>
                    <h3 className="font-bold text-lg mb-1">{p.nome}</h3>
                    <div className="space-y-1 text-sm text-muted-foreground mb-4">
                      <p>Entrada: R$ {p.valor_matricula.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      <p>Parcelas: {p.numero_parcelas}x R$ {p.valor_parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Valor Total</p>
                    <p className="text-2xl font-black text-primary">R$ {p.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Button 
              disabled={!selectedPacote || concludeMatricula.isPending}
              className="bg-green-600 hover:bg-green-700 h-12 px-8 text-lg"
              onClick={() => concludeMatricula.mutate()}
            >
              {concludeMatricula.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Concluir Matrícula
            </Button>
          </div>
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
                const loginUrl = `${window.location.origin}/aluno/login`;
                const text = `Olá ${accessData?.nome?.split(" ")[0]}! Seus dados de acesso:\nLogin: ${accessData?.ctr}\nSenha: ${accessData?.pass}\nAcesse: ${loginUrl}`;
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

      <Dialog open={showConclusion} onOpenChange={(o) => !o && navigate({ to: "/alunos" })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <DialogTitle className="text-center text-2xl">Matrícula Concluída!</DialogTitle>
            <DialogDescription className="text-center">
              O aluno foi matriculado com sucesso no sistema.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-muted-foreground/10">
                <span className="text-sm font-medium">Aluno:</span>
                <span className="text-sm font-bold">{aluno?.nome}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground uppercase">Cursos:</span>
                <ul className="text-xs space-y-1 list-disc pl-4">
                  {cursos?.filter(c => selectedCursos.includes(c.id)).map(c => (
                    <li key={c.id}>{c.nome}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-2 border-dashed border-primary/30 p-5 rounded-xl bg-primary/5 text-center space-y-3">
              <GraduationCap className="h-6 w-6 mx-auto text-primary" />
              <div>
                <p className="text-sm font-bold">Dados de Acesso</p>
                <p className="text-xs text-muted-foreground">O aluno utilizará os dados abaixo para logar:</p>
              </div>
              <div className="bg-white p-3 rounded border space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Login:</span>
                  <span className="font-mono font-bold">{accessData?.ctr}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Senha:</span>
                  <span className="font-mono font-bold text-primary">{accessData?.pass}</span>
                </div>
              </div>
              <p className="text-[10px] text-destructive font-bold uppercase">Anote a senha pois não será exibida novamente</p>
            </div>
          </div>

          <DialogFooter>
            <Button className="w-full" onClick={() => navigate({ to: "/alunos" })}>
              Fechar e ir para lista de alunos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
