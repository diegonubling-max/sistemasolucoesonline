import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  creditarAulaAssistida,
  checarBonus3AulasNoDia,
  checarCursoCompleto,
} from "@/lib/milhas-eja";

type Provider = "youtube" | "vimeo" | "pandavideo" | "unknown";

export function detectProvider(url: string): Provider {
  if (!url) return "unknown";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("vimeo.com")) return "vimeo";
  if (url.includes("pandavideo.com.br")) return "pandavideo";
  return "unknown";
}

export function formatSeconds(s: number): string {
  const sec = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

interface UseVideoProgressOpts {
  alunoId: string | null;
  aulaId: string | null;
  cursoId: string;
  url: string;
  initialPosition?: number;
  onCompleted?: () => void;
}

interface ProgressState {
  currentTime: number;
  duration: number;
}

/**
 * Tracks video progress via postMessage. Supports YouTube IFrame API,
 * Vimeo Player API and Pandavideo (`panda_timeupdate`).
 * Persists every 10s. Auto-marks aula as concluída quando >=90%.
 */
export function useVideoProgress({
  alunoId,
  aulaId,
  cursoId,
  url,
  initialPosition = 0,
  onCompleted,
}: UseVideoProgressOpts) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [state, setState] = useState<ProgressState>({ currentTime: 0, duration: 0 });
  const lastSaveRef = useRef<number>(0);
  const completedRef = useRef<boolean>(false);
  const provider = detectProvider(url);
  const seekedRef = useRef<boolean>(false);

  const persist = useCallback(
    async (currentTime: number, duration: number) => {
      if (!alunoId || !aulaId || !cursoId) return;
      const dur = Math.floor(duration);
      // Nunca salvar com duracao_total = 0
      if (dur <= 0) return;

      // tempo_assistido = currentTime do player (não acumulado), limitado à duração
      let ct = Math.floor(currentTime);
      if (ct > dur) ct = dur;
      if (ct < 0) ct = 0;
      const pct = ct >= dur ? 100 : +(ct / dur * 100).toFixed(2);

      await supabase
        .from("aluno_aulas_assistidas")
        .upsert(
          {
            aluno_id: alunoId,
            aula_id: aulaId,
            curso_id: cursoId,
            duracao_total: dur,
            tempo_assistido: ct,
            ultima_posicao: ct,
            percentual_assistido: pct,
          },
          { onConflict: "aluno_id,aula_id" },
        );

      // Milhas EJA + marcar concluída ao atingir 70%
      if (pct >= 70 && alunoId && aulaId && cursoId) {
        const creditou = await creditarAulaAssistida(alunoId, aulaId);
        if (creditou) {
          void checarBonus3AulasNoDia(alunoId);
          void checarCursoCompleto(alunoId, cursoId);
        }
      }

      if (pct >= 70 && !completedRef.current) {
        completedRef.current = true;
        onCompleted?.();
      }
    },
    [alunoId, aulaId, cursoId, onCompleted],
  );

  const handleTick = useCallback(
    (currentTime: number, duration: number) => {
      setState({ currentTime, duration });
      const now = Date.now();
      if (now - lastSaveRef.current >= 10_000) {
        lastSaveRef.current = now;
        void persist(currentTime, duration);
      }
      // Seek to initial position once duration is known
      if (!seekedRef.current && duration > 0 && initialPosition > 0 && initialPosition < duration - 5) {
        seekedRef.current = true;
        seekTo(initialPosition);
      }
    },
    [persist, initialPosition],
  );

  const post = useCallback((payload: any) => {
    iframeRef.current?.contentWindow?.postMessage(
      typeof payload === "string" ? payload : JSON.stringify(payload),
      "*",
    );
  }, []);

  const seekTo = useCallback(
    (seconds: number) => {
      if (provider === "youtube") {
        post({ event: "command", func: "seekTo", args: [seconds, true] });
      } else if (provider === "vimeo") {
        post({ method: "setCurrentTime", value: seconds });
      } else if (provider === "pandavideo") {
        post({ action: "panda_seek", time: seconds });
      }
    },
    [provider, post],
  );

  // Reset state when aula changes
  useEffect(() => {
    seekedRef.current = false;
    completedRef.current = false;
    lastSaveRef.current = 0;
    setState({ currentTime: 0, duration: 0 });
  }, [aulaId]);

  // Listener
  useEffect(() => {
    if (provider === "unknown") return;

    const onMessage = (e: MessageEvent) => {
      let data: any = e.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (!data || typeof data !== "object") return;

      // YouTube IFrame API: {event:"infoDelivery", info:{currentTime, duration}}
      if (provider === "youtube" && data.event === "infoDelivery" && data.info) {
        const ct = Number(data.info.currentTime ?? 0);
        const dur = Number(data.info.duration ?? state.duration ?? 0);
        if (!isNaN(ct) && dur > 0) handleTick(ct, dur);
        return;
      }

      // Vimeo: {event:"playProgress", data:{seconds,duration}}
      if (provider === "vimeo" && (data.event === "playProgress" || data.event === "timeupdate")) {
        const ct = Number(data.data?.seconds ?? 0);
        const dur = Number(data.data?.duration ?? 0);
        if (dur > 0) handleTick(ct, dur);
        return;
      }

      // Pandavideo
      if (provider === "pandavideo" && (data.message === "panda_timeupdate" || data.event === "panda_timeupdate")) {
        const ct = Number(data.currentTime ?? 0);
        const dur = Number(data.duration ?? 0);
        if (dur > 0) handleTick(ct, dur);
        return;
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [provider, handleTick, state.duration]);

  // Initialize YouTube IFrame API listening
  useEffect(() => {
    if (provider !== "youtube") return;
    const t = setTimeout(() => {
      post({ event: "listening", id: 1, channel: "widget" });
      post({ event: "command", func: "addEventListener", args: ["onStateChange"] });
    }, 800);
    return () => clearTimeout(t);
  }, [provider, aulaId, post]);

  // Initialize Vimeo listeners
  useEffect(() => {
    if (provider !== "vimeo") return;
    const t = setTimeout(() => {
      post({ method: "addEventListener", value: "playProgress" });
    }, 800);
    return () => clearTimeout(t);
  }, [provider, aulaId, post]);

  // Persist on unmount / aula change
  useEffect(() => {
    return () => {
      if (state.duration > 0 && state.currentTime > 0) {
        void persist(state.currentTime, state.duration);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aulaId]);

  return {
    iframeRef,
    currentTime: state.currentTime,
    duration: state.duration,
    percent: state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0,
  };
}
