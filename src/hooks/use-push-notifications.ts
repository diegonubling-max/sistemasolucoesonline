import { useCallback, useEffect, useRef, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { getMessagingSafe, VAPID_KEY } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PushPermission = "granted" | "denied" | "default" | "unsupported";

function currentPermission(): PushPermission {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return "unsupported";
  return Notification.permission as PushPermission;
}

async function registerToken(userId: string): Promise<string | null> {
  const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const messaging = getMessagingSafe();
  if (!messaging) return null;
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: reg,
  });
  if (!token) return null;
  const { error } = await supabase
    .from("push_tokens" as any)
    .upsert({ user_id: userId, token } as any, { onConflict: "token" } as any);
  if (error) {
    console.error("push_tokens upsert error", error);
    return null;
  }
  return token;
}

function attachForegroundListener(onMsgRef: React.MutableRefObject<(() => void) | undefined>) {
  const messaging = getMessagingSafe();
  if (!messaging || onMsgRef.current) return;
  onMsgRef.current = onMessage(messaging, (payload) => {
    const title = payload?.notification?.title || (payload.data as any)?.title;
    const body = payload?.notification?.body || (payload.data as any)?.body;
    if (title) toast(title, { description: body });
  });
}

export function usePushNotifications(enabled: boolean, userId: string | undefined) {
  const [permission, setPermission] = useState<PushPermission>(() => currentPermission());
  const [isWorking, setIsWorking] = useState(false);
  const unsubRef = useRef<(() => void) | undefined>(undefined);

  // Auto-request permission + register token after login
  useEffect(() => {
    if (!enabled || !userId) return;
    let perm = currentPermission();
    setPermission(perm);
    if (perm === "unsupported") {
      console.log("Iniciando registro de notificação...");
      console.log("Navegador não suporta notificações.");
      return;
    }
    (async () => {
      try {
        console.log("Iniciando registro de notificação...");
        console.log("Permissão atual: " + Notification.permission);
        if (Notification.permission === "default") {
          const result = await Notification.requestPermission();
          console.log("Permissão atual: " + result);
          perm = result as PushPermission;
          setPermission(perm);
        }
        if (Notification.permission !== "granted") return;
        const token = await registerToken(userId);
        console.log("Token obtido: " + token);
        if (token) {
          console.log("Token salvo com sucesso");
          attachForegroundListener(unsubRef);
        }
      } catch (e) {
        console.error("Push auto-register error:", e);
      }
    })();
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = undefined;
      }
    };
  }, [enabled, userId]);

  const requestAndRegister = useCallback(async (): Promise<PushPermission> => {
    if (!userId) return "unsupported";
    const supported = currentPermission();
    if (supported === "unsupported") {
      toast.error("Este navegador não suporta notificações.");
      return "unsupported";
    }
    setIsWorking(true);
    try {
      let perm = Notification.permission as PushPermission;
      if (perm === "default") {
        perm = (await Notification.requestPermission()) as PushPermission;
      }
      setPermission(perm);
      if (perm !== "granted") {
        if (perm === "denied") {
          toast.error("Para receber notificações de matrículas e pagamentos, habilite as notificações nas configurações do seu navegador.");
        }
        return perm;
      }
      const token = await registerToken(userId);
      if (token) {
        attachForegroundListener(unsubRef);
        toast.success("Notificações ativadas com sucesso!");
      } else {
        toast.error("Não foi possível obter o token de notificação.");
      }
      return perm;
    } catch (e: any) {
      console.error("requestAndRegister error", e);
      toast.error("Erro ao ativar notificações: " + (e?.message || "desconhecido"));
      return Notification.permission as PushPermission;
    } finally {
      setIsWorking(false);
    }
  }, [userId]);

  return { permission, isWorking, requestAndRegister };
}
