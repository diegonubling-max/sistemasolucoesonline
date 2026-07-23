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

function normalizarNome(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase() || "aluno";
}

function gerarSenha(nome: string) {
  return `1234${normalizarNome(nome)}`;
}

function formatPhone(telefone: string) {
  const numero = (telefone || "").replace(/\D/g, "");
  if (!numero) return "";
  return numero.startsWith("55") ? numero : "55" + numero;
}

async function enviarWhatsappCredenciais(telefone: string, nome: string, ctr: number, senha: string) {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instanceId || !token || !clientToken) {
    console.warn("[converter-matricula-aulao] Z-API não configurada, pulando envio de WhatsApp");
    return { sent: false, reason: "zapi_not_configured" };
  }

  const phone = formatPhone(telefone);
  if (!phone) return { sent: false, reason: "invalid_phone" };

  const primeiroNome = nome.trim().split(/\s+/)[0];
  const message =
    `Olá, ${primeiroNome}! 🎉\n\n` +
    `Seu pagamento foi confirmado e seu acesso à Escola Soluções Online já está liberado!\n\n` +
    `📚 *Login:* ${ctr}\n` +
    `🔑 *Senha:* ${senha}\n\n` +
    `Acesse: https://sistema.supletivosolucoesonline.com.br\n\n` +
    `Bons estudos! 💙`;

  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Client-Token": clientToken },
        body: JSON.stringify({ phone, message }),
      },
    );
    return { sent: res.ok, status: res.status };
  } catch (e: any) {
    console.error("[converter-matricula-aulao] Erro ao enviar WhatsApp:", e);
    return { sent: false, reason: e?.message || String(e) };
  }
}

const EJA_SEGMENTO_ID = "85acf7ef-ff16-421a-abdf-4c0a368d6ada";
const POLO_ID_FLORIPA = "32671c78-9076-4f88-8161-bfd5ee8e866b";

export const Route = createFileRoute("/api/public/hooks/converter-matricula-aulao")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let payload: { matricula_aulao_id?: string };
        try {
          payload = await request.json();
        } catch {
          return jsonResponse({ error: "JSON inválido" }, 400);
        }

        const matriculaAulaoId = payload?.matricula_aulao_id;
        if (!matriculaAulaoId) {
          return jsonResponse({ error: "matricula_aulao_id obrigatório" }, 400);
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://qhvsveedougwymxjhbgi.supabase.co";
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
          console.error("[converter-matricula-aulao] SUPABASE_SERVICE_ROLE_KEY não configurada");
          return jsonResponse({ error: "Service role key não configurada no servidor" }, 500);
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        try {
          const { data: matricula, error: matriculaError } = await supabase
            .from("matriculas_aulao")
            .select("*")
            .eq("id", matriculaAulaoId)
            .single();

          if (matriculaError || !matricula) {
            return jsonResponse({ error: "Matrícula não encontrada" }, 404);
          }

          // Idempotência: já convertido antes
          if (matricula.aluno_id) {
            const { data: alunoExistente } = await supabase
              .from("alunos")
              .select("ctr, nome")
              .eq("id", matricula.aluno_id)
              .single();

            const senha = alunoExistente ? gerarSenha(alunoExistente.nome) : null;
            return jsonResponse({
              ok: true,
              already: true,
              ctr: alunoExistente?.ctr,
              senha,
            });
          }

          if (matricula.pagamento_status !== "confirmado") {
            return jsonResponse({ error: "Pagamento ainda não confirmado" }, 400);
          }

          // 1. Próximo CTR disponível
          const { data: ultimoAluno } = await supabase
            .from("alunos")
            .select("ctr")
            .order("ctr", { ascending: false })
            .limit(1)
            .maybeSingle();
          const novoCtr = (ultimoAluno?.ctr ?? 1700) + 1;
          const email = `${novoCtr}@aluno.com`;
          const senha = gerarSenha(matricula.nome);

          // 2. Criar registro do aluno
          const { data: novoAluno, error: alunoError } = await supabase
            .from("alunos")
            .insert({
              nome: matricula.nome,
              email,
              telefone: matricula.telefone,
              cpf: matricula.cpf,
              data_nascimento: matricula.data_nascimento,
              ctr: novoCtr,
              origem: "Lançamento",
              ativo: true,
              cadastro_completo: true,
            })
            .select("id, ctr")
            .single();

          if (alunoError || !novoAluno) {
            console.error("[converter-matricula-aulao] Erro ao criar aluno:", alunoError);
            return jsonResponse({ error: alunoError?.message || "Erro ao criar aluno" }, 500);
          }

          // 3. Criar acesso via Admin API (NUNCA via SQL direto em auth.users)
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: senha,
            email_confirm: true,
          });

          if (authError || !authUser?.user) {
            console.error("[converter-matricula-aulao] Erro ao criar acesso:", authError);
            return jsonResponse({ error: authError?.message || "Erro ao criar acesso" }, 500);
          }

          await supabase.from("user_roles").insert({ user_id: authUser.user.id, role: "aluno" }).select();

          // 4. Criar matrícula
          const { data: novaMatricula, error: matriculaNovaError } = await supabase
            .from("matriculas")
            .insert({
              aluno_id: novoAluno.id,
              polo_id: matricula.polo_id || POLO_ID_FLORIPA,
              status: "ativa",
              contrato_assinado: true,
              contrato_data: matricula.assinado_em,
              contrato_assinatura: matricula.assinatura_nome,
            })
            .select("id")
            .single();

          if (matriculaNovaError || !novaMatricula) {
            console.error("[converter-matricula-aulao] Erro ao criar matrícula:", matriculaNovaError);
            return jsonResponse({ error: matriculaNovaError?.message || "Erro ao criar matrícula" }, 500);
          }

          // 5. Liberar acesso aos cursos EJA (a Prova Final é vinculada automaticamente por trigger)
          const { data: cursosEja } = await supabase
            .from("cursos")
            .select("id")
            .eq("segmento_id", EJA_SEGMENTO_ID)
            .eq("is_prova_final", false);

          if (cursosEja && cursosEja.length > 0) {
            await supabase.from("matricula_cursos").insert(
              cursosEja.map((c: any) => ({
                matricula_id: novaMatricula.id,
                curso_id: c.id,
                liberado: true,
              })),
            );
          }

          // 6. Registrar o termo assinado no histórico de contratos do aluno
          if (matricula.contrato_html) {
            await supabase.from("contratos").insert({
              nome: "Termo de Matrícula (Aulão)",
              conteudo: matricula.contrato_html,
              ativo: true,
              aluno_id: novoAluno.id,
              status: "assinado",
            });
          }

          // 7. Vincular a matrícula do aulão ao aluno criado (idempotência)
          await supabase
            .from("matriculas_aulao")
            .update({ aluno_id: novoAluno.id })
            .eq("id", matriculaAulaoId);

          // 8. Enviar credenciais por WhatsApp
          const whatsapp = await enviarWhatsappCredenciais(matricula.telefone, matricula.nome, novoCtr, senha);

          return jsonResponse({
            ok: true,
            already: false,
            ctr: novoCtr,
            senha,
            whatsapp,
          });
        } catch (e: any) {
          console.error("[converter-matricula-aulao] Erro geral:", e);
          return jsonResponse({ error: e?.message || String(e) }, 500);
        }
      },
    },
  },
});
