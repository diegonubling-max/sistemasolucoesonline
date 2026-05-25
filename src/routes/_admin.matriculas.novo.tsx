import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, User, Check, Loader2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/PageHeader";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_admin/matriculas/novo")({
  head: () => ({ meta: [{ title: "Nova Matrícula — EduManager" }] }),
  component: NovaMatricula,
});

function NovaMatricula() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [observation, setObservation] = useState("");
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [generatedAccess, setGeneratedAccess] = useState<any>(null);

  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ["students-search", studentSearch],
    queryFn: async () => {
      if (!studentSearch || studentSearch.length < 2) return [];
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, email, cpf")
        .or(`nome.ilike.%${studentSearch}%,email.ilike.%${studentSearch}%`)
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: studentSearch.length >= 2,
  });

  const { data: courses, isLoading: loadingCourses } = useQuery({
    queryKey: ["courses-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select("id, nome, aulas(count)")
        .eq("ativo", true);
      if (error) throw error;
      return data;
    },
  });

  const matriculate = useMutation({
    mutationFn: async () => {
      if (!selectedStudent || selectedCourses.length === 0) return;

      // 1. Create enrollment
      const { data: matricula, error: mError } = await supabase
        .from("matriculas")
        .insert({
          aluno_id: selectedStudent.id,
          observacao: observation,
        })
        .select()
        .single();

      if (mError) throw mError;

      // 2. Link courses
      const courseInserts = selectedCourses.map((courseId) => ({
        matricula_id: matricula.id,
        curso_id: courseId,
      }));

      const { error: mcError } = await supabase.from("matricula_cursos").insert(courseInserts);
      if (mcError) throw mcError;

      // 3. Generate access via Edge Function
      const { data: accessData, error: accessError } = await supabase.functions.invoke("manage-student-access", {
        body: {
          email: selectedStudent.email,
          nome: selectedStudent.nome,
        }
      });

      if (accessError) throw accessError;

      return { 
        email: selectedStudent.email, 
        password: accessData.password,
        is_new: accessData.is_new
      };
    },
    onSuccess: (data) => {
      setGeneratedAccess(data);
      setShowAccessModal(true);
      qc.invalidateQueries({ queryKey: ["matriculas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleCourse = (id: string) => {
    setSelectedCourses(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader 
        title="Nova Matrícula" 
        description={step === 1 ? "Selecione o aluno para iniciar" : "Escolha os cursos para matricular"}
      />

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Etapa 1: Selecionar Aluno</CardTitle>
            <CardDescription>Busque o aluno por nome ou e-mail</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ex: João Silva ou joao@email.com"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {loadingStudents && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {!loadingStudents && students && students.length > 0 && !selectedStudent && (
              <div className="border rounded-md divide-y overflow-hidden bg-background">
                {students.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left px-4 py-3 hover:bg-muted transition-colors flex justify-between items-center"
                    onClick={() => {
                      setSelectedStudent(s);
                      setStudentSearch("");
                    }}
                  >
                    <div>
                      <p className="font-medium">{s.nome}</p>
                      <p className="text-sm text-muted-foreground">{s.email} • CPF: {s.cpf}</p>
                    </div>
                    <User className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {selectedStudent && (
              <div className="p-4 bg-muted/50 rounded-lg border flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                <div>
                  <h4 className="font-semibold text-primary">{selectedStudent.nome}</h4>
                  <p className="text-sm text-muted-foreground">{selectedStudent.email}</p>
                  <p className="text-xs text-muted-foreground">CPF: {selectedStudent.cpf}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>Trocar</Button>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button 
                disabled={!selectedStudent} 
                onClick={() => setStep(2)}
              >
                Próximo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Etapa 2: Selecionar Cursos</CardTitle>
              <CardDescription>Selecione um ou mais cursos para o aluno {selectedStudent?.nome}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loadingCourses && (
                  <div className="col-span-2 flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                {courses?.map((c: any) => {
                  const isSelected = selectedCourses.includes(c.id);
                  const aulasCount = Array.isArray(c.aulas) ? (c.aulas[0]?.count ?? 0) : 0;
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleCourse(c.id)}
                      className={`relative text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                        isSelected 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 h-5 w-5 bg-primary text-white rounded-full flex items-center justify-center animate-in zoom-in">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                      <h5 className="font-bold text-lg mb-1">{c.nome}</h5>
                      <p className="text-sm text-muted-foreground">{aulasCount} aulas</p>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Observação (opcional)</label>
                <Textarea 
                  placeholder="Informações adicionais sobre esta matrícula..."
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                <Button 
                  disabled={selectedCourses.length === 0 || matriculate.isPending}
                  onClick={() => matriculate.mutate()}
                >
                  {matriculate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirmar Matrícula
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showAccessModal} onOpenChange={(open) => {
        if (!open) navigate({ to: "/matriculas" });
        setShowAccessModal(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Matrícula Realizada!
            </DialogTitle>
            <DialogDescription>
              {generatedAccess?.is_new 
                ? "Acesso gerado automaticamente para o aluno. Copie os dados abaixo:" 
                : "Aluno já possui acesso. Os novos cursos foram liberados automaticamente."}
            </DialogDescription>
          </DialogHeader>
          
          {generatedAccess?.is_new && (
            <div className="bg-muted p-4 rounded-lg space-y-4 my-4 animate-in zoom-in duration-300">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">Login (E-mail)</p>
                <div className="flex items-center justify-between group cursor-pointer" onClick={() => copyToClipboard(generatedAccess?.email)}>
                  <span className="font-mono font-bold">{generatedAccess?.email}</span>
                  <Copy className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">Senha Temporária</p>
                <div className="flex items-center justify-between group cursor-pointer" onClick={() => copyToClipboard(generatedAccess?.password)}>
                  <span className="font-mono font-bold">{generatedAccess?.password}</span>
                  <Copy className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <p className="text-[10px] text-destructive font-medium bg-destructive/5 p-2 rounded">
                * Anote a senha pois ela não será exibida novamente
              </p>
            </div>
          )}
          <DialogFooter>
            <Button className="w-full" onClick={() => navigate({ to: "/matriculas" })}>
              Concluir e Ir para Lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}