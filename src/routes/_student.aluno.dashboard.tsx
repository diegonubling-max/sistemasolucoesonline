import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, PlayCircle, Loader2, Lock, Smartphone, CheckCircle2, Star, Sparkles, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useStudentTheme } from "./_student";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BannerCarousel } from "@/components/student/BannerCarousel";
import { CheckoutVitrineModal } from "@/components/student/CheckoutVitrineModal";

export const Route = createFileRoute("/_student/aluno/dashboard")({
  head: () => ({ meta: [{ title: "Meus Cursos — Soluções Online" }] }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isDark } = useStudentTheme();
  const [selectedVitrine, setSelectedVitrine] = useState<any>(null);
  const [showProvaFinalDialog, setShowProvaFinalDialog] = useState(false);
  const [showLockedProvaDialog, setShowLockedProvaDialog] = useState(false);
  const [showAgendadoDialog, setShowAgendadoDialog] = useState(false);
  const [showResgateSucesso, setShowResgateSucesso] = useState(false);
  const [confirmResgate, setConfirmResgate] = useState<any>(null);
  const [checkoutVitrine, setCheckoutVitrine] = useState<any>(null);


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
            is_prova_final,
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
        .select("id, nome, ctr, data_liberacao_prova, created_at")
        .eq("email", session?.user.email ?? "")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user.email,
  });

  const { data: agendamento } = useQuery({
    queryKey: ["student-agendamento", studentData?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prova_agendamentos")
        .select("*")
        .eq("aluno_id", studentData!.id)
        .eq("status", "agendado")
        .order("data_prova", { ascending: true })
        .order("hora_prova", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!studentData?.id,
  });

  const { data: poloData } = useQuery({
    queryKey: ["student-polo-data", studentData?.id],
    queryFn: async () => {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("polos(*)")
        .eq("id", studentData!.id)
        .single();
      return (aluno as any)?.polos;
    },
    enabled: !!studentData?.id,
  });

  const whatsappSuporte = poloData?.whatsapp || "";
  const nomeEscola = poloData?.nome_escola || "Soluções Online";

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
            descricao,
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

  const { data: milhasSaldo } = useQuery({
    queryKey: ["milhas-saldo", studentData?.id],
    queryFn: async () => {
      if (!studentData?.id) return 0;
      const { data } = await supabase
        .from("milhas_eja")
        .select("pontos_disponiveis")
        .eq("aluno_id", studentData.id)
        .maybeSingle();
      return (data?.pontos_disponiveis as number) ?? 0;
    },
    enabled: !!studentData?.id,
  });

  const resgatarCurso = useMutation({
    mutationFn: async (vitrineId: string) => {
      const { error } = await supabase.rpc("resgatar_curso_vitrine", { p_vitrine_id: vitrineId });
      if (error) throw error;
    },
    onSuccess: () => {
      setConfirmResgate(null);
      setSelectedVitrine(null);
      setShowResgateSucesso(true);
      qc.invalidateQueries({ queryKey: ["student-vitrine"] });
      qc.invalidateQueries({ queryKey: ["student-courses"] });
      qc.invalidateQueries({ queryKey: ["milhas-saldo"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-12">
        <Skeleton className="h-40 md:h-80 w-full rounded-2xl bg-gray-200" />
        <div className="space-y-6">
            <Skeleton className="h-8 w-48 bg-gray-200" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
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
    <div className="space-y-6 sm:space-y-12 animate-in fade-in duration-700">
      {/* Welcome Banner / Carrossel do polo */}
      <div className="-mx-3 sm:mx-0 -mt-4 sm:mt-0 mb-2 sm:mb-0 p-0">
        <BannerCarousel poloId={(poloData as any)?.id} />
      </div>

      <div className="space-y-4 sm:space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 px-1 sm:px-0">Meus Cursos</h2>

        
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

              // Order items within each group: is_prova_final at the END
              Object.values(groups).forEach((group: any) => {
                group.items.sort((a: any, b: any) => {
                  if (a.cursos?.is_prova_final && !b.cursos?.is_prova_final) return 1;
                  if (!a.cursos?.is_prova_final && b.cursos?.is_prova_final) return -1;
                  return 0;
                });
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
                  <div className="flex gap-3 overflow-x-auto overflow-y-hidden snap-x pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-6">

                    {group.items.map((c: any, i: number) => {
                      const curso = c.cursos;
                      const aulasCount = Array.isArray(curso.aulas) ? (curso.aulas[0]?.count ?? 0) : 0;
                      const gradientIndex = (curso.nome?.length || 0) % gradients.length;
                      const gradientClass = gradients[gradientIndex];
                      
                      const isProvaFinal = curso.is_prova_final;
                      let isReleased = true;
                      let daysRemaining = 0;

                      if (isProvaFinal && studentData?.data_liberacao_prova) {
                        const releaseDate = new Date(studentData.data_liberacao_prova);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        const diffTime = releaseDate.getTime() - today.getTime();
                        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        isReleased = daysRemaining <= 0;
                      }
                      
                      const cardContent = (
                        <div className={cn(
                          "relative w-full aspect-[2/3] bg-[#f5f5f5] rounded-xl overflow-hidden transition-all duration-300 border border-gray-100 shadow-sm cursor-pointer flex items-center justify-center hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(45,106,223,0.3)]",
                          isReleased && isProvaFinal && "border-yellow-400 border-2 shadow-[0_0_15px_rgba(250,204,21,0.4)]"
                        )}>
                          <div className="absolute inset-0 flex items-center justify-center">
                            {curso.thumbnail_url ? (
                              <img 
                                src={curso.thumbnail_url} 
                                alt={curso.nome}
                                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className={cn(
                                "w-full h-full bg-gradient-to-br flex flex-col items-center justify-center p-4 text-center",
                                gradientClass
                              )}>
                                <BookOpen className="h-12 w-12 text-white/40 mb-2" />
                                <span className="text-white font-bold text-sm line-clamp-2">{curso.nome}</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                          </div>

                          <div className="absolute top-3 left-3 z-10">
                            <div className="bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                              {aulasCount} {aulasCount === 1 ? 'Aula' : 'Aulas'}
                            </div>
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                            <h3 className="text-white font-bold text-base leading-tight line-clamp-2">
                              {curso.nome}
                            </h3>
                            {isProvaFinal && (
                              <div className="mt-1">
                                {agendamento ? (
                                  (() => {
                                    const dataHoraStr = `${agendamento.data_prova}T${agendamento.hora_prova}`;
                                    const dataHoraProva = new Date(dataHoraStr);
                                    const agora = new Date();
                                    const hoje = new Date();
                                    hoje.setHours(0, 0, 0, 0);
                                    
                                    const dataProva = new Date(agendamento.data_prova + 'T00:00:00');
                                    
                                    if (agora >= dataHoraProva) {
                                      return (
                                        <p className="text-green-400 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                                          🎯 Prova Liberada! Começar Agora
                                        </p>
                                      );
                                    }
                                    
                                    if (hoje.getTime() === dataProva.getTime()) {
                                      return (
                                        <p className="text-yellow-400 text-[10px] font-bold uppercase tracking-wider">
                                          Sua prova é HOJE às {agendamento.hora_prova.substring(0, 5)}! 💪
                                        </p>
                                      );
                                    }
                                    
                                    const diffTime = dataProva.getTime() - hoje.getTime();
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    
                                    return (
                                      <p className="text-white/80 text-[10px] font-medium uppercase tracking-wider">
                                        Agendada: {dataProva.toLocaleDateString('pt-BR')} às {agendamento.hora_prova.substring(0, 5)} (Faltam {diffDays} {diffDays === 1 ? 'dia' : 'dias'}) 📚
                                      </p>
                                    );
                                  })()
                                ) : isReleased ? (
                                  <p className="text-yellow-400 text-[10px] font-bold uppercase tracking-wider">
                                    Sua Prova Final está disponível para agendamento!
                                  </p>
                                ) : (
                                  <p className="text-white/80 text-[10px] font-medium uppercase tracking-wider">
                                    Faltam {daysRemaining} dias
                                  </p>
                                )}
                              </div>
                            )}
                            {!isProvaFinal && (
                              <p className="text-gray-400 text-[10px] font-medium mt-1 uppercase tracking-widest">
                                Soluções Online
                              </p>
                            )}
                          </div>

                          {isReleased && !isProvaFinal && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                              <div className="bg-[#2D6ADF] p-3 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                <PlayCircle className="h-8 w-8 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      );

                      if (isProvaFinal) {
                        return (
                          <div 
                            key={i} 
                            onClick={() => {
                              navigate({ to: "/aluno/prova-final" });
                            }}
                            className="group block w-[140px] shrink-0 snap-start sm:w-full"
                          >
                            {cardContent}
                          </div>
                        );
                      }

                      if (!isReleased) {
                        return (
                          <div key={i} className="group block w-[140px] shrink-0 snap-start sm:w-full cursor-not-allowed">
                            {cardContent}
                          </div>
                        );
                      }
                      
                      return (
                        <Link 
                          key={i} 
                          to="/aluno/curso/$id" 
                          params={{ id: curso.id }} 
                          className="group block w-[140px] shrink-0 snap-start sm:w-full"
                        >
                          {cardContent}
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
          <h2 className="text-2xl font-bold text-gray-900">Cursos exclusivos para você</h2>
          
          <div className="flex gap-3 overflow-x-auto overflow-y-hidden snap-x pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-6">
            {vitrine.map((item: any) => {
              const curso = item.cursos;
              if (!curso) return null;
              const gradientIndex = (curso.nome?.length || 0) % gradients.length;
              const gradientClass = gradients[gradientIndex];
              
              return (
                <div 
                  key={item.id} 
                  onClick={async () => {
                    setSelectedVitrine(item);
                    try {
                      if (studentData?.id && curso?.id) {
                        const today = new Date().toISOString().slice(0, 10);
                        const { data: existing } = await supabase
                          .from("vitrine_cliques")
                          .select("id")
                          .eq("aluno_id", studentData.id)
                          .eq("curso_id", curso.id)
                          .gte("clicado_em", `${today}T00:00:00Z`)
                          .lte("clicado_em", `${today}T23:59:59Z`)
                          .limit(1);
                        if (!existing || existing.length === 0) {
                          const { data: alunoRow } = await supabase
                            .from("alunos").select("polo_id").eq("id", studentData.id).maybeSingle();
                          await supabase.from("vitrine_cliques").insert({
                            aluno_id: studentData.id,
                            curso_id: curso.id,
                            polo_id: (alunoRow as any)?.polo_id ?? null,
                            clicado_em: new Date().toISOString(),
                          });
                        }
                      }
                    } catch (e) { console.warn("vitrine_cliques insert failed", e); }
                  }}
                  className="group cursor-pointer block w-[140px] shrink-0 snap-start sm:w-full"
                >
                  {/* Nome acima da thumbnail */}
                  <div className="mb-2 px-1">
                    <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 leading-tight line-clamp-2 min-h-[2.4em]">
                      {curso.nome}
                    </h3>
                  </div>

                  <div className="relative w-full aspect-[2/3] bg-[#f5f5f5] rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(45,106,223,0.3)] border border-gray-100 shadow-sm flex items-center justify-center">
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
                      <div className="absolute inset-0 bg-black/20" />
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

                    <div
                      className="absolute bottom-0 left-0 right-0 p-4 pt-10"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0))" }}
                    >
                      {(() => {
                        const valorPix = Number(item.valor_pix ?? item.preco_pix ?? 0);
                        const valorCartao = Number(item.valor_cartao ?? item.preco_cartao ?? 0);
                        const pixDesc = item.valor_pix_desconto != null ? Number(item.valor_pix_desconto) : null;
                        const cartaoDesc = item.valor_cartao_desconto != null ? Number(item.valor_cartao_desconto) : null;
                        const pontosNec = item.pontos_desconto != null
                          ? Number(item.pontos_desconto)
                          : item.pontos_necessarios != null
                            ? Number(item.pontos_necessarios)
                            : null;

                        const cartaoFinal = cartaoDesc ?? valorCartao;
                        const pixFinal = pixDesc ?? valorPix;
                        const parcela = cartaoFinal / 12;

                        return (
                          <div className="leading-tight overflow-hidden">
                            <p className="text-[10px] text-white/70 line-through truncate">
                              De {formatCurrency(valorPix)}
                            </p>
                            <p className="text-lg font-extrabold text-yellow-300 truncate">
                              {formatCurrency(pixFinal)}
                              <span className="text-[10px] font-medium ml-1">
                                no PIX{pontosNec != null ? ` com ${pontosNec} pts` : ""}
                              </span>
                            </p>
                            <p className="text-[11px] text-yellow-300/90 truncate">
                              ou 12x de {formatCurrency(parcela)}
                            </p>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="absolute inset-0 bg-[#1E3A5F]/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white font-bold text-xs uppercase tracking-widest bg-[#1E3A5F] px-3 py-2 rounded-lg">
                        Ver Detalhes
                      </span>
                    </div>
                  </div>

                  {/* Preço abaixo da thumbnail */}
                  {(() => {
                    const valorPix = Number(item.valor_pix ?? item.preco_pix ?? 0);
                    const valorCartao = Number(item.valor_cartao ?? item.preco_cartao ?? 0);
                    const pixDesc = item.valor_pix_desconto != null ? Number(item.valor_pix_desconto) : null;
                    const cartaoDesc = item.valor_cartao_desconto != null ? Number(item.valor_cartao_desconto) : null;
                    const pixFinal = pixDesc ?? valorPix;
                    const cartaoFinal = cartaoDesc ?? valorCartao;
                    const parcela = cartaoFinal / 12;
                    return (
                      <p className="mt-2 px-1 text-[11px] sm:text-xs text-gray-700 font-medium leading-tight">
                        PIX: <span className="font-bold text-gray-900">{formatCurrency(pixFinal)}</span>
                        <span className="text-gray-400"> | </span>
                        12x de <span className="font-bold text-gray-900">{formatCurrency(parcela)}</span>
                      </p>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prova Final Scheduling Dialog */}
      <Dialog open={showProvaFinalDialog} onOpenChange={setShowProvaFinalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Sua Prova Final está disponível! 🎓
            </DialogTitle>
            <DialogDescription className="text-gray-700 pt-2">
              Parabéns! Sua prova final já está liberada para agendamento. Clique no botão abaixo para falar com nosso setor de provas e marcar seu exame.
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 flex items-start gap-3 my-4">
            <div className="p-2 bg-yellow-400 rounded-full text-white">
              <Smartphone className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-yellow-800 font-bold uppercase tracking-wider">Atenção</p>
              <p className="text-sm text-yellow-700">O agendamento é feito exclusivamente via WhatsApp com o setor de provas.</p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white border-none gap-2 py-6 text-lg" 
              asChild
            >
              <a 
                href={`https://wa.me/${whatsappSuporte}?text=${encodeURIComponent("Olá! Sou o(a) aluno(a) " + studentData?.nome + " (CTR: " + studentData?.ctr + ") e gostaria de agendar minha Prova Final.")}`}
                target="_blank"
                rel="noreferrer"
              >
                <Smartphone className="h-5 w-5" />
                Agendar via WhatsApp
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAgendadoDialog} onOpenChange={setShowAgendadoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Sua Prova está Agendada! 🎓
            </DialogTitle>
            <DialogDescription className="text-gray-700 pt-2">
              Você já possui um agendamento para a sua prova final.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col items-center text-center space-y-1">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Data</span>
                <span className="font-bold text-gray-900">
                  {agendamento && new Date(agendamento.data_prova + 'T00:00:00').toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col items-center text-center space-y-1">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Horário</span>
                <span className="font-bold text-gray-900">
                  {agendamento?.hora_prova?.substring(0, 5)}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
              <div className="p-2 bg-blue-500 rounded-full text-white">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-blue-800 font-bold uppercase tracking-wider">Acesso</p>
                <p className="text-sm text-blue-700">A prova será liberada automaticamente no dia e horário agendados na aba "Prova Final".</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button className="w-full bg-[#1E3A5F]" onClick={() => navigate({ to: "/aluno/prova-final" })}>
              Ir para Prova Final
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLockedProvaDialog} onOpenChange={setShowLockedProvaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Sua Prova Final está chegando! 🎓
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-6 space-y-4 text-center">
            {(() => {
              const releaseDate = new Date(studentData?.data_liberacao_prova || "");
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const diffTime = releaseDate.getTime() - today.getTime();
              const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              return (
                <div className="space-y-4">
                  <p className="text-gray-700 leading-relaxed">
                    Faltam apenas <span className="font-bold text-[#1E3A5F]">{days} dias</span> para você realizar sua Prova Final. 
                    Continue estudando com dedicação! Você está cada vez mais perto de realizar o sonho de concluir seus estudos e conquistar seu certificado. 
                    Acredite em você! Em {days} dias esse momento chegará. 💪
                  </p>
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button className="w-full bg-[#1E3A5F]" onClick={() => setShowLockedProvaDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedVitrine} onOpenChange={(open) => !open && setSelectedVitrine(null)}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto overscroll-contain p-0 touch-pan-y">
          {selectedVitrine && (() => {
            const v = selectedVitrine;
            const curso = v.cursos || {};
            const pix = Number(v.valor_pix ?? v.preco_pix ?? 0);
            const cartao = Number(v.valor_cartao ?? v.preco_cartao ?? 0);
            const pixDesc = Number(v.valor_pix_desconto ?? 0);
            const cartaoDesc = Number(v.valor_cartao_desconto ?? 0);
            const pontosNec = Number(v.pontos_desconto ?? v.pontos_necessarios ?? 0);
            const saldo = milhasSaldo ?? 0;
            const temDesconto = pixDesc > 0 && cartaoDesc > 0 && pontosNec > 0;
            const podeDesconto = temDesconto && saldo >= pontosNec;
            const economia = podeDesconto ? Math.max(0, pix - pixDesc) : 0;
            const parcelaCartaoDesc = cartaoDesc / 12;
            const parcelaCartao = cartao / 12;

            return (
              <>
                <DialogHeader className="px-6 pt-6 pb-2">
                  <DialogTitle className="text-2xl font-extrabold text-[#1E3A5F]">{curso.nome}</DialogTitle>
                </DialogHeader>

                <div className="px-6 pb-2 pt-2">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {curso.thumbnail_url && (
                      <div className="relative w-full sm:w-44 shrink-0 mx-auto sm:mx-0">
                        <div className="aspect-[3/4] w-full overflow-hidden rounded-lg shadow-md bg-gray-100">
                          <img src={curso.thumbnail_url} alt={curso.nome} className="h-full w-full object-cover" />
                        </div>
                        {podeDesconto && (
                          <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-pulse">
                            🔥 OFERTA
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {curso.descricao ? (
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                          {curso.descricao}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500 italic">Sem descrição disponível.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-4 space-y-5">
                  <div className="space-y-3">
                    <div className={`rounded-xl border-2 p-4 shadow-sm ${podeDesconto ? "border-green-400 bg-gradient-to-br from-green-50 to-emerald-50" : "border-green-300 bg-green-50"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-green-700 uppercase tracking-wider">PIX — À vista</span>
                        {podeDesconto && (
                          <span className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded-full font-bold">MELHOR PREÇO</span>
                        )}
                      </div>
                      {pix > 0 && pix !== pixDesc && (
                        <p className="text-xs text-gray-400 line-through">De {formatCurrency(pix)}</p>
                      )}
                      <p className="text-3xl font-extrabold text-green-600 leading-tight">
                        {formatCurrency(pixDesc)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">Parcela única de <b>{formatCurrency(pixDesc)}</b></p>
                    </div>

                    <div className="rounded-xl border border-orange-300 bg-orange-50 p-4">
                      <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">Cartão</span>
                      {cartao > 0 && cartao !== cartaoDesc && (
                        <p className="text-xs text-gray-400 line-through">De {formatCurrency(cartao)}</p>
                      )}
                      <p className="text-2xl font-extrabold text-orange-600 leading-tight">
                        12x de {formatCurrency(cartaoDesc / 12)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">Total: <b>{formatCurrency(cartaoDesc)}</b></p>
                    </div>

                    {podeDesconto && economia > 0 && (
                      <div className="rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-3 text-center font-bold shadow-md">
                        💰 Você economiza {formatCurrency(economia)} com suas Milhas EJA!
                      </div>
                    )}

                    {temDesconto && !podeDesconto && (
                      <div className="rounded-xl border-2 border-dashed border-yellow-400 bg-yellow-50 p-3 text-center">
                        <p className="text-sm font-semibold text-yellow-800">
                          ⭐ Faltam <b>{pontosNec - saldo} pts</b> para desbloquear este desconto
                        </p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Continue estudando para acumular Milhas EJA!
                        </p>
                      </div>
                    )}
                  </div>

                  <Button
                    disabled={temDesconto && !podeDesconto}
                    className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white gap-2 text-base font-bold py-6 animate-vitrine-pulse disabled:opacity-60 disabled:animate-none disabled:cursor-not-allowed"
                    onClick={() => {
                      setCheckoutVitrine(selectedVitrine);
                      setSelectedVitrine(null);
                    }}
                  >
                    <Zap className="h-5 w-5" />
                    {temDesconto && !podeDesconto
                      ? `Faltam ${pontosNec - saldo} pts para liberar`
                      : "Garantir minha vaga"}
                  </Button>

                  <Button variant="outline" className="w-full" onClick={() => setSelectedVitrine(null)}>
                    Fechar
                  </Button>
                </div>

              </>
            );
          })()}
        </DialogContent>
      </Dialog>


      <Dialog open={!!confirmResgate} onOpenChange={(o) => !o && setConfirmResgate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar resgate</DialogTitle>
          </DialogHeader>
          {confirmResgate && (
            <div className="space-y-3 text-sm">
              <p>
                Deseja usar <b>{confirmResgate.pontos_necessarios} pts</b> para adquirir{" "}
                <b>{confirmResgate.cursos?.nome}</b> por{" "}
                <b>{formatCurrency(confirmResgate.preco_com_pontos)}</b>?
              </p>
              <div className="bg-gray-50 rounded-lg p-3 border text-xs space-y-1">
                <div>Saldo atual: <b>{milhasSaldo ?? 0} pts</b></div>
                <div>Saldo após resgate: <b>{(milhasSaldo ?? 0) - confirmResgate.pontos_necessarios} pts</b></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmResgate(null)}>Cancelar</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={resgatarCurso.isPending}
              onClick={() => confirmResgate && resgatarCurso.mutate(confirmResgate.id)}
            >
              {resgatarCurso.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar resgate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResgateSucesso} onOpenChange={setShowResgateSucesso}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="sr-only">Sucesso</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Sparkles className="h-12 w-12 text-yellow-500 mx-auto" />
            <h3 className="text-xl font-bold">🎉 Curso desbloqueado!</h3>
            <p className="text-sm text-gray-600">Acesse agora na sua área de estudos.</p>
            <Button className="w-full" onClick={() => setShowResgateSucesso(false)}>
              Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CheckoutVitrineModal
        vitrine={checkoutVitrine}
        open={!!checkoutVitrine}
        onClose={() => setCheckoutVitrine(null)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["student-courses"] });
          qc.invalidateQueries({ queryKey: ["vitrine-cursos"] });
          setShowResgateSucesso(true);
        }}
      />
    </div>
  );
}