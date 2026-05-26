import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Pencil, Power, ListVideo, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_admin/cursos/")({
  head: () => ({ meta: [{ title: "Cursos — EduManager" }] }),
  component: CursosList,
});

function CursosList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

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
    },
    onError: (e: Error) => {
      if (e.message.includes("violates foreign key constraint")) {
        toast.error("Não é possível excluir este curso pois ele possui vínculos (aulas ou matrículas).");
      } else {
        toast.error(e.message);
      }
    },
  });

  const handleDelete = (id: string, nome: string) => {
    if (confirm(`Tem certeza que deseja excluir o curso "${nome}"? Esta ação não pode ser desfeita.`)) {
      deleteCurso.mutate(id);
    }
  };

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
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Aulas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
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
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">
                      {c.descricao || "—"}
                    </TableCell>
                    <TableCell>{count}</TableCell>
                    <TableCell>
                      {c.ativo ? (
                        <Badge className="bg-accent text-accent-foreground hover:bg-accent">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(c.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
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
                          onClick={() => handleDelete(c.id, c.nome)}
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
    </div>
  );
}
