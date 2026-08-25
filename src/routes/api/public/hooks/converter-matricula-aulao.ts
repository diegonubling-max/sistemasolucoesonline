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
// Vendedor padrão pras matrículas do Aulão (checkout público não tem seleção de vendedora/colaborador) — BUG-040
const COLABORADOR_ID_ADMIN = "18fb028e-607a-44dc-a4e0-eca1caf6e0b8";

export const Route = createFileRoute("/api/public/hooks/converter-matricula-aulao")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let payload: { matricula_aulao_id?: string; force?: boolean; cadastrado_por?: string; cadastrado_por_id?: string };
        try {
          payload = await request.json();
        } catch {
          return jsonResponse({ error: "JSON inválido" }, 400);
        }

        const matriculaAulaoId = payload?.matricula_aulao_id;
        if (!matriculaAulaoId) {
          return jsonResponse({ error: "matricula_aulao_id obrigatório" }, 400);
        }

        // Quando gerado manualmente pelo botão "Gerar acesso (Aulão)" no admin, quem clicou vem
        // no payload (nome já resolvido no cliente). Quando gerado automaticamente (webhook de
        // pagamento confirmado no Asaas, sem ninguém logado envolvido), fica null — o aluno fez
        // a própria matrícula sozinho, sem intervenção de um colaborador.
        const cadastradoPorNome = payload?.cadastrado_por || null;
        const cadastradoPorId = payload?.cadastrado_por_id || null;

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

          if (matricula.pagamento_status !== "confirmado" && !payload.force) {
            return jsonResponse({ error: "Pagamento ainda não confirmado" }, 400);
          }

          // 1. Próximo CTR disponível — pega da MESMA fonte usada pelo cadastro manual
          // (função proximo_ctr_aluno(), que puxa da sequence alunos_ctr_seq), pra nunca mais
          // ficar fora de sincronia entre os dois fluxos (isso já causou CTR duplicado de
          // verdade entre dois alunos — BUG-049, 12/08/2026). Se o e-mail já existir no Auth
          // (login órfão de um aluno antigo excluído da tabela alunos, mas cujo acesso nunca
          // foi removido do Supabase Auth), pula pro próximo CTR da sequence e tenta de novo.
          const { data: primeiroCtr, error: ctrError } = await supabase.rpc("proximo_ctr_aluno");
          if (ctrError || !primeiroCtr) {
            console.error("[converter-matricula-aulao] Erro ao gerar CTR:", ctrError);
            return jsonResponse({ error: "Erro ao gerar CTR para o aluno" }, 500);
          }

          let novoCtr = primeiroCtr as number;
          const senha = gerarSenha(matricula.nome);
          let email = `${novoCtr}@aluno.com`;
          let authUser: any = null;
          let authError: any = null;

          for (let tentativas = 0; tentativas < 50; tentativas++) {
            email = `${novoCtr}@aluno.com`;
            const resultado = await supabase.auth.admin.createUser({
              email,
              password: senha,
              email_confirm: true,
            });
            authUser = resultado.data;
            authError = resultado.error;

            const jaRegistrado = authError?.message?.toLowerCase().includes("already been registered");
            if (!authError || !jaRegistrado) break;

            console.warn(`[converter-matricula-aulao] E-mail ${email} já registrado no Auth (login órfão?) — tentando próximo CTR da sequence`);
            const { data: proximoCtr } = await supabase.rpc("proximo_ctr_aluno");
            novoCtr = (proximoCtr as number) ?? novoCtr + 1;
          }

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
              origem: "Aulão",
              ativo: true,
              cadastro_completo: true,
              polo_id: matricula.polo_id || POLO_ID_FLORIPA,
              cadastrado_por: cadastradoPorNome,
              cadastrado_por_id: cadastradoPorId,
            })
            .select("id, ctr")
            .single();

          if (alunoError || !novoAluno) {
            console.error("[converter-matricula-aulao] Erro ao criar aluno:", alunoError);
            return jsonResponse({ error: alunoError?.message || "Erro ao criar aluno" }, 500);
          }

          // 3. Acesso via Admin API já criado no loop acima (NUNCA via SQL direto em auth.users)
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
              colaborador_id: COLABORADOR_ID_ADMIN,
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

          // 4.1 Registrar a(s) parcela(s) do pagamento já confirmado (BUG-063, 24/08/2026 + ajuste
          // de 25/08/2026 quando o PIX de entrada do boleto passou a cobrar taxa + 1ª parcela juntos).
          // Sem isso a matrícula fica sem NENHUM registro em `parcelas`, mesmo com o pagamento já
          // confirmado no Asaas (a informação de pagamento só existia em `matriculas_aulao`).
          // - view_taxas_recebidas_mes soma tipo='taxa_matricula' em "Taxas de Matrícula no Mês";
          // - view_total_recebido_mes EXCLUI tipo='taxa_matricula' de "Recebido de Parcelas no Mês"
          //   (senão contaria duas vezes como faturamento normal);
          // - a lista de Alunos só desliga o alerta "Financeiro não cadastrado" (💲) quando existe
          //   parcela com tipo diferente de 'taxa_matricula'.
          // No boleto, o PIX de entrada (R$229,80) cobra a taxa (R$69,90) + a 1ª parcela (R$159,90)
          // juntos numa cobrança só — por isso, aqui, são gravadas DUAS parcelas separadas (uma
          // taxa_matricula + uma parcela nº1 de verdade), em vez de jogar o valor inteiro como taxa
          // (isso inflaria "Taxas de Matrícula no Mês" e não contaria a 1ª parcela como recebida).
          // No cartão (cobrança única do curso inteiro), continua uma única parcela taxa_matricula,
          // como antes.
          const TAXA_MATRICULA = 69.9;
          const formaPagamentoConfirmada = (matricula.forma_pagamento || matricula.pagamento_forma_manual || "boleto").toLowerCase();
          const dataPagamentoParcela = (matricula.pagamento_confirmado_em || matricula.created_at || new Date().toISOString()).slice(0, 10);
          const valorTotalPago = Number(matricula.pagamento_valor ?? TAXA_MATRICULA);

          const parcelasParaInserir: any[] = [];
          if (formaPagamentoConfirmada === "boleto" && valorTotalPago > TAXA_MATRICULA) {
            const valorPrimeiraParcela = Math.round((valorTotalPago - TAXA_MATRICULA) * 100) / 100;
            parcelasParaInserir.push({
              matricula_id: novaMatricula.id,
              polo_id: matricula.polo_id || POLO_ID_FLORIPA,
              numero: 0,
              tipo: "taxa_matricula",
              descricao: "Taxa de Matrícula (Aulão)",
              valor: TAXA_MATRICULA,
              status: "pago",
              forma_pagamento: formaPagamentoConfirmada,
              data_vencimento: dataPagamentoParcela,
              data_pagamento: dataPagamentoParcela,
              asaas_id: matricula.asaas_payment_id || null,
            });
            parcelasParaInserir.push({
              matricula_id: novaMatricula.id,
              polo_id: matricula.polo_id || POLO_ID_FLORIPA,
              numero: 1,
              tipo: "parcela",
              descricao: "Parcela 1/10 (Aulão)",
              valor: valorPrimeiraParcela,
              status: "pago",
              forma_pagamento: formaPagamentoConfirmada,
              data_vencimento: dataPagamentoParcela,
              data_pagamento: dataPagamentoParcela,
              asaas_id: matricula.asaas_payment_id || null,
            });

            // Pré-gera a parcela nº2 (próxima do plano 1+9), já em aberto, vencendo 30 dias
            // depois do pagamento da nº1 — só ela, sem dar baixa (a pedido do Diego, 25/08/2026).
            const vencimentoParcela2 = new Date(`${dataPagamentoParcela}T00:00:00`);
            vencimentoParcela2.setDate(vencimentoParcela2.getDate() + 30);
            parcelasParaInserir.push({
              matricula_id: novaMatricula.id,
              polo_id: matricula.polo_id || POLO_ID_FLORIPA,
              numero: 2,
              tipo: "parcela",
              descricao: "Parcela 2/10 (Aulão)",
              valor: valorPrimeiraParcela,
              status: "aberto",
              forma_pagamento: formaPagamentoConfirmada,
              data_vencimento: vencimentoParcela2.toISOString().slice(0, 10),
            });
          } else {
            parcelasParaInserir.push({
              matricula_id: novaMatricula.id,
              polo_id: matricula.polo_id || POLO_ID_FLORIPA,
              numero: 0,
              tipo: "taxa_matricula",
              descricao: "Taxa de Matrícula (Aulão)",
              valor: valorTotalPago,
              status: "pago",
              forma_pagamento: formaPagamentoConfirmada,
              data_vencimento: dataPagamentoParcela,
              data_pagamento: dataPagamentoParcela,
              asaas_id: matricula.asaas_payment_id || null,
            });
          }

          const { error: parcelaError } = await supabase.from("parcelas").insert(parcelasParaInserir);
          if (parcelaError) {
            // Não bloqueia o fluxo (aluno já pagou e precisa do acesso liberado), só loga pra
            // investigação depois — igual ao padrão adotado nos webhooks do Asaas (BUG-059).
            console.error("[converter-matricula-aulao] Erro ao registrar parcela da taxa de matrícula:", parcelaError);
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
