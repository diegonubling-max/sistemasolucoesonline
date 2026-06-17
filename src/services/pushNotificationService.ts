import { supabase } from "@/integrations/supabase/client";

export async function sendPushNotification(title: string, body: string) {
  try {
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token");

    if (!tokens || tokens.length === 0) return;

    for (const { token } of tokens) {
      await supabase.functions.invoke("send-push-notification", {
        body: { token, title, body },
      });
    }
  } catch (error) {
    console.error("Erro ao enviar push:", error);
  }
}
