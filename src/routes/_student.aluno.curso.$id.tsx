import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, PlayCircle, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/_student/aluno/curso/$id")({
  head: () => ({ meta: [{ title: "Curso — EduManager" }] }),
  component: StudentCourse,
});

function StudentCourse() {
  const { id } = Route.useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
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
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/aluno/dashboard">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{curso?.nome}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content (Video + Info) */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="overflow-hidden border-none shadow-xl bg-black aspect-video">
            {activeAula && renderVideoPlayer(activeAula.url_video)}
            {!activeAula && (
              <div className="w-full h-full flex items-center justify-center text-white">
                Selecione uma aula para começar
              </div>
            )}
          </Card>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold">{activeAula?.titulo}</h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              {activeAula?.descricao || "Sem descrição para esta aula."}
            </div>
          </div>
        </div>

        {/* Sidebar (Lesson List) */}
        <div className="lg:col-span-1">
          <Card className="h-full max-h-[calc(100vh-12rem)] flex flex-col border-none shadow-lg">
            <div className="p-4 border-b font-bold">Conteúdo do Curso</div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {curso?.aulas?.map((aula: any, index: number) => {
                  const isActive = activeAula?.id === aula.id;
                  return (
                    <button
                      key={aula.id}
                      onClick={() => setActiveAulaId(aula.id)}
                      className={`w-full text-left p-3 rounded-lg flex items-start gap-3 transition-colors ${
                        isActive 
                        ? "bg-primary/10 text-primary border-l-4 border-primary" 
                        : "hover:bg-muted"
                      }`}
                    >
                      <div className="mt-0.5">
                        {isActive ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <PlayCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium leading-tight ${isActive ? 'font-bold' : ''}`}>
                          {index + 1}. {aula.titulo}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  );
}