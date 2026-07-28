import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export const Route = createFileRoute("/api/public/hooks/redefinir-senha-aluno")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let payload: { email?: string; senha?: string };
        try {
          payload = await request.json();
        } catch {
          return jsonResponse({ error: "JSON inválido" }, 400);
        }

        const { email, senha } = payload;
        if (!email || !senha) {
          return jsonResponse({ error: "email e senha são obrigatórios" }, 400);
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://qhvsveedougwymxjhbgi.supabase.co";
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
          console.error("[redefinir-senha-aluno] SUPABASE_SERVICE_ROLE_KEY não configurada");
          return jsonResponse({ error: "Service role key não configurada no servidor" }, 500);
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        try {
          // Encontra o usuário pelo e-mail (Admin API não tem "get by email" direto)
          let userId: string | null = null;
          let page = 1;
          while (!userId) {
            const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
            if (error) throw error;
            const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
            if (found) { userId = found.id; break; }
            if (data.users.length < 200) break; // acabaram as páginas
            page++;
          }

          if (!userId) {
            return jsonResponse({ error: "Usuário não encontrado para esse e-mail" }, 404);
          }

          const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password: senha });
          if (updateError) {
            console.error("[redefinir-senha-aluno] Erro ao atualizar senha:", updateError);
            return jsonResponse({ error: updateError.message }, 500);
          }

          return jsonResponse({ ok: true });
        } catch (e: any) {
          console.error("[redefinir-senha-aluno] Erro geral:", e);
          return jsonResponse({ error: e?.message || String(e) }, 500);
        }
      },
    },
  },
});
