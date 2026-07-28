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

export const Route = createFileRoute("/api/public/hooks/criar-acesso-aluno")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let payload: { email?: string; senha?: string; aluno_id?: string };
        try {
          payload = await request.json();
        } catch {
          return jsonResponse({ error: "JSON inválido" }, 400);
        }

        const { email, senha, aluno_id } = payload;
        if (!email || !senha || !aluno_id) {
          return jsonResponse({ error: "email, senha e aluno_id são obrigatórios" }, 400);
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://qhvsveedougwymxjhbgi.supabase.co";
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
          console.error("[criar-acesso-aluno] SUPABASE_SERVICE_ROLE_KEY não configurada");
          return jsonResponse({ error: "Service role key não configurada no servidor" }, 500);
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        try {
          // Cria o acesso via Admin API (NUNCA via SQL direto em auth.users)
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: senha,
            email_confirm: true,
          });

          if (authError || !authUser?.user) {
            console.error("[criar-acesso-aluno] Erro ao criar acesso:", authError);
            return jsonResponse({ error: authError?.message || "Erro ao criar acesso" }, 500);
          }

          const { error: roleError } = await supabase
            .from("user_roles")
            .insert({ user_id: authUser.user.id, role: "aluno" });

          if (roleError) {
            console.error("[criar-acesso-aluno] Erro ao criar user_role:", roleError);
          }

          return jsonResponse({ ok: true, user_id: authUser.user.id });
        } catch (e: any) {
          console.error("[criar-acesso-aluno] Erro geral:", e);
          return jsonResponse({ error: e?.message || String(e) }, 500);
        }
      },
    },
  },
});
