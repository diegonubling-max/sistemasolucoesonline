import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, PlayCircle, Loader2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_student/aluno/dashboard")({
  head: () => ({ meta: [{ title: "Meus Cursos — Soluções Online" }] }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const { session } = useAuth();

  const { data: userData } = useQuery({
    queryKey: ["student-profile", session?.user.email],
    queryFn: async () => {
      const { data } = await supabase
        .from("alunos")
        .select("nome")
        .eq("email", session?.user.email ?? "")
        .single();
      return data;
    },
    enabled: !!session?.user.email,
  });

  const { data: cursos, isLoading } = useQuery({
    queryKey: ["student-courses", session?.user.email],
    queryFn: async () => {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("id")
        .eq("email", session?.user.email ?? "")
        .single();
      
      if (!aluno) return [];

      const { data: ms } = await supabase.from("matriculas").select("id").eq("aluno_id", aluno.id);
      const ids = (ms ?? []).map((m) => m.id);
      if (ids.length === 0) return [];

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

  const userName = userData?.nome || "";

  return (
    <div className="flex flex-col gap-0">
      {/* Banner de Boas Vindas */}
      <section className="relative h-[300px] md:h-[400px] w-full flex items-center justify-start overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a2e] to-[#141414] z-0" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#2ECC71]/10 via-transparent to-transparent opacity-50" />
        
        <div className="relative z-10 px-4 sm:px-10 max-w-4xl space-y-4 animate-in fade-in slide-in-from-left-8 duration-1000">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white">
            Bem-vindo(a) de volta, <span className="text-[#2ECC71]">{userName}</span>!
          </h1>
          <p className="text-lg md:text-xl text-[#B3B3B3] font-medium max-w-xl">
            Sua jornada de aprendizado continua aqui. Explore seus cursos e retome seus estudos agora mesmo.
          </p>
          <div className="flex gap-4 pt-4">
             <Button className="bg-[#2ECC71] hover:bg-[#27ae60] text-black font-bold px-8 h-12 rounded-md transition-transform hover:scale-105">
                Continuar Assistindo
             </Button>
          </div>
        </div>
      </section>

      {/* Seção de Cursos */}
      <div className="px-4 sm:px-10 py-12 space-y-8 bg-[#141414]">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-white border-l-4 border-[#2ECC71] pl-4">Meus Cursos</h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-[200px] w-full rounded-md bg-[#1e1e1e]" />
                <Skeleton className="h-6 w-3/4 bg-[#1e1e1e]" />
                <Skeleton className="h-4 w-1/2 bg-[#1e1e1e]" />
              </div>
            ))}
          </div>
        ) : !cursos || cursos.length === 0 ? (
          <Card className="bg-[#1e1e1e] border-dashed border-white/10 text-white">
            <CardContent className="py-20 text-center space-y-4">
              <BookOpen className="h-16 w-16 mx-auto text-[#B3B3B3]/20" />
              <div className="space-y-2">
                <p className="font-bold text-2xl text-white">Você ainda não tem cursos</p>
                <p className="text-[#B3B3B3] max-w-xs mx-auto">Suas matrículas aparecerão aqui assim que forem liberadas pelo administrador.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {cursos.map((c: any, i) => {
              const curso = c.cursos;
              if (!curso) return null;
              const aulasCount = Array.isArray(curso.aulas) ? (curso.aulas[0]?.count ?? 0) : 0;
              
              return (
                <Link key={i} to="/aluno/curso/$id" params={{ id: curso.id }} className="group">
                  <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-[#1e1e1e] border border-white/5 transition-all duration-500 group-hover:scale-105 group-hover:shadow-[0_0_30px_rgba(46,204,113,0.3)] group-hover:border-[#2ECC71]/30">
                    {/* Placeholder Thumbnail */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10 group-hover:bg-[#2ECC71] group-hover:border-[#2ECC71] transition-all duration-300">
                          <Play className="h-8 w-8 text-[#2ECC71] group-hover:text-black ml-1 transition-colors" fill="currentColor" />
                       </div>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4 z-20 space-y-1">
                      <h3 className="text-lg font-bold text-white line-clamp-1 group-hover:text-[#2ECC71] transition-colors">{curso.nome}</h3>
                      <div className="flex items-center justify-between text-xs text-[#B3B3B3]">
                        <span>{aulasCount} aulas</span>
                        <span>0% concluído</span>
                      </div>
                      <Progress value={0} className="h-1 bg-white/10" />
                    </div>

                    {/* Hover Button */}
                    <div className="absolute top-0 left-0 w-full h-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-30">
                       <Button className="bg-[#2ECC71] text-black font-black uppercase tracking-widest text-xs hover:bg-[#27ae60]">
                         Assistir Agora
                       </Button>
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
