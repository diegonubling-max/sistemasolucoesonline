import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Users } from "lucide-react";
import { maskPhone } from "@/lib/format";

export const Route = createFileRoute("/webinar/$id")({
  component: WebinarPage,
});

const EMOJIS = ["❤️", "🔥", "👏", "😂", "😮", "🙌", "✅", "🎉"];

function extrairYoutubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

interface Participante {
  id: string;
  nome: string;
  telefone: string;
}

function WebinarPage() {
  const { id } = Route.useParams();
  const [participante, setParticipante] = useState<Participante | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [qtdOnline, setQtdOnline] = useState(0);
  const [videoTime, setVideoTime] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const depoimentosMostradosRef = useRef<Set<string>>(new Set());

  const { data: webinar, isLoading } = useQuery({
    queryKey: ["webinar", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webinars" as any)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 15000,
  });

  const { data: depoimentosReplay } = useQuery({
    queryKey: ["webinar-depoimentos-replay", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webinar_depoimentos_replay" as any)
        .select("*")
        .eq("webinar_id", id)
        .order("timestamp_segundos", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!webinar?.gravado,
  });

  // Recupera participante salvo localmente (evita re-cadastro ao atualizar a página)
  useEffect(() => {
    const salvo = localStorage.getItem(`webinar_${id}_participante`);
    if (salvo) {
      try {
        setParticipante(JSON.parse(salvo));
      } catch {
        localStorage.removeItem(`webinar_${id}_participante`);
      }
    }
  }, [id]);

  const handleEntrar = async () => {
    if (!nome.trim() || telefone.replace(/\D/g, "").length < 10) return;
    setEntrando(true);
    try {
      const { data, error } = await supabase
        .from("webinar_participantes" as any)
        .insert({ webinar_id: id, nome: nome.trim(), telefone })
        .select("id, nome, telefone")
        .single();
      if (error) throw error;
      const p = data as any as Participante;
      setParticipante(p);
      localStorage.setItem(`webinar_${id}_participante`, JSON.stringify(p));
    } catch (e) {
      console.error(e);
    } finally {
      setEntrando(false);
    }
  };

  // Heartbeat de reforço (a cada 45s) — invisível pro aluno, só um "ainda estou aqui"
  // gravado em segundo plano. O Presence (abaixo) já detecta saída sozinho; isso é redundância extra.
  useEffect(() => {
    if (!participante) return;
    const enviar = () => {
      supabase
        .from("webinar_participantes" as any)
        .update({ ultimo_heartbeat: new Date().toISOString() })
        .eq("id", participante.id)
        .then(() => {});
    };
    enviar();
    const interval = setInterval(enviar, 45000);
    return () => clearInterval(interval);
  }, [participante]);

  // Presença em tempo real (Supabase Presence) — detecta entrada/saída automaticamente.
  // A biblioteca do Supabase cuida sozinha de detectar quando a aba fecha ou a conexão cai.
  useEffect(() => {
    if (!participante) return;

    const carregarComentarios = async () => {
      const { data } = await supabase
        .from("webinar_comentarios" as any)
        .select("*")
        .eq("webinar_id", id)
        .order("created_at", { ascending: true })
        .limit(200);
      setComentarios((data as any) ?? []);
    };
    carregarComentarios();

    const presenceChannel = supabase.channel(`webinar-presence-${id}`, {
      config: { presence: { key: participante.id } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        setQtdOnline(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ nome: participante.nome, entrou_em: new Date().toISOString() });
        }
      });

    const commentsChannel = supabase
      .channel(`webinar-comentarios-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "webinar_comentarios", filter: `webinar_id=eq.${id}` },
        (payload) => setComentarios((prev) => [...prev, payload.new]),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [participante, id]);

  const youtubeId = extrairYoutubeId(webinar?.youtube_url || "");

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [comentarios]);

  // Player via YouTube IFrame API — só pra aulas gravadas, pra conseguir ler o tempo atual do vídeo
  // e revelar os depoimentos reais no minuto certo, igual aconteceram na aula ao vivo original.
  useEffect(() => {
    if (!youtubeId || !webinar?.gravado || !participante) return;
    let destruido = false;
    let poll: any;

    function criarPlayer() {
      const el = document.getElementById(`yt-player-${id}`);
      if (!el) {
        if (!destruido) requestAnimationFrame(criarPlayer);
        return;
      }
      playerRef.current = new (window as any).YT.Player(`yt-player-${id}`, {
        videoId: youtubeId,
        playerVars: { autoplay: 1, mute: 1, playsinline: 1 },
        events: {
          onReady: () => {
            poll = setInterval(() => {
              const t = playerRef.current?.getCurrentTime?.();
              if (typeof t === "number") setVideoTime(t);
            }, 1000);
          },
        },
      });
    }

    if ((window as any).YT && (window as any).YT.Player) {
      criarPlayer();
    } else {
      if (!document.getElementById("youtube-iframe-api-script")) {
        const tag = document.createElement("script");
        tag.id = "youtube-iframe-api-script";
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }
      const anterior = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        anterior?.();
        criarPlayer();
      };
    }

    return () => {
      destruido = true;
      if (poll) clearInterval(poll);
    };
  }, [youtubeId, webinar?.gravado, participante, id]);

  // Revela os depoimentos reais da aula original conforme o vídeo avança
  useEffect(() => {
    if (!webinar?.gravado || !depoimentosReplay?.length) return;
    const novos = depoimentosReplay.filter(
      (d: any) => d.timestamp_segundos <= videoTime && !depoimentosMostradosRef.current.has(d.id),
    );
    if (novos.length === 0) return;
    novos.forEach((d: any) => depoimentosMostradosRef.current.add(d.id));
    setComentarios((prev) => [
      ...prev,
      ...novos.map((d: any) => ({ id: d.id, nome: d.nome, texto: d.texto, replay: true })),
    ]);
  }, [videoTime, depoimentosReplay, webinar?.gravado]);

  const enviarComentario = async () => {
    if (!novoComentario.trim() || !participante) return;
    const texto = novoComentario.trim();
    setNovoComentario("");
    await supabase.from("webinar_comentarios" as any).insert({
      webinar_id: id,
      participante_id: participante.id,
      nome: participante.nome,
      texto,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!webinar) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-muted-foreground">Aula não encontrada.</p>
      </div>
    );
  }

  // Tela de entrada — nome e telefone
  if (!participante) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 space-y-4">
            <h1 className="text-2xl font-bold text-center">{webinar.titulo}</h1>
            <p className="text-muted-foreground text-center text-sm">
              Preencha seus dados pra entrar na aula ao vivo:
            </p>
            <div className="space-y-3">
              <div>
                <Label>Nome completo</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(maskPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  inputMode="numeric"
                />
              </div>
              <Button
                className="w-full bg-orange-600 hover:bg-orange-700"
                onClick={handleEntrar}
                disabled={entrando || !nome.trim() || telefone.replace(/\D/g, "").length < 10}
              >
                {entrando ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Entrando...</> : "Entrar na aula"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (webinar.status === "agendado") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">{webinar.titulo}</h1>
          <p className="text-muted-foreground">A aula ainda não começou. Fique de olho, ela vai iniciar em breve!</p>
        </div>
      </div>
    );
  }

  if (webinar.status === "encerrado") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">{webinar.titulo}</h1>
          <p className="text-muted-foreground">Essa aula ao vivo já foi encerrada. Até a próxima!</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-black text-white flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-neutral-900">
          <h1 className="font-bold truncate">{webinar.titulo}</h1>
          <div className="flex items-center gap-1 text-sm bg-red-600 px-2 py-1 rounded-full">
            <Users className="h-4 w-4" />
            {qtdOnline}
          </div>
        </div>
        <div className="text-xs text-center bg-neutral-800 text-neutral-300 py-1">
          🔇 O vídeo inicia sem som (regra dos navegadores) — clique nele pra ativar o áudio
        </div>
        {webinar.gravado && (
          <div className="text-xs text-center bg-neutral-800/60 text-neutral-400 py-1">
            🎥 Aula gravada — comente à vontade, nosso time está online pra tirar dúvidas
          </div>
        )}
        <div className="aspect-video w-full bg-black">
          {youtubeId ? (
            webinar.gravado ? (
              <div id={`yt-player-${id}`} className="w-full h-full" />
            ) : (
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&playsinline=1`}
                title={webinar.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              Vídeo não configurado
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-80 flex flex-col bg-neutral-900 border-t lg:border-t-0 lg:border-l border-neutral-800 h-[45vh] lg:h-screen">
        <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {comentarios.map((c) => (
            <div key={c.id} className="text-sm">
              <span className={`font-bold ${c.replay ? "text-blue-400" : "text-orange-400"}`}>
                {c.nome}{c.replay ? " 🎥" : ""}:{" "}
              </span>
              <span>{c.texto}</span>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-neutral-800 space-y-2">
          <div className="flex gap-1 flex-wrap">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setNovoComentario((prev) => prev + e)}
                className="text-lg hover:scale-125 transition-transform"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={novoComentario}
              onChange={(e) => setNovoComentario(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviarComentario()}
              placeholder="Comente..."
              className="bg-neutral-800 border-neutral-700 text-white"
            />
            <Button size="icon" onClick={enviarComentario} disabled={!novoComentario.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
