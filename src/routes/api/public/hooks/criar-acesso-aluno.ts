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

          let userId: string | null = authUser?.user?.id ?? null;

          if (authError || !userId) {
            const jaExiste = /already.*registered|already been registered|email_exists/i.test(authError?.message || "");

            if (!jaExiste) {
              console.error("[criar-acesso-aluno] Erro ao criar acesso:", authError);
              return jsonResponse({ error: authError?.message || "Erro ao criar acesso" }, 500);
            }

            // BUG-048: o e-mail já tem uma conta de auth (ex: sobra de uma tentativa anterior
            // que falhou/foi abandonada, deixando um login "órfão" sem aluno correspondente).
            // Em vez de desistir e deixar o aluno sem conseguir entrar, localiza essa conta
            // pelo e-mail e atualiza a senha dela pra senha atual — corrige sozinho.
            console.warn(`[criar-acesso-aluno] E-mail ${email} já registrado — tentando reaproveitar a conta existente`);

            let page = 1;
            while (!userId) {
              const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
              if (listError) {
                console.error("[criar-acesso-aluno] Erro ao listar usuários:", listError);
                return jsonResponse({ error: authError?.message || "Erro ao criar acesso" }, 500);
              }
              const found = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
              if (found) { userId = found.id; break; }
              if (listData.users.length < 200) break;
              page++;
            }

            if (!userId) {
              return jsonResponse({ error: authError?.message || "Erro ao criar acesso" }, 500);
            }

            const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
              password: senha,
              email_confirm: true,
            });
            if (updateError) {
              console.error("[criar-acesso-aluno] Erro ao atualizar conta existente:", updateError);
              return jsonResponse({ error: updateError.message }, 500);
            }
          }

          const { data: roleExistente } = await supabase
            .from("user_roles")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

          if (!roleExistente) {
            const { error: roleError } = await supabase
              .from("user_roles")
              .insert({ user_id: userId, role: "aluno" });
            if (roleError) {
              console.error("[criar-acesso-aluno] Erro ao criar user_role:", roleError);
            }
          }

          return jsonResponse({ ok: true, user_id: userId });
        } catch (e: any) {
          console.error("[criar-acesso-aluno] Erro geral:", e);
          return jsonResponse({ error: e?.message || String(e) }, 500);
        }
      },
    },
  },
});
