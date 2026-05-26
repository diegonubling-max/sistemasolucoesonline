import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Pencil, Power, ListVideo, Trash2, AlertTriangle, Loader2 } from "lucide-react";
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

export const Route = createFileRoute("/_admin/cursos/")({
  head: () => ({ meta: [{ title: "Cursos — EduManager" }] }),
  component: CursosList,
});

function CursosList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cursoToDelete, setCursoToDelete] = useState<{ id: string; nome: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cursos", search],
    queryFn: async () => {
      let q = supabase
        .from("cursos")
        .select("id, nome, descricao, ativo, created_at, aulas(count)")
        .order("created_at", { ascending: false });
      if (search) q = q.ilike("nome", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("cursos").update({ ativo: !ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["cursos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCurso = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cursos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Curso excluído com sucesso");
      qc.invalidateQueries({ queryKey: ["cursos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setCursoToDelete(null);
    },
    onError: (e: Error) => {
      if (e.message.includes("violates foreign key constraint")) {
        toast.error("Não é possível excluir este curso pois ele possui vínculos (aulas ou matrículas).");
      } else {
        toast.error(e.message);
      }
    },
  });

  return (
    <div>
      <PageHeader
        title="Cursos"
        description={`${data?.length ?? 0} curso(s) cadastrado(s)`}
        actions={
          <Button onClick={() => navigate({ to: "/cursos/novo" })}>
            <Plus className="h-4 w-4 mr-2" /> Novo curso
          </Button>
        }
      />

      <Card className="border-none shadow-none">
        <CardContent className="pt-0 px-0">
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar curso..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-gray-100">
                <TableHead className="text-xs font-normal text-muted-foreground/70 uppercase tracking-wider">Nome</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground/70 uppercase tracking-wider">Descrição</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground/70 uppercase tracking-wider">Aulas</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground/70 uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground/70 uppercase tracking-wider">Cadastro</TableHead>
                <TableHead className="text-right text-xs font-normal text-muted-foreground/70 uppercase tracking-wider">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {data?.map((c) => {
                const count = Array.isArray(c.aulas) ? (c.aulas[0]?.count ?? 0) : 0;
                return (
                  <TableRow key={c.id} className="border-b border-gray-100 hover:bg-[#F9FAFB] transition-colors">
                    <TableCell className="text-sm font-bold text-slate-700">{c.nome}</TableCell>
                    <TableCell className="max-w-md truncate text-sm font-normal text-muted-foreground/80">
                      {c.descricao || "—"}
                    </TableCell>
                    <TableCell className="text-sm font-normal text-slate-700">{count}</TableCell>
                    <TableCell>
                      {c.ativo ? (
                        <Badge className="bg-green-500 text-white hover:bg-green-500 rounded-full px-3 font-semibold">Ativo</Badge>
                      ) : (
                        <Badge className="bg-gray-400 text-white hover:bg-gray-400 rounded-full px-3 font-semibold">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-normal text-muted-foreground/80">{formatDate(c.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="icon" variant="ghost" title="Gerenciar aulas">
                          <Link to="/cursos/$id/aulas" params={{ id: c.id }}>
                            <ListVideo className="h-4 w-4 text-foreground" />
                          </Link>
                        </Button>
                        <Button asChild size="icon" variant="ghost" title="Editar">
                          <Link to="/cursos/$id/editar" params={{ id: c.id }}>
                            <Pencil className="h-4 w-4 text-foreground" />
                          </Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Excluir"
                          onClick={() => setCursoToDelete({ id: c.id, nome: c.nome })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum curso cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!cursoToDelete} onOpenChange={(open) => !open && setCursoToDelete(null)}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader className="items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-xl font-bold">Excluir curso?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Você está prestes a excluir o curso <span className="font-bold text-foreground">[{cursoToDelete?.nome}]</span>. 
              Esta ação não pode ser desfeita e todos os dados relacionados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2 mt-4">
            <AlertDialogCancel disabled={deleteCurso.isPending} className="mt-0 sm:flex-1">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (cursoToDelete) deleteCurso.mutate(cursoToDelete.id);
              }}
              className="bg-[#DC2626] hover:bg-red-700 text-white sm:flex-1"
              disabled={deleteCurso.isPending}
            >
              {deleteCurso.isPending ? (
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
