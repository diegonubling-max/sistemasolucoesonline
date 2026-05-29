import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, PlayCircle, Loader2, Lock, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useStudentTheme } from "./_student";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_student/aluno/dashboard")({
  head: () => ({ meta: [{ title: "Meus Cursos — Soluções Online" }] }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const { session } = useAuth();
  const { isDark } = useStudentTheme();
  const [selectedVitrine, setSelectedVitrine] = useState<any>(null);

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
            thumbnail_url,
            segmento_id,
            segmentos (
              id,
              nome,
              ordem
            ),
            aulas (count)
          )
        `)
        .in("matricula_id", ids);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!session?.user.email,
  });

  const { data: studentData } = useQuery({
    queryKey: ["student-data", session?.user.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, ctr")
        .eq("email", session?.user.email ?? "")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user.email,
  });

  const { data: configs } = useQuery({
    queryKey: ["student-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("chave, valor");
      if (error) throw error;
      return data;
    },
  });

  const whatsappSuporte = configs?.find(c => c.chave === "whatsapp_suporte")?.valor || "";
  const mensagemPadrao = configs?.find(c => c.chave === "mensagem_whatsapp")?.valor || "";

  const { data: vitrine } = useQuery({
    queryKey: ["student-vitrine", session?.user.email],
    queryFn: async () => {
      if (!studentData?.id) return [];

      const { data, error } = await supabase
        .from("cursos_vitrine")
        .select(`
          *,
          cursos (
            id,
            nome,
            thumbnail_url
          )
        `)
        .eq("aluno_id", studentData.id)
        .eq("ativo", true);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!studentData?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-12">
        <Skeleton className="h-64 md:h-80 w-full rounded-2xl bg-gray-200" />
        <div className="space-y-6">
            <Skeleton className="h-8 w-48 bg-gray-200" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="aspect-[220/320] w-full rounded-xl bg-gray-200" />
                ))}
            </div>
        </div>
      </div>
    );
  }

  const gradients = [
    "from-blue-600 to-blue-400",
    "from-purple-600 to-purple-400",
    "from-green-600 to-green-400",
    "from-orange-600 to-orange-400",
    "from-red-600 to-red-400",
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      {/* Welcome Banner */}
      <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden bg-gradient-to-r from-[#1E3A5F] to-[#2D6ADF] flex items-center px-8 md:px-12 shadow-2xl">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight">
            Bem-vindo(a) de volta!
          </h1>
          <p className="text-lg md:text-xl text-white/80">
            Continue seus estudos de onde você parou.
          </p>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Meus Cursos</h2>
        
        {!cursos || cursos.length === 0 ? (
          <Card className="bg-white border-gray-200 border-dashed">
            <CardContent className="py-12 text-center space-y-4">
              <BookOpen className="h-12 w-12 mx-auto text-gray-500" />
              <div className="space-y-1">
                <p className="font-semibold text-lg text-gray-900">Nenhum curso encontrado</p>
                <p className="text-gray-500">Você ainda não possui matrículas ativas.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-12">
            {(() => {
              const groups: any = {};
              cursos.forEach((c: any) => {
                const curso = c.cursos;
                if (!curso) return;
                const seg = curso.segmentos;
                const segName = Array.isArray(seg) ? (seg[0]?.nome || "Outros") : (seg?.nome || "Outros");
                const segId = Array.isArray(seg) ? (seg[0]?.id || "others") : (seg?.id || "others");
                const segOrdem = Array.isArray(seg) ? (seg[0]?.ordem || 99) : (seg?.ordem || 99);
                
                if (!groups[segId]) {
                  groups[segId] = { id: segId, nome: segName, ordem: segOrdem, items: [] };
                }
                groups[segId].items.push(c);
              });

              const sortedGroups = Object.values(groups).sort((a: any, b: any) => a.ordem - b.ordem);
              const showGroups = sortedGroups.length > 1;

              return sortedGroups.map((group: any) => (
                <div key={group.id} className="space-y-6">
                  {showGroups && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-1 bg-[#1E3A5F] rounded-full" />
                      <h3 className="text-xl font-bold text-gray-800 uppercase tracking-wide">
                        {group.nome}
                      </h3>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {group.items.map((c: any, i: number) => {
                      const curso = c.cursos;
                      const aulasCount = Array.isArray(curso.aulas) ? (curso.aulas[0]?.count ?? 0) : 0;
                      const gradientIndex = (curso.nome?.length || 0) % gradients.length;
                      const gradientClass = gradients[gradientIndex];
                      
                      return (
                        <Link 
                          key={i} 
                          to="/aluno/curso/$id" 
                          params={{ id: curso.id }} 
                          className="group block w-full"
                        >
                          <div className="relative w-full aspect-[2/3] bg-[#f5f5f5] rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(45,106,223,0.3)] border border-gray-100 shadow-sm cursor-pointer flex items-center justify-center">
                            <div className="absolute inset-0 flex items-center justify-center">
                              {curso.thumbnail_url ? (
                                <img 
                                  src={curso.thumbnail_url} 
                                  alt={curso.nome}
                                  className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                                />
                              ) : (
                                <div className={`w-full h-full bg-gradient-to-br ${gradientClass} flex flex-col items-center justify-center p-4 text-center`}>
                                  <BookOpen className="h-12 w-12 text-white/40 mb-2" />
                                  <span className="text-white font-bold text-sm line-clamp-2">{curso.nome}</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                            </div>

                            <div className="absolute top-3 left-3">
                              <div className="bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                {aulasCount} {aulasCount === 1 ? 'Aula' : 'Aulas'}
                              </div>
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <h3 className="text-white font-bold text-base leading-tight line-clamp-2">
                                {curso.nome}
                              </h3>
                              <p className="text-gray-400 text-[10px] font-medium mt-1 uppercase tracking-widest">
                                Soluções Online
                              </p>
                            </div>

                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                              <div className="bg-[#2D6ADF] p-3 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                <PlayCircle className="h-8 w-8 text-white" />
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {vitrine && vitrine.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Cursos Disponíveis para Você 🔒</h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {vitrine.map((item: any) => {
              const curso = item.cursos;
              if (!curso) return null;
              const gradientIndex = (curso.nome?.length || 0) % gradients.length;
              const gradientClass = gradients[gradientIndex];
              
              return (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedVitrine(item)}
                  className="group cursor-pointer block w-full"
                >
                  <div className="relative w-full aspect-[2/3] bg-[#f5f5f5] rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(45,106,223,0.3)] border border-gray-100 shadow-sm flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center justify-center">
                      {curso.thumbnail_url ? (
                        <img 
                          src={curso.thumbnail_url} 
                          alt={curso.nome}
                          className="w-full h-full object-contain filter grayscale transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${gradientClass} flex flex-col items-center justify-center p-4 text-center filter grayscale`}>
                          <BookOpen className="h-12 w-12 text-white/40 mb-2" />
                          <span className="text-white font-bold text-sm line-clamp-2">{curso.nome}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40" />
                    </div>

                    <div className="absolute top-3 left-3">
                      <div className="bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Disponível
                      </div>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
                        <Lock className="h-10 w-10 text-white" />
                      </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-white font-bold text-base leading-tight line-clamp-2">
                        {curso.nome}
                      </h3>
                      <div className="mt-2 space-y-0.5">
                        <p className="text-white font-bold text-sm">
                          PIX: {formatCurrency(item.preco_pix)}
                        </p>
                        <p className="text-white/80 text-[10px] font-medium">
                          Cartão: até {item.max_parcelas}x de {formatCurrency(item.preco_cartao / item.max_parcelas)}
                        </p>
                      </div>
                    </div>

                    <div className="absolute inset-0 bg-[#1E3A5F]/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white font-bold text-xs uppercase tracking-widest bg-[#1E3A5F] px-3 py-2 rounded-lg">
                        Ver Detalhes
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!selectedVitrine} onOpenChange={(open) => !open && setSelectedVitrine(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-[#1E3A5F]" />
              Desbloquear Curso
            </DialogTitle>
          </DialogHeader>
          
          {selectedVitrine && (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-gray-900">{selectedVitrine.cursos?.nome}</h3>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl space-y-4 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Preço PIX</p>
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedVitrine.preco_pix)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Preço Cartão</p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(selectedVitrine.preco_cartao)}
                      </p>
                      <p className="text-sm text-purple-600 font-medium">
                        em até {selectedVitrine.max_parcelas}x de {formatCurrency(selectedVitrine.preco_cartao / selectedVitrine.max_parcelas)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 text-center">
                {!whatsappSuporte ? (
                  <p className="text-sm text-red-500 font-medium">Suporte temporariamente indisponível</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">Para adquirir este curso entre em contato conosco!</p>
                    <Button className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white border-none gap-2" asChild>
                      <a 
                        href={`https://wa.me/${whatsappSuporte}?text=${encodeURIComponent(
                          mensagemPadrao
                            .replace("[nome]", studentData?.nome || "")
                            .replace("[ctr]", String(studentData?.ctr || ""))
                        )}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Smartphone className="h-4 w-4" />
                        💬 Falar no WhatsApp
                      </a>
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setSelectedVitrine(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}