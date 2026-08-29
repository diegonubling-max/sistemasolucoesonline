import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Users, Clock, PhoneCall, School, Maximize, X } from "lucide-react";
import { maskPhone } from "@/lib/format";

const TOLERANCIA_MINUTOS = 20;

// Curva do contador de "pessoas ao vivo" simulado (pedido do Diego, 28/08/2026 — 2ª versão,
// pontos de corte ajustados pra começar logo no início do vídeo em vez de aos 16-21min):
// sobe devagar de 0:01 até 2:20, sobe rápido de 2:21 até 3:40, fica oscilando entre 67-73 dos
// 4min até faltarem 3min pro fim, e cai gradualmente nos últimos 3 minutos até ~32 no fim.
const CONTADOR_RAMPA1_INICIO = 1; // 0:01 — começa a subir
const CONTADOR_RAMPA1_FIM = 2 * 60 + 20; // 2:20 — fim da subida devagar
const CONTADOR_RAMPA2_FIM = 3 * 60 + 40; // 3:40 — fim da subida rápida, já no platô
const CONTADOR_PLATO_MIN = 67;
const CONTADOR_PLATO_MAX = 73;
const CONTADOR_QUEDA_SEGUNDOS_ANTES_FIM = 3 * 60; // últimos 3 minutos
const CONTADOR_FINAL = 32; // fica em torno de 30-35 no exato fim do vídeo

function getEspectadoresSimulados(videoTime: number, duracaoVideo: number): number {
  if (videoTime < CONTADOR_RAMPA1_INICIO) return 0;

  if (videoTime < CONTADOR_RAMPA1_FIM) {
    // 0:01 a 2:20: sobe devagar, de 1 até uns 5.
    const fracao = (videoTime - CONTADOR_RAMPA1_INICIO) / (CONTADOR_RAMPA1_FIM - CONTADOR_RAMPA1_INICIO);
    return Math.max(1, Math.round(fracao * 5));
  }

  // Base "orgânica" do platô — soma de duas ondas senoidais (períodos diferentes, não múltiplos
  // um do outro) pra oscilar sem parecer repetitivo, mantendo sempre dentro de 67-73.
  const platoBase =
    (CONTADOR_PLATO_MIN + CONTADOR_PLATO_MAX) / 2 +
    Math.sin(videoTime / 17) * 2.5 +
    Math.sin(videoTime / 41) * 1.5;
  const plato = Math.min(CONTADOR_PLATO_MAX, Math.max(CONTADOR_PLATO_MIN, Math.round(platoBase)));

  if (videoTime < CONTADOR_RAMPA2_FIM) {
    // 2:21 a 3:40: sobe rápido de 5 até o platô calculado acima (nunca para de entrar gente).
    const fracao = (videoTime - CONTADOR_RAMPA1_FIM) / (CONTADOR_RAMPA2_FIM - CONTADOR_RAMPA1_FIM);
    return Math.max(5, Math.round(5 + fracao * (plato - 5)));
  }

  const inicioQueda = duracaoVideo > 0 ? duracaoVideo - CONTADOR_QUEDA_SEGUNDOS_ANTES_FIM : Infinity;
  if (duracaoVideo > 0 && videoTime >= inicioQueda) {
    // Últimos 3 minutos: cai gradualmente do platô até ~30-35 bem no fim do vídeo.
    const fracao = Math.min(1, (videoTime - inicioQueda) / CONTADOR_QUEDA_SEGUNDOS_ANTES_FIM);
    return Math.round(plato - fracao * (plato - CONTADOR_FINAL));
  }

  return plato;
}

export const Route = createFileRoute("/webinar/$id")({
  component: WebinarPage,
});

const EMOJIS = ["❤️", "🔥", "👏", "😂", "😮", "🙌", "✅", "🎉"];

function extrairYoutubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// Monta/dispara a abertura no app do YouTube — configurável por webinar (modo_acesso).
// - Android: o esquema intent:// força a abertura no app do YouTube quando ele está instalado,
//   com fallback automático pro navegador se não tiver o app.
// - iOS: o link https:// padrão (Universal Links) nem sempre abre o app de fato (depende de
//   configuração do aparelho/app) — por isso usamos o esquema próprio do app (youtube://) com
//   um fallback por tempo: se o app não abrir em ~1,5s (a aba continua visível), cai pro link
//   normal.
function abrirYoutubeApp(youtubeUrl: string) {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  const videoId = extrairYoutubeId(youtubeUrl);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isAndroid && videoId) {
    window.location.href = `intent://www.youtube.com/watch?v=${videoId}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(youtubeUrl)};end`;
    return;
  }

  if (isIOS && videoId) {
    const fallbackTimer = setTimeout(() => {
      window.location.href = youtubeUrl;
    }, 1500);
    const cancelarFallback = () => clearTimeout(fallbackTimer);
    document.addEventListener("visibilitychange", cancelarFallback, { once: true });
    window.location.href = `youtube://www.youtube.com/watch?v=${videoId}`;
    return;
  }

  window.location.href = youtubeUrl;
}

// Detecta se a página está aberta dentro do navegador embutido de um app (WhatsApp, Instagram,
// Facebook, etc.) — pedido do Diego, 28/08/2026, depois de descobrir que o webinar não funciona
// direito dentro do navegador do WhatsApp: o vídeo até toca, mas a API que lê o tempo atual (usada
// pro salto de entrada, pelos depoimentos sincronizados e pelo contador simulado) fica bloqueada,
// deixando tudo "cego". Sem detecção universal 100% garantida (apps não expõem isso oficialmente),
// então combina os sinais mais confiáveis conhecidos.
function detectarNavegadorEmbutido(): { embutido: boolean; isAndroid: boolean; isIOS: boolean } {
  if (typeof navigator === "undefined") return { embutido: false, isAndroid: false, isIOS: false };
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const embutido =
    /FBAN|FBAV/i.test(ua) || // Facebook
    /Instagram/i.test(ua) ||
    /WhatsApp/i.test(ua) ||
    /Line\//i.test(ua) ||
    /MicroMessenger/i.test(ua) || // WeChat
    (isAndroid && /; wv\)/i.test(ua)); // WebView genérica no Android (assinatura comum de in-app browser)
  return { embutido, isAndroid, isIOS };
}

// No Android dá pra forçar a saída pro navegador de verdade automaticamente: reabre a MESMA URL
// atual via um "intent" do Android, que ignora o app hospedeiro e usa o navegador padrão do
// aparelho. No iOS o WhatsApp não permite esse tipo de redirecionamento programático — só resta
// orientar a pessoa a tocar em "Abrir no Safari" (ver overlay em WebinarPage).
function forcarNavegadorExterno() {
  if (typeof window === "undefined") return;
  const urlAtual = window.location.href;
  window.location.href = `intent://${urlAtual.replace(/^https?:\/\//, "")}#Intent;scheme=https;end`;
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
  const [bloqueado, setBloqueado] = useState<{ minutosAtraso: number } | null>(null);
  const [aindaNaoComecou, setAindaNaoComecou] = useState(false);
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [qtdOnline, setQtdOnline] = useState(0);
  const [videoTime, setVideoTime] = useState(0);
  const [duracaoVideo, setDuracaoVideo] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const depoimentosMostradosRef = useRef<Set<string>>(new Set());
  const liveIframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoWrapperRef = useRef<HTMLDivElement | null>(null);
  const [audioAtivo, setAudioAtivo] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const [navegadorEmbutido, setNavegadorEmbutido] = useState<{ embutido: boolean; isAndroid: boolean; isIOS: boolean }>({
    embutido: false,
    isAndroid: false,
    isIOS: false,
  });

  // Trava o body inteiro (não só o container interno) enquanto essa página está aberta —
  // reforço em cima do position:fixed do container (BUG encontrado em 28/08/2026: mesmo com o
  // container interno fixo, o Safari/Chrome no mobile ainda conseguia rolar o body por trás dele
  // quando o teclado abria no campo de comentário, sumindo o vídeo da tela). Restaura tudo ao sair.
  useEffect(() => {
    const original = {
      position: document.body.style.position,
      overflow: document.body.style.overflow,
      width: document.body.style.width,
      height: document.body.style.height,
    };
    document.body.style.position = "fixed";
    document.body.style.overflow = "hidden";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    return () => {
      document.body.style.position = original.position;
      document.body.style.overflow = original.overflow;
      document.body.style.width = original.width;
      document.body.style.height = original.height;
    };
  }, []);

  // Detecta navegador embutido (WhatsApp, Instagram, etc.) assim que a página carrega. No Android
  // tenta sair sozinho pro navegador de verdade; no iOS não dá pra forçar, então mostra instrução
  // (ver overlay bloqueante mais abaixo, antes de qualquer outro conteúdo da página).
  useEffect(() => {
    const resultado = detectarNavegadorEmbutido();
    setNavegadorEmbutido(resultado);
    if (resultado.embutido && resultado.isAndroid) {
      forcarNavegadorExterno();
    }
  }, []);

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

  // Acesso liberado (novo ou reentrada) — manda direto pro YouTube (app, quando possível) ou
  // mostra o player interno, conforme o "modo_acesso" configurado nesse webinar (19/08/2026).
  useEffect(() => {
    if (participante && webinar?.youtube_url && webinar?.modo_acesso !== "interno") {
      abrirYoutubeApp(webinar.youtube_url);
    }
  }, [participante, webinar?.youtube_url, webinar?.modo_acesso]);

  const handleEntrar = async () => {
    if (!nome.trim() || telefone.replace(/\D/g, "").length < 10) return;
    setEntrando(true);
    setBloqueado(null);
    setAindaNaoComecou(false);
    try {
      // 1) Já teve acesso liberado antes nessa aula (ex: caiu o sinal e voltou)? Reconhece pelo telefone e libera na hora, sem checar horário.
      const { data: existente } = await supabase
        .from("webinar_participantes" as any)
        .select("id, nome, telefone")
        .eq("webinar_id", id)
        .eq("telefone", telefone)
        .eq("acesso_liberado", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existente) {
        const p = existente as any as Participante;
        await supabase
          .from("webinar_participantes" as any)
          .update({ saiu_em: null, ultimo_heartbeat: new Date().toISOString() })
          .eq("id", p.id);
        // Registra essa reentrada como uma NOVA sessão no histórico (BUG encontrado em 28/08/2026:
        // reentradas resetavam saiu_em pra null, mas nunca ficava registrado no histórico que a
        // pessoa tinha voltado — só a 1ª entrada/saída aparecia pro admin).
        await supabase.from("webinar_sessoes" as any).insert({ participante_id: p.id });
        setParticipante(p);
        localStorage.setItem(`webinar_${id}_participante`, JSON.stringify(p));
        return;
      }

      // 2) Primeira tentativa dessa pessoa nessa aula — só libera se a aula já está ao vivo e dentro da tolerância de TOLERANCIA_MINUTOS
      if (webinar?.status !== "ao_vivo" || !webinar?.iniciado_em) {
        setAindaNaoComecou(true);
        return;
      }

      const minutosDesdeInicio = (Date.now() - new Date(webinar.iniciado_em).getTime()) / 60000;

      if (minutosDesdeInicio > TOLERANCIA_MINUTOS) {
        await supabase
          .from("webinar_participantes" as any)
          .insert({ webinar_id: id, nome: nome.trim(), telefone, acesso_liberado: false });
        setBloqueado({ minutosAtraso: Math.round(minutosDesdeInicio) });
        return;
      }

      const { data, error } = await supabase
        .from("webinar_participantes" as any)
        .insert({ webinar_id: id, nome: nome.trim(), telefone, acesso_liberado: true })
        .select("id, nome, telefone")
        .single();
      if (error) throw error;
      const p = data as any as Participante;
      await supabase.from("webinar_sessoes" as any).insert({ participante_id: p.id });
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
        // Sem barra de progresso/controles, sem atalhos de teclado, sem tela cheia, sem
        // sugestões de outros vídeos — o aluno só assiste, não navega dentro do vídeo (pedido
        // do Diego: impedir avançar o vídeo e esconder outras opções do YouTube).
        playerVars: {
          autoplay: 1,
          mute: 1,
          playsinline: 1,
          controls: 0,
          disablekb: 1,
          rel: 0,
          modestbranding: 1,
          fs: 0,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => {
            poll = setInterval(() => {
              const t = playerRef.current?.getCurrentTime?.();
              if (typeof t === "number") setVideoTime(t);
              const d = playerRef.current?.getDuration?.();
              if (typeof d === "number" && d > 0) setDuracaoVideo(d);
            }, 1000);

            // Simula "entrar ao vivo no minuto certo" (pedido do Diego, 26/08/2026): calcula
            // quantos segundos já se passaram desde o início real do webinar (webinar.iniciado_em,
            // a mesma referência já usada pela portaria/tolerância) e avança o vídeo pra lá — em vez
            // de sempre começar do zero, do jeito que o YouTube normalmente faz com um vídeo gravado.
            // Reforça a tentativa em 4 momentos (0s / 1s / 2,5s / 4,5s) porque o player às vezes ainda
            // está fazendo buffer/cueing no instante do onReady e ignora o primeiro seekTo — mesmo
            // padrão de reforço já usado no player do aluno (use-video-progress.ts, playVideoAt).
            // IMPORTANTE (BUG encontrado em 28/08/2026): seekTo() logo no carregamento às vezes deixa
            // o player PAUSADO depois do salto — como os controles ficam escondidos de propósito, o
            // aluno não tem nenhum jeito de retomar o play manualmente e o vídeo trava parado pra
            // sempre (nem depoimentos nem contador avançam, já que dependem do tempo real do vídeo).
            // Por isso, playVideo() é chamado explicitamente logo depois de cada seekTo.
            if (webinar?.iniciado_em) {
              const segundosDesdeInicio = Math.max(
                0,
                (Date.now() - new Date(webinar.iniciado_em).getTime()) / 1000,
              );
              const tentarSeek = () => {
                const duracao = playerRef.current?.getDuration?.() || 0;
                const alvo = duracao > 0 ? Math.min(segundosDesdeInicio, Math.max(0, duracao - 5)) : segundosDesdeInicio;
                if (alvo > 1) {
                  playerRef.current?.seekTo?.(alvo, true);
                  playerRef.current?.playVideo?.();
                }
              };
              tentarSeek();
              setTimeout(tentarSeek, 1000);
              setTimeout(tentarSeek, 2500);
              setTimeout(tentarSeek, 4500);
            } else {
              // Sem iniciado_em (não deveria acontecer, mas por garantia): assegura que o vídeo
              // está tocando mesmo sem precisar pular pra nenhum ponto específico.
              playerRef.current?.playVideo?.();
            }
          },
          // Reforço extra: se o player pausar sozinho em algum momento (ex: efeito colateral de
          // buffering após um seek), retoma o play automaticamente — o aluno nunca deve conseguir
          // ver o vídeo parado, já que não existe botão de play visível pra ele mesmo.
          onStateChange: (event: any) => {
            if (event?.data === (window as any).YT?.PlayerState?.PAUSED) {
              playerRef.current?.playVideo?.();
            }
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

  // Navegador embutido no iOS (WhatsApp, Instagram, etc.) — não dá pra forçar a saída
  // automaticamente como no Android, então bloqueia com instrução clara antes de mostrar
  // qualquer conteúdo (o player não funciona direito ali dentro).
  if (navegadorEmbutido.embutido && navegadorEmbutido.isIOS) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6 py-8">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#2D6ADF]/10 flex items-center justify-center">
            <School className="h-8 w-8 text-[#2D6ADF]" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Abra no navegador pra continuar</h1>
          <p className="text-gray-600 text-sm">
            Pra assistir a aula direito, você precisa abrir esse link no <strong>Safari</strong>, não
            aqui dentro do WhatsApp.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 text-sm text-gray-700">
            <p><strong>1.</strong> Toque nos <strong>•••</strong> (três pontinhos) no canto superior direito da tela</p>
            <p><strong>2.</strong> Toque em <strong>"Abrir no Safari"</strong></p>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href).catch(() => {});
            }}
          >
            Copiar link
          </Button>
        </div>
      </div>
    );
  }

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

  // Tela de bloqueio — passou da tolerância (TOLERANCIA_MINUTOS) na primeira tentativa
  if (bloqueado) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 space-y-3 text-center">
            <Clock className="h-10 w-10 text-orange-500 mx-auto" />
            <h1 className="text-xl font-bold">Infelizmente não dá mais pra entrar agora</h1>
            <p className="text-muted-foreground text-sm">
              A aula já começou há {bloqueado.minutosAtraso} minutos e o acesso pra quem chega depois desse tempo
              fica bloqueado, pra você não perder a parte mais importante da explicação.
            </p>
            <p className="text-muted-foreground text-sm flex items-center justify-center gap-1.5">
              <PhoneCall className="h-4 w-4" /> Nossa equipe vai entrar em contato com você em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de espera — aula ainda não foi iniciada pelo admin
  if (aindaNaoComecou) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 space-y-3 text-center">
            <Loader2 className="h-8 w-8 text-orange-500 mx-auto animate-spin" />
            <h1 className="text-xl font-bold">A aula ainda não começou</h1>
            <p className="text-muted-foreground text-sm">
              Assim que ela iniciar, clique em "Tentar entrar" de novo aqui embaixo.
            </p>
            <Button variant="outline" onClick={() => setAindaNaoComecou(false)}>Tentar entrar</Button>
          </CardContent>
        </Card>
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

  // Acesso liberado — redireciona direto pro YouTube (ver useEffect acima) quando modo_acesso
  // for "youtube". Essa tela só aparece no instante entre a liberação e o redirect acontecer.
  // Quando modo_acesso for "interno", cai direto pro player interno mais abaixo.
  if (participante && webinar?.modo_acesso !== "interno") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 space-y-3 text-center">
            <Loader2 className="h-8 w-8 text-orange-500 mx-auto animate-spin" />
            <h1 className="text-xl font-bold">Acesso liberado!</h1>
            <p className="text-muted-foreground text-sm">Te levando pra aula ao vivo no YouTube...</p>
            {webinar?.youtube_url && (
              <a
                href={webinar.youtube_url}
                onClick={(e) => { e.preventDefault(); abrirYoutubeApp(webinar.youtube_url); }}
                className="text-orange-600 text-sm underline"
              >
                Não foi redirecionado? Clique aqui
              </a>
            )}
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

  const ativarAudio = () => {
    try {
      if (webinar?.gravado) {
        playerRef.current?.unMute?.();
        playerRef.current?.setVolume?.(100);
      } else {
        liveIframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "unMute", args: [] }),
          "*"
        );
        liveIframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "setVolume", args: [100] }),
          "*"
        );
      }
      setAudioAtivo(true);
    } catch (e) {
      console.error("Erro ao ativar áudio:", e);
    }
  };

  // Maximizar/girar o vídeo pra paisagem no mobile (pedido do Diego, 28/08/2026). A API nativa
  // de Fullscreen do navegador (requestFullscreen) não funciona de forma confiável no Safari do
  // iPhone (testado, não funcionou) — então em vez de depender dela, cria uma "tela cheia" própria
  // dentro da página (position:fixed cobrindo tudo), que funciona igual em qualquer navegador.
  const maximizarVideo = () => {
    setTelaCheia(true);
    try {
      (screen.orientation as any)?.lock?.("landscape").catch(() => {});
    } catch {
      // navegador não suporta travar orientação por código (comum no iOS) — sem problema,
      // a pessoa gira o celular manualmente com o vídeo já em tela cheia.
    }
  };

  const sairTelaCheia = () => {
    setTelaCheia(false);
    try {
      (screen.orientation as any)?.unlock?.();
    } catch {
      // sem problema se não suportar
    }
  };

  return (
    <div className="fixed inset-0 h-dvh bg-gray-50 text-gray-900 flex flex-col lg:flex-row overflow-hidden">
      <div className="flex flex-col flex-none min-h-0 lg:flex-1">
        <div className="flex items-center justify-between px-4 py-2 bg-[#1E3A5F] shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-[#2D6ADF]/10 p-1.5 rounded-lg shrink-0">
              <School className="h-5 w-5 text-[#2D6ADF]" />
            </div>
            <span className="text-base sm:text-lg font-bold truncate text-white">
              Soluções <span className="text-[#2D6ADF]">Online</span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
              </span>
              <span className="text-xs font-bold text-white tracking-wide">AO VIVO</span>
            </div>
            <div className="flex items-center gap-1 text-sm bg-red-600 text-white px-2 py-1 rounded-full">
              <Users className="h-4 w-4" />
              {webinar.gravado ? getEspectadoresSimulados(videoTime, duracaoVideo) : qtdOnline}
            </div>
          </div>
        </div>
        <div className="text-xs text-center bg-gray-100 text-gray-500 py-1 shrink-0">
          🔇 O vídeo inicia sem som (regra dos navegadores) — toque no botão "Ativar áudio" no vídeo
        </div>
        <div
          ref={videoWrapperRef}
          className={
            telaCheia
              ? "fixed inset-0 z-[100] bg-black flex items-center justify-center"
              : "aspect-video w-full bg-black shrink-0 relative"
          }
        >
          {youtubeId ? (
            webinar.gravado ? (
              <div id={`yt-player-${id}`} className={telaCheia ? "w-full h-full" : "w-full h-full"} />
            ) : (
              <iframe
                ref={liveIframeRef}
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&playsinline=1&controls=0&disablekb=1&rel=0&modestbranding=1&fs=0&iv_load_policy=3&enablejsapi=1&origin=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`}
                title={webinar.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              Vídeo não configurado
            </div>
          )}
          <button
            onClick={telaCheia ? sairTelaCheia : maximizarVideo}
            className="absolute top-3 right-3 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white p-2 rounded-full shadow-lg z-10"
            title="Girar / Tela cheia"
          >
            {telaCheia ? <X className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
        {youtubeId && !audioAtivo && (
          <button
            onClick={ativarAudio}
            className="flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium py-2.5 shrink-0"
          >
            🔇 Ativar áudio
          </button>
        )}
      </div>

      <div className="w-full lg:w-80 flex flex-col bg-white border-t lg:border-t-0 lg:border-l border-gray-200 flex-1 min-h-0 lg:flex-none">
        <div ref={chatRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {comentarios.map((c) => {
            const ehMinhaMensagem = !c.replay && !c.is_admin && participante?.id && c.participante_id === participante.id;
            // Depoimentos roteirizados com o nome "Escola Soluções Online" (já vêm assim na
            // planilha) também ficam em laranja pra se destacar dos demais — pedido do Diego,
            // 29/08/2026. Diferente do is_admin (resposta real ao vivo, que fica verde ✅), esses
            // já são parte do roteiro original importado.
            const ehEscolaRoteiro = c.replay && c.nome === "Escola Soluções Online";
            const original = c.resposta_a ? comentarios.find((o) => o.id === c.resposta_a) : null;
            return (
            <div key={c.id} className="text-sm">
              {c.is_admin && original && (
                <div className="border-l-2 border-green-300 bg-green-50 pl-2 py-1 mb-1 text-xs text-gray-600">
                  <span className="font-semibold">{original.nome}:</span> {original.texto}
                </div>
              )}
              <span
                className={`font-bold ${
                  c.is_admin
                    ? "text-green-600"
                    : ehMinhaMensagem || ehEscolaRoteiro
                    ? "text-orange-600"
                    : "text-[#2D6ADF]"
                }`}
              >
                {c.is_admin ? "✅ Escola Soluções Online" : c.nome}{c.replay ? " 🎥" : ""}:{" "}
              </span>
              <span className="text-gray-800">{c.texto}</span>
            </div>
            );
          })}
        </div>
        <div className="p-2 border-t border-gray-200 space-y-2 shrink-0">
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
              className="bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400"
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
