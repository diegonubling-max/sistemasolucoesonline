import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { getMessagingSafe, VAPID_KEY } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function usePushNotifications(enabled: boolean, userId: string | undefined) {
  useEffect(() => {
    if (!enabled || !userId) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    let unsub: (() => void) | undefined;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        const messaging = getMessagingSafe();
        if (!messaging) return;

        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
        if (Notification.permission !== "granted") return;

        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: reg,
        });
        if (!token) return;

        await supabase
          .from("push_tokens" as any)
          .upsert({ user_id: userId, token }, { onConflict: "token" });

        const off = onMessage(messaging, (payload) => {
          const title = payload?.notification?.title || (payload.data as any)?.title;
          const body = payload?.notification?.body || (payload.data as any)?.body;
          if (title) toast(title, { description: body });
        });
        unsub = off;
      } catch (e) {
        console.error("Push notifications setup error:", e);
      }
    })();

    return () => {
      if (unsub) unsub();
    };
  }, [enabled, userId]);
}
