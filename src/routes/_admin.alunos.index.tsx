import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Search, Pencil, Eye, Power, Trash2, AlertTriangle, Loader2, FileText, FileCheck, FileWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { formatDate } from "@/lib/format";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContratoAlunoModal } from "@/components/admin/alunos/ContratoAlunoModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusAlunoBadge, STATUS_LIST, STATUS_CONFIG } from "@/lib/aluno-status";


export const Route = createFileRoute("/_admin/alunos/")({
  head: () => ({ meta: [{ title: "Alunos — Soluções Online" }] }),
  component: AlunosList,
});

const PAGE_SIZE = 10;

function AlunosList() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; nome: string; email: string; hasMatriculas: boolean } | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [studentForContract, setStudentForContract] = useState<any | null>(null);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchCpf, setGlobalSearchCpf] = useState("");
  const [globalSearchResult, setGlobalSearchResult] = useState<any>(null);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [selectedPoloId, setSelectedPoloId] = useState<string>(() => sessionStorage.getItem("selected_polo_id") || "all");

  useEffect(() => {
    const handlePoloChange = () => {
      setSelectedPoloId(sessionStorage.getItem("selected_polo_id") || "all");
      setPage(0);
    };
    window.addEventListener("polo-changed", handlePoloChange);
    return () => window.removeEventListener("polo-changed", handlePoloChange);
  }, []);

  const { data: userRole } = useQuery({
    queryKey: ["user-role", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).maybeSingle();
      return data?.role;
    },
    enabled: !!session?.user?.id
  });

  const isSuperAdmin = session?.user?.email === 'diegonubling@gmail.com' || userRole === 'admin';

  const handleGlobalSearch = async () => {
    if (!globalSearchCpf) return;
    const normalizedCpf = globalSearchCpf.replace(/\D/g, '');
    const formattedCpf = normalizedCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    
    console.log("DEBUG: Buscando CPF global:", {
      original: globalSearchCpf,
      normalized: normalizedCpf,
      formatted: formattedCpf
    });

    setIsSearchingGlobal(true);
    try {
      const { data, error } = await supabase
        .from("alunos")
        .select("nome, vendedora, created_at, polos(nome), matriculas(id, created_at, parcelas(valor, status))")
        .or(`cpf.eq.${normalizedCpf},cpf.eq.${formattedCpf}`)
        .maybeSingle();
      
      console.log("DEBUG: Resultado da busca global:", data);
      
      if (error) throw error;
      if (!data) throw new Error("Aluno não encontrado em nenhum polo.");
      
      setGlobalSearchResult(data);
    } catch (e: any) {
      toast.error(e.message);
      setGlobalSearchResult(null);
    } finally {
      setIsSearchingGlobal(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["alunos", search, page, selectedPoloId, userRole, statusFilter],
    queryFn: async () => {
      const userId = session?.user?.id;
      let colabPoloId = null;
      let isSuperAdmin = session?.user?.email === 'diegonubling@gmail.com' || userRole === 'admin';

      console.log("DEBUG [Alunos]:", { 
        email: session?.user?.email, 
        userRole, 
        isSuperAdmin, 
        selectedPoloId 
      });

      if (userId && !isSuperAdmin) {
        const { data: colab } = await supabase.from('colaboradores').select('polo_id').eq('user_id', userId).maybeSingle();
        colabPoloId = colab?.polo_id;
        console.log("DEBUG [Alunos]: Colaborador Polo ID:", colabPoloId);
      }

      let q = supabase
        .from("alunos")
        .select("id, nome, email, telefone, cpf, data_nascimento, ativo, status, created_at, vendedora, ctr, cadastro_completo, matriculas(id), contratos(id, status)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (statusFilter !== "all") {
        q = q.eq('status', statusFilter);
      }
      
      if (isSuperAdmin) {
        if (selectedPoloId && selectedPoloId !== 'all') {
          console.log("DEBUG [Alunos]: Aplicando filtro SuperAdmin para polo:", selectedPoloId);
          q = q.eq('polo_id', selectedPoloId);
        } else {
          console.log("DEBUG [Alunos]: SuperAdmin - Mostrando todos os polos");
        }
      } else if (colabPoloId) {
        console.log("DEBUG [Alunos]: Aplicando filtro Colaborador para polo:", colabPoloId);
        q = q.eq('polo_id', colabPoloId);
      }

      if (search) {
        const isNumeric = /^\d+$/.test(search);
        if (isNumeric) {
          q = q.or(`nome.ilike.%${search}%,email.ilike.%${search}%,ctr.eq.${search}`);
        } else {
          q = q.or(`nome.ilike.%${search}%,email.ilike.%${search}%`);
        }
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("alunos").update({ ativo: !ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Situação atualizada");
      qc.invalidateQueries({ queryKey: ["alunos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (student: { id: string; email: string }) => {
      if (!student.id) throw new Error("ID do aluno não fornecido");

      const { error } = await supabase.rpc('delete_aluno_completo', { 
        p_aluno_id: student.id 
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aluno excluído com sucesso");
      qc.invalidateQueries({ queryKey: ["alunos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setStudentToDelete(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Alunos"
        description={`${data?.count ?? 0} aluno(s) no total`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowGlobalSearch(true)}>
              <Search className="h-4 w-4 mr-2" /> Buscar em todos os polos
            </Button>
            <Button onClick={() => navigate({ to: "/alunos/novo" })}>
              <Plus className="h-4 w-4 mr-2" /> Novo aluno
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative max-w-sm flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail ou CTR..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {STATUS_LIST.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">CTR</TableHead>
                <TableHead>Nome</TableHead>
                
                <TableHead>Telefone</TableHead>
                <TableHead>Vendedora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {data?.rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                      #{a.ctr}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{a.nome}</span>
                      {(a as any).cadastro_completo === false && (
                        <Badge className="bg-orange-500 hover:bg-orange-500 text-white text-[10px] px-1.5 py-0">
                          Incompleto
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>{a.telefone}</TableCell>
                  <TableCell>{a.vendedora}</TableCell>
                  <TableCell><StatusAlunoBadge status={(a as any).status} /></TableCell>
                  <TableCell>{formatDate(a.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {(() => {
                        const contrato = a.contratos && a.contratos[0];
                        if (!contrato) {
                          return (
                            <Button size="icon" variant="ghost" title="Gerar Contrato" onClick={() => setStudentForContract(a)}>
                              <FileText className="h-4 w-4 text-gray-400" />
                            </Button>
                          );
                        }
                        if (contrato.status === 'assinado') {
                          return (
                            <Button size="icon" variant="ghost" title="Contrato Assinado" onClick={() => setStudentForContract(a)}>
                              <FileCheck className="h-4 w-4 text-green-600" />
                            </Button>
                          );
                        }
                        return (
                          <Button size="icon" variant="ghost" title="Contrato Pendente" onClick={() => setStudentForContract(a)}>
                            <FileWarning className="h-4 w-4 text-amber-500" />
                          </Button>
                        );
                      })()}
                      <Button asChild size="icon" variant="ghost" title={Array.isArray(a.matriculas) && a.matriculas.length > 0 ? "Ver matrícula" : "Ver detalhes"}>
                        <Link to="/alunos/$id" params={{ id: a.id }}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button asChild size="icon" variant="ghost" title="Editar">
                        <Link to="/alunos/$id/editar" params={{ id: a.id }}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title={a.ativo ? "Desativar" : "Ativar"}
                        onClick={() => toggle.mutate({ id: a.id, ativo: a.ativo })}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Excluir"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setStudentToDelete({ 
                          id: a.id, 
                          nome: a.nome, 
                          email: a.email ?? "",
                          hasMatriculas: Array.isArray(a.matriculas) && a.matriculas.length > 0
                        })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && data?.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum aluno encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!studentToDelete} onOpenChange={(open) => !open && setStudentToDelete(null)}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader className="items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-xl font-bold">Excluir aluno?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Você está prestes a excluir o aluno <span className="font-bold text-foreground">[{studentToDelete?.nome}]</span>. 
              {studentToDelete?.hasMatriculas && (
                <div className="bg-red-50 text-red-800 p-2 rounded mt-2 text-xs flex gap-2 items-center text-left">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Este aluno possui matrículas ativas. A exclusão removerá todo o histórico financeiro e de cursos.</span>
                </div>
              )}
              <div className="mt-2">Esta ação não pode ser desfeita e todos os dados relacionados serão removidos permanentemente.</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2 mt-4">
            <AlertDialogCancel disabled={deleteMutation.isPending} className="mt-0 sm:flex-1">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (studentToDelete) deleteMutation.mutate(studentToDelete);
              }}
              className="bg-[#DC2626] hover:bg-red-700 text-white sm:flex-1"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Excluindo...
                </>
              ) : (
                "Sim, excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showGlobalSearch} onOpenChange={setShowGlobalSearch}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Busca Global por CPF</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Digite o CPF (apenas números)" 
                value={globalSearchCpf}
                onChange={(e) => setGlobalSearchCpf(e.target.value)}
              />
              <Button onClick={handleGlobalSearch} disabled={isSearchingGlobal}>
                {isSearchingGlobal ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>

            {globalSearchResult && (
              <Card className="bg-muted/50">
                <CardContent className="pt-6 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><span className="font-bold">Nome:</span> {globalSearchResult.nome}</p>
                    <p><span className="font-bold">Polo:</span> {globalSearchResult.polos?.nome}</p>
                    <p><span className="font-bold">Vendedor:</span> {globalSearchResult.vendedora}</p>
                    <p><span className="font-bold">Matrícula:</span> {formatDate(globalSearchResult.created_at)}</p>
                  </div>
                  <div className="mt-4">
                    <p className="font-bold text-sm mb-2">Resumo de Parcelas:</p>
                    <div className="space-y-4">
                      {globalSearchResult.matriculas?.map((m: any, mIdx: number) => (
                        <div key={mIdx} className="space-y-1">
                          {m.parcelas?.length > 0 ? (
                            m.parcelas.map((p: any, pIdx: number) => (
                              <div key={pIdx} className="flex justify-between text-xs border-b pb-1">
                                <span>{globalSearchResult.matriculas.length > 1 ? `Matrícula ${mIdx + 1} - ` : ""}Parcela {pIdx + 1}</span>
                                <span>R$ {p.valor}</span>
                                <Badge variant={p.status === 'pago' ? 'default' : 'destructive'} className="text-[10px] h-4">
                                  {p.status}
                                </Badge>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Nenhuma parcela na matrícula {mIdx + 1}.</p>
                          )}
                        </div>
                      ))}
                      {(!globalSearchResult.matriculas || globalSearchResult.matriculas.length === 0) && (
                        <p className="text-xs text-muted-foreground italic">Nenhuma matrícula encontrada.</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ContratoAlunoModal 
        aluno={studentForContract}
        isOpen={!!studentForContract}
        onClose={() => setStudentForContract(null)}
      />
    </div>
  );
}
