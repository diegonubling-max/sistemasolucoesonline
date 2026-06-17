import { supabase } from "@/integrations/supabase/client";

export async function sendPushNotification(title: string, body: string) {
  try {
    await supabase.functions.invoke("send-push", {
      body: { title, body },
    });
  } catch (e) {
    console.error("sendPushNotification error:", e);
  }
}
