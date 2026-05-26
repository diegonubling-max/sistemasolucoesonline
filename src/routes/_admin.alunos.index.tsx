import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Pencil, Eye, Power, Trash2, AlertTriangle, Loader2 } from "lucide-react";
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

export const Route = createFileRoute("/_admin/alunos/")({
  head: () => ({ meta: [{ title: "Alunos — Soluções Online" }] }),
  component: AlunosList,
});

const PAGE_SIZE = 10;

function AlunosList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; nome: string; email: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["alunos", search, page],
    queryFn: async () => {
      let q = supabase
        .from("alunos")
        .select("id, nome, email, telefone, ativo, created_at, vendedora, ctr, matriculas(id)", { count: "exact" })
        .order("ctr", { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
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
          <Button onClick={() => navigate({ to: "/alunos/novo" })}>
            <Plus className="h-4 w-4 mr-2" /> Novo aluno
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-4 max-w-sm">
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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">CTR</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Vendedora</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
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
                  <TableCell className="font-medium">{a.nome}</TableCell>
                  <TableCell>{a.email}</TableCell>
                  <TableCell>{a.telefone}</TableCell>
                  <TableCell>{a.vendedora}</TableCell>
                  <TableCell>
                    {Array.isArray(a.matriculas) && a.matriculas.length > 0 ? (
                      <Badge className="bg-green-500 text-white hover:bg-green-600">Matriculado</Badge>
                    ) : (
                      <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(a.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
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
                        onClick={() => setStudentToDelete({ id: a.id, nome: a.nome, email: a.email })}
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
              Esta ação não pode ser desfeita e todos os dados relacionados serão removidos permanentemente.
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
    </div>
  );
}
