import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, PlayCircle, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudentTheme } from "./_student";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_student/aluno/curso/$id")({
  head: () => ({ meta: [{ title: "Curso — EduManager" }] }),
  component: StudentCourse,
});

function StudentCourse() {
  const { id } = Route.useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { isDark } = useStudentTheme();
  const [activeAulaId, setActiveAulaId] = useState<string | null>(null);

  const { data: curso, isLoading: loadingCurso, error: cursoError } = useQuery({
    queryKey: ["student-course", id, session?.user.email],
    queryFn: async () => {
      // 1. Check enrollment
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

      // 2. Get course and lessons
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
      
      // Filter only active lessons and sort by order
      const activeAulas = (cursoData.aulas as any[])
        .filter(a => a.ativo)
        .sort((a, b) => a.ordem - b.ordem);

      return { ...cursoData, aulas: activeAulas };
    },
    enabled: !!session?.user.email,
  });

  const activeAula = curso?.aulas?.find(a => a.id === (activeAulaId || curso.aulas[0]?.id));

  if (loadingCurso) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="space-y-4">
            <Skeleton className={`h-4 w-32 ${isDark ? 'bg-[#1e1e1e]' : 'bg-gray-200'}`} />
            <Skeleton className={`h-10 w-64 ${isDark ? 'bg-[#1e1e1e]' : 'bg-gray-200'}`} />
            <Skeleton className={`h-4 w-48 ${isDark ? 'bg-[#1e1e1e]' : 'bg-gray-200'}`} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
            <div className="lg:col-span-7 space-y-6">
                <Skeleton className={`aspect-video w-full rounded-xl ${isDark ? 'bg-[#1e1e1e]' : 'bg-gray-200'}`} />
                <Skeleton className={`h-48 w-full rounded-xl ${isDark ? 'bg-[#1e1e1e]' : 'bg-gray-200'}`} />
            </div>
            <div className="lg:col-span-3">
                <Skeleton className={`h-[500px] w-full rounded-xl ${isDark ? 'bg-[#1e1e1e]' : 'bg-gray-200'}`} />
            </div>
        </div>
      </div>
    );
  }

  if (cursoError) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
        <h2 className="text-xl font-bold">Erro de Acesso</h2>
        <p className="text-muted-foreground">{cursoError.message}</p>
        <Button onClick={() => navigate({ to: "/aluno/dashboard" })}>Voltar para Meus Cursos</Button>
      </div>
    );
  }

  const renderVideoPlayer = (url: string) => {
    if (!url) return <div className="aspect-video bg-black flex items-center justify-center text-white">URL de vídeo não fornecida</div>;

    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const id = url.includes('v=') ? url.split('v=')[1]?.split('&')[0] : url.split('/').pop();
      return (
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${id}`}
          allowFullScreen
        ></iframe>
      );
    }

    // Vimeo
    if (url.includes('vimeo.com')) {
      const id = url.split('/').pop();
      return (
        <iframe
          className="w-full h-full"
          src={`https://player.vimeo.com/video/${id}`}
          allowFullScreen
        ></iframe>
      );
    }

    // Pandavideo (example pattern)
    if (url.includes('pandavideo.com.br')) {
      return (
        <iframe
          className="w-full h-full"
          src={url}
          allowFullScreen
        ></iframe>
      );
    }

    return (
       <div className="aspect-video bg-black flex items-center justify-center text-white px-4 text-center">
         Vídeo incorporado via link: <a href={url} target="_blank" className="underline ml-2">{url}</a>
       </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <Link to="/aluno/dashboard" className={`${isDark ? "text-[#B3B3B3] hover:text-white" : "text-gray-500 hover:text-gray-900"} flex items-center gap-1 text-sm font-medium transition-colors`}>
            <ChevronLeft className="h-4 w-4" /> Voltar para o início
          </Link>
          <h1 className={`text-3xl md:text-4xl font-bold ${isDark ? "text-white" : "text-gray-900"} tracking-tight`}>{curso?.nome}</h1>
          <div className={`flex items-center gap-4 text-sm ${isDark ? "text-[#B3B3B3]" : "text-gray-500"}`}>
             <span>{curso?.aulas?.length} aulas</span>
             <span className={`h-1 w-1 rounded-full ${isDark ? "bg-[#333]" : "bg-gray-300"}`} />
             <span className="text-[#2D6ADF] font-bold">0% concluído</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
        {/* Main Content (Video + Info) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5 group">
            {activeAula && renderVideoPlayer(activeAula.url_video)}
            {!activeAula && (
              <div className="w-full h-full flex items-center justify-center text-[#B3B3B3]">
                Selecione uma aula para começar
              </div>
            )}
          </div>

          <div className={`${isDark ? "bg-[#1e1e1e] border-white/5" : "bg-white border-black/5 shadow-md"} p-6 rounded-xl border space-y-6 transition-colors`}>
            <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${isDark ? "border-white/5" : "border-black/5"} pb-6`}>
                <h2 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{activeAula?.titulo}</h2>
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className={`bg-transparent ${isDark ? "border-white/10 text-white hover:bg-white/5" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                        disabled
                    >
                        ⬅ Anterior
                    </Button>
                    <Button 
                        variant="default" 
                        size="sm" 
                        className="bg-[#2D6ADF] hover:bg-[#2D6ADF]/90 text-white shadow-lg shadow-[#2D6ADF]/20"
                        disabled
                    >
                        Próxima ➡
                    </Button>
                </div>
            </div>
            
            <div className="space-y-3">
                <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Sobre esta aula</h3>
                <div className={`${isDark ? "text-[#B3B3B3]" : "text-gray-600"} leading-relaxed`}>
                {activeAula?.descricao || "Sem descrição para esta aula."}
                </div>
            </div>
          </div>
        </div>

        {/* Sidebar (Lesson List) */}
        <div className="lg:col-span-3">
          <div className={`${isDark ? "bg-[#1e1e1e] border-white/5" : "bg-white border-black/5 shadow-lg"} rounded-xl border overflow-hidden flex flex-col h-full max-h-[calc(100vh-12rem)] transition-colors`}>
            <div className={`p-4 border-b ${isDark ? "border-white/5" : "border-black/5"} flex items-center justify-between`}>
                <span className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Lista de aulas</span>
                <span className={`text-xs ${isDark ? "text-[#B3B3B3]" : "text-gray-500"}`}>{curso?.aulas?.length} vídeos</span>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {curso?.aulas?.map((aula: any, index: number) => {
                  const isActive = activeAula?.id === aula.id;
                  return (
                    <button
                      key={aula.id}
                      onClick={() => setActiveAulaId(aula.id)}
                      className={`w-full text-left p-4 rounded-lg flex items-center gap-4 transition-all duration-200 group ${
                        isActive 
                        ? "bg-[#2D6ADF]/10 border border-[#2D6ADF]/20" 
                        : isDark ? "hover:bg-white/5 border border-transparent" : "hover:bg-gray-50 border border-transparent"
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isActive ? 'bg-[#2D6ADF] text-white' : isDark ? 'bg-[#333] text-[#B3B3B3]' : 'bg-gray-100 text-gray-400'}`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium leading-tight transition-colors ${isActive ? (isDark ? 'text-white font-bold' : 'text-[#2D6ADF] font-bold') : isDark ? 'text-[#B3B3B3] group-hover:text-white' : 'text-gray-600 group-hover:text-gray-900'}`}>
                          {aula.titulo}
                        </p>
                      </div>
                      {isActive && <div className="h-1.5 w-1.5 rounded-full bg-[#2D6ADF] animate-pulse" />}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}