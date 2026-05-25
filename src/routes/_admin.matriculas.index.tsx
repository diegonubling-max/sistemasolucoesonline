import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Eye, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/PageHeader";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_admin/matriculas/")({
  head: () => ({ meta: [{ title: "Matrículas — EduManager" }] }),
  component: MatriculasList,
});

function MatriculasList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["matriculas", search],
    queryFn: async () => {
      let q = supabase
        .from("matriculas")
        .select(`
          id,
          created_at,
          alunos (nome, email),
          matricula_cursos (
            cursos (nome)
          )
        `)
        .order("created_at", { ascending: false });

      if (search) {
        // Unfortunately, filtering by joined table in Supabase can be tricky with simple search
        // We'll filter on the client side if the dataset is small, or use a more complex query if needed
      }

      const { data, error } = await q;
      if (error) throw error;
      
      // Filter by student name if search is provided
      if (search) {
        return (data as any[]).filter(m => 
          m.alunos?.nome.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      return data ?? [];
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("matriculas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matrícula revogada com sucesso");
      qc.invalidateQueries({ queryKey: ["matriculas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Matrículas"
        description={`${data?.length ?? 0} matrícula(s) no total`}
        actions={
          <Button onClick={() => navigate({ to: "/matriculas/novo" })}>
            <Plus className="h-4 w-4 mr-2" /> Nova matrícula
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do aluno..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Cursos Matriculados</TableHead>
                <TableHead>Data da Matrícula</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {data?.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{m.alunos?.nome}</span>
                      <span className="text-xs text-muted-foreground">{m.alunos?.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {m.matricula_cursos?.map((mc: any, idx: number) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {mc.cursos?.nome}
                        </span>
                      )) || "Nenhum curso"}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(m.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="icon" variant="ghost" title="Editar cursos">
                        <Link to="/matriculas/$id/editar" params={{ id: m.id }}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Revogar acesso"
                        onClick={() => {
                          if (confirm("Tem certeza que deseja revogar o acesso deste aluno?")) {
                            revoke.mutate(m.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhuma matrícula encontrada.
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