import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, PlayCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_student/aluno/dashboard")({
  head: () => ({ meta: [{ title: "Meus Cursos — EduManager" }] }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const { session } = useAuth();

  const { data: cursos, isLoading } = useQuery({
    queryKey: ["student-courses", session?.user.email],
    queryFn: async () => {
      // 1. Find student by email
      const { data: aluno } = await supabase
        .from("alunos")
        .select("id")
        .eq("email", session?.user.email ?? "")
        .single();
      
      if (!aluno) return [];

      // 2. Find enrollments
      const { data: ms } = await supabase.from("matriculas").select("id").eq("aluno_id", aluno.id);
      const ids = (ms ?? []).map((m) => m.id);
      if (ids.length === 0) return [];

      // 3. Find courses
      const { data, error } = await supabase
        .from("matricula_cursos")
        .select(`
          data_liberacao,
          cursos (
            id,
            nome,
            descricao,
            aulas (count)
          )
        `)
        .in("matricula_id", ids);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!session?.user.email,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meus Cursos</h1>
        <p className="text-muted-foreground">Continue de onde você parou</p>
      </div>

      {!cursos || cursos.length === 0 ? (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="py-12 text-center space-y-4">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <div className="space-y-1">
              <p className="font-semibold text-lg">Nenhum curso encontrado</p>
              <p className="text-sm text-muted-foreground">Você ainda não possui matrículas ativas.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cursos.map((c: any, i) => {
            const curso = c.cursos;
            if (!curso) return null;
            const aulasCount = Array.isArray(curso.aulas) ? (curso.aulas[0]?.count ?? 0) : 0;
            
            return (
              <Card key={i} className="group hover:shadow-xl transition-all duration-300 border-none bg-white overflow-hidden flex flex-col">
                <div className="aspect-video bg-gradient-to-br from-primary/10 to-[#3B82F6]/10 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                  <PlayCircle className="h-12 w-12 text-primary/40 group-hover:text-primary transition-colors" />
                </div>
                <CardHeader className="flex-1">
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">{curso.nome}</CardTitle>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                    {curso.descricao || "Sem descrição disponível."}
                  </p>
                </CardHeader>
                <CardFooter className="pt-0 border-t mt-4 py-4 flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground">
                    {aulasCount} {aulasCount === 1 ? 'aula' : 'aulas'}
                  </span>
                  <Link to="/aluno/curso/$id" params={{ id: curso.id }}>
                    <Button size="sm" className="bg-[#3B82F6] hover:bg-[#3B82F6]/90">Acessar curso</Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}