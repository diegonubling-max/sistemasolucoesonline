import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, PlayCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_student/aluno/dashboard")({
  head: () => ({ meta: [{ title: "Meus Cursos — Soluções Online" }] }),
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
    <div className="space-y-12 animate-in fade-in duration-700">
      {/* Welcome Banner */}
      <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden bg-gradient-to-r from-[#1a1a2e] to-[#141414] flex items-center px-8 md:px-12">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <h1 className="text-4xl md:text-6xl font-bold text-white">
            Bem-vindo(a) de volta!
          </h1>
          <p className="text-lg md:text-xl text-[#B3B3B3]">
            Continue seus estudos de onde você parou.
          </p>
        </div>
        {/* Background Decorative Element */}
        <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-[#2D6ADF]/10 to-transparent pointer-events-none" />
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Meus Cursos</h2>
        
        {!cursos || cursos.length === 0 ? (
          <Card className="bg-[#1e1e1e] border-dashed border-white/10">
            <CardContent className="py-12 text-center space-y-4">
              <BookOpen className="h-12 w-12 mx-auto text-[#B3B3B3]" />
              <div className="space-y-1">
                <p className="font-semibold text-lg text-white">Nenhum curso encontrado</p>
                <p className="text-sm text-[#B3B3B3]">Você ainda não possui matrículas ativas.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {cursos.map((c: any, i: number) => {
              const curso = c.cursos;
              if (!curso) return null;
              const aulasCount = Array.isArray(curso.aulas) ? (curso.aulas[0]?.count ?? 0) : 0;
              
              return (
                <Link key={i} to="/aluno/curso/$id" params={{ id: curso.id }} className="group">
                  <div className="relative bg-[#1e1e1e] rounded-xl overflow-hidden transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(45,106,223,0.3)] border border-white/5 h-full flex flex-col">
                    <div className="aspect-video bg-[#222] flex items-center justify-center relative">
                      <div className="p-4 bg-[#2D6ADF]/20 rounded-full">
                        <PlayCircle className="h-10 w-10 text-[#2D6ADF]" />
                      </div>
                      
                      {/* Play Button Overlay on Hover */}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-2 bg-[#2D6ADF] px-4 py-2 rounded-full text-white font-bold">
                            <PlayCircle className="h-5 w-5" />
                            Assistir
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h3 className="text-lg font-bold text-white line-clamp-1">{curso.nome}</h3>
                        <p className="text-xs text-[#B3B3B3] mt-1">{aulasCount} {aulasCount === 1 ? 'aula' : 'aulas'}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="h-1 w-full bg-[#333] rounded-full overflow-hidden">
                          <div className="h-full bg-[#2D6ADF] transition-all" style={{ width: '0%' }} />
                        </div>
                        <p className="text-[10px] text-[#B3B3B3] uppercase tracking-wider font-bold">0% Concluído</p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}