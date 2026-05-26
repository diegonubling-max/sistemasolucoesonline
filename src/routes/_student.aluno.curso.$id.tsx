import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { ChevronLeft, PlayCircle, Loader2, AlertCircle, Play, CheckCircle2, ChevronRight, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_student/aluno/curso/$id")({
  head: () => ({ meta: [{ title: "Assistir Curso — Soluções Online" }] }),
  component: StudentCourse,
});

function StudentCourse() {
  const { id } = Route.useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [activeAulaId, setActiveAulaId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: curso, isLoading: loadingCurso, error: cursoError } = useQuery({
    queryKey: ["student-course", id, session?.user.email],
    queryFn: async () => {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("id")
        .eq("email", session?.user.email ?? "")
        .single();
      
      if (!aluno) throw new Error("Acesso negado");

      const { data: matriculas } = await supabase
        .from("matriculas")
        .select("id")
        .eq("aluno_id", aluno.id);
      
      const mIds = (matriculas ?? []).map(m => m.id);
      
      const { data: enrollment } = await supabase
        .from("matricula_cursos")
        .select("id")
        .in("matricula_id", mIds)
        .eq("curso_id", id)
        .single();
      
      if (!enrollment) throw new Error("Você não tem acesso a este curso");

      const { data: cursoData, error } = await supabase
        .from("cursos")
        .select(`
          id,
          nome,
          descricao,
          aulas (
            id,
            titulo,
            descricao,
            url_video,
            ordem,
            ativo
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      const activeAulas = (cursoData.aulas as any[])
        .filter(a => a.ativo)
        .sort((a, b) => a.ordem - b.ordem);

      return { ...cursoData, aulas: activeAulas };
    },
    enabled: !!session?.user.email,
  });

  const activeAulaIndex = useMemo(() => {
    if (!curso?.aulas) return -1;
    return curso.aulas.findIndex(a => a.id === (activeAulaId || curso.aulas[0]?.id));
  }, [curso, activeAulaId]);

  const activeAula = curso?.aulas?.[activeAulaIndex];

  const handleNext = () => {
    if (curso?.aulas && activeAulaIndex < curso.aulas.length - 1) {
      setActiveAulaId(curso.aulas[activeAulaIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (curso?.aulas && activeAulaIndex > 0) {
      setActiveAulaId(curso.aulas[activeAulaIndex - 1].id);
    }
  };

  if (loadingCurso) {
    return (
      <div className="flex justify-center py-40 bg-[#141414] min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-[#2D6ADF]" />
      </div>
    );
  }

  if (cursoError) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-6 bg-[#141414] text-white">
        <AlertCircle className="h-16 w-16 mx-auto text-red-500" />
        <div className="space-y-2">
           <h2 className="text-2xl font-bold tracking-tight">Ops! Acesso Negado</h2>
           <p className="text-[#B3B3B3]">{cursoError.message}</p>
        </div>
        <Button onClick={() => navigate({ to: "/aluno/dashboard" })} className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white font-bold">
           Voltar para Meus Cursos
        </Button>
      </div>
    );
  }

  const renderVideoPlayer = (url: string) => {
    if (!url) return <div className="aspect-video bg-black flex items-center justify-center text-white">Vídeo não disponível</div>;

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const id = url.includes('v=') ? url.split('v=')[1]?.split('&')[0] : url.split('/').pop();
      return <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${id}?autoplay=1`} allow="autoplay; encrypted-media" allowFullScreen></iframe>;
    }

    if (url.includes('vimeo.com')) {
      const id = url.split('/').pop();
      return <iframe className="w-full h-full" src={`https://player.vimeo.com/video/${id}?autoplay=1`} allow="autoplay; fullscreen" allowFullScreen></iframe>;
    }

    if (url.includes('pandavideo.com.br')) {
      return <iframe className="w-full h-full" src={url} allow="autoplay; fullscreen" allowFullScreen></iframe>;
    }

    return (
       <div className="aspect-video bg-[#1e1e1e] flex flex-col items-center justify-center text-white p-8 text-center gap-4">
         <p className="text-[#B3B3B3]">Este vídeo deve ser acessado pelo link externo:</p>
         <a href={url} target="_blank" className="bg-[#1E3A5F] text-white px-6 py-2 rounded-md font-bold transition-transform hover:scale-105">{url}</a>
       </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#141414] text-white">
      {/* Course Header */}
      <div className="bg-[#1e1e1e]/50 border-b border-white/5 px-4 sm:px-8 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <Link to="/aluno/dashboard" className="text-[#B3B3B3] hover:text-white transition-colors">
              <ChevronLeft className="h-6 w-6" />
           </Link>
           <div>
              <h1 className="text-xl font-bold tracking-tight text-white">{curso?.nome}</h1>
              <div className="flex items-center gap-3 mt-1">
                 <span className="text-xs text-[#B3B3B3] uppercase font-bold tracking-wider">{curso?.aulas?.length} aulas</span>
                 <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1E3A5F]" style={{ width: '0%' }} />
                 </div>
              </div>
           </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)} className="border-white/10 text-white hover:bg-white/5">
           <Menu className="h-4 w-4 mr-2" />
           {sidebarOpen ? 'Ocultar Aulas' : 'Mostrar Aulas'}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-black custom-scrollbar">
          <div className="max-w-[1200px] mx-auto p-0 lg:p-6 space-y-6">
            <div className="aspect-video bg-[#000] shadow-2xl overflow-hidden rounded-none lg:rounded-xl border border-white/5 group relative">
              {activeAula && renderVideoPlayer(activeAula.url_video)}
            </div>

            <div className="px-4 lg:px-0 space-y-6 pb-12">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">{activeAula?.titulo}</h2>
                  <p className="text-[#B3B3B3] mt-2 text-sm leading-relaxed max-w-2xl">
                    {activeAula?.descricao || "Aproveite esta aula do curso " + curso?.nome + "."}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                   <Button 
                     variant="outline" 
                     onClick={handlePrev} 
                     disabled={activeAulaIndex === 0}
                     className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                   >
                     Anterior
                   </Button>
                   <Button 
                     onClick={handleNext} 
                     disabled={activeAulaIndex === (curso?.aulas?.length || 0) - 1}
                     className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white font-bold"
                   >
                     Próxima Aula <ChevronRight className="ml-2 h-4 w-4" />
                   </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lesson Sidebar */}
        <div className={cn(
          "bg-[#1e1e1e] border-l border-white/5 flex flex-col transition-all duration-300 ease-in-out",
          sidebarOpen ? "w-full lg:w-[350px]" : "w-0 overflow-hidden lg:opacity-0 lg:w-0"
        )}>
          <div className="p-4 border-b border-white/5 font-bold tracking-tight text-[#B3B3B3] uppercase text-xs flex items-center justify-between">
             <span>Conteúdo do Curso</span>
             <span className="text-[#2D6ADF]">0%</span>
          </div>
          <ScrollArea className="flex-1 custom-scrollbar">
            <div className="p-0">
              {curso?.aulas?.map((aula: any, index: number) => {
                const isActive = activeAula?.id === aula.id;
                return (
                  <button
                    key={aula.id}
                    onClick={() => setActiveAulaId(aula.id)}
                    className={cn(
                      "w-full text-left px-6 py-6 border-b border-white/5 transition-all flex items-start gap-4 hover:bg-white/5 group",
                      isActive ? "bg-[#1E3A5F]/10 border-l-4 border-l-[#1E3A5F]" : ""
                    )}
                  >
                    <div className="mt-1 shrink-0">
                       <div className={cn(
                         "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                         isActive ? "bg-[#1E3A5F] text-white" : "bg-[#2a2a2a] text-[#B3B3B3] group-hover:bg-[#333]"
                       )}>
                          {isActive ? <Play className="h-4 w-4 fill-current" /> : <PlayCircle className="h-5 w-5" />}
                       </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          "text-xs font-black tracking-widest uppercase mb-1",
                          isActive ? "text-[#2D6ADF]" : "text-[#555]"
                        )}>
                          Aula {index + 1}
                        </span>
                      </div>
                      <p className={cn(
                        "text-sm font-bold leading-snug transition-colors",
                        isActive ? "text-[#2D6ADF]" : "text-white group-hover:text-white"
                      )}>
                        {aula.titulo}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
