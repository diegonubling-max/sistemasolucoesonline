import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Pencil, Power, ListVideo, Trash2, AlertTriangle, Loader2, Folder, ImageIcon, ImageOff } from "lucide-react";
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
  head: () => ({ meta: [{ title: "Cursos — Soluções Online" }] }),
  component: CursosList,
});

function CursosList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cursoToDelete, setCursoToDelete] = useState<{ id: string; nome: string; hasAulas: boolean; hasMatriculas: boolean } | null>(null);

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

  const { data, isLoading } = useQuery({
    queryKey: ["cursos", search],
    queryFn: async () => {
      let q = supabase
        .from("cursos")
        .select("id, nome, descricao, ativo, created_at, segmento_id, thumbnail_url, segmentos(nome), aulas(count), matricula_cursos(count)")
        .order("nome", { ascending: true });
      
      if (search) q = q.ilike("nome", `%${search}%`);
      
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const groupedCursos = (data || []).reduce((acc: any, curso: any) => {
    const segmentoId = curso.segmento_id || "outros";
    const segmentoNome = curso.segmentos?.nome || "Outros";
    
    if (!acc[segmentoId]) {
      acc[segmentoId] = {
        id: segmentoId,
        nome: segmentoNome,
        cursos: []
      };
    }
    acc[segmentoId].cursos.push(curso);
    return acc;
  }, {});

  const orderedGroups = [
    ...(segmentos || []).map(s => groupedCursos[s.id]).filter(Boolean),
    groupedCursos["outros"]
  ].filter(Boolean);

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

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar curso..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-8">
            {isLoading && (
              <div className="text-center py-6 text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
            )}

            {!isLoading && orderedGroups.length === 0 && (
              <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                Nenhum curso cadastrado.
              </div>
            )}

            {orderedGroups.map((group) => (
              <div key={group.id} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-3 flex items-center justify-between border-b">
                  <div className="flex items-center gap-2 font-semibold text-gray-700">
                    <Folder className="h-4 w-4 text-gray-500" />
                    <span>{group.nome}</span>
                    <span className="text-sm font-normal text-gray-500">
                      ({group.cursos.length} {group.cursos.length === 1 ? "curso" : "cursos"})
                    </span>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white hover:bg-white">
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-24">Aulas</TableHead>
                      <TableHead className="w-32">Status</TableHead>
                      <TableHead className="text-right w-40">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.cursos.map((c: any) => {
                      const countAulas = Array.isArray(c.aulas) ? (c.aulas[0]?.count ?? 0) : 0;
                      const countMatriculas = Array.isArray(c.matricula_cursos) ? (c.matricula_cursos[0]?.count ?? 0) : 0;
                      
                      return (
                        <TableRow key={c.id} className="bg-white">
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell>{countAulas}</TableCell>
                          <TableCell>
                            {c.ativo ? (
                              <Badge className="bg-accent text-accent-foreground hover:bg-accent">Ativo</Badge>
                            ) : (
                              <Badge variant="secondary">Inativo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                title={c.ativo ? "Desativar" : "Ativar"}
                                onClick={() => toggle.mutate({ id: c.id, ativo: c.ativo })}
                              >
                                <Power className={`h-4 w-4 ${c.ativo ? "text-green-600" : "text-gray-400"}`} />
                              </Button>
                              <Button asChild size="icon" variant="ghost" title="Gerenciar aulas">
                                <Link to="/cursos/$id/aulas" params={{ id: c.id }}>
                                  <ListVideo className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button asChild size="icon" variant="ghost" title="Editar">
                                <Link to="/cursos/$id/editar" params={{ id: c.id }}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Excluir"
                                onClick={() => setCursoToDelete({ 
                                  id: c.id, 
                                  nome: c.nome, 
                                  hasAulas: countAulas > 0,
                                  hasMatriculas: countMatriculas > 0
                                })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
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
              {cursoToDelete?.hasAulas && (
                <div className="bg-amber-50 text-amber-800 p-2 rounded mt-2 text-xs flex gap-2 items-center">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>Este curso possui aulas vinculadas que também serão removidas.</span>
                </div>
              )}
              {cursoToDelete?.hasMatriculas && (
                <div className="bg-red-50 text-red-800 p-2 rounded mt-2 text-xs flex gap-2 items-center">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>Este curso possui alunos matriculados. A exclusão pode causar erros no histórico dos alunos.</span>
                </div>
              )}
              <div className="mt-4">Esta ação não pode ser desfeita e todos os dados relacionados serão removidos permanentemente.</div>
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
