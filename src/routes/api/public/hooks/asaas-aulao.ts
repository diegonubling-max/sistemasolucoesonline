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

export const Route = createFileRoute("/api/public/hooks/asaas-aulao")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let payload: {
          matricula_id?: string;
          billing_type?: "PIX" | "CREDIT_CARD";
          installment_count?: number;
          credit_card?: {
            holderName: string;
            number: string;
            expiryMonth: string;
            expiryYear: string;
            ccv: string;
          };
          credit_card_holder_info?: {
            name: string;
            cpfCnpj: string;
            phone: string;
            postalCode?: string;
            addressNumber?: string;
          };
        };
        try {
          payload = await request.json();
        } catch {
          return jsonResponse({ error: "JSON inválido" }, 400);
        }

        const { matricula_id, billing_type } = payload;
        if (!matricula_id || !billing_type) {
          return jsonResponse({ error: "matricula_id e billing_type obrigatórios" }, 400);
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
          return jsonResponse({ error: "Supabase não configurado" }, 500);
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Buscar matrícula
        const { data: matricula, error: mErr } = await supabase
          .from("matriculas_aulao")
          .select("*")
          .eq("id", matricula_id)
          .single();
        if (mErr || !matricula) {
          return jsonResponse({ error: "Matrícula não encontrada" }, 404);
        }

        // Se já pagou, retorna os dados existentes
        if (matricula.pagamento_status === "confirmado") {
          return jsonResponse({ ok: true, already_paid: true });
        }

        // 2. Buscar chave Asaas do polo
        const poloId = matricula.polo_id;
        const { data: polo } = await supabase
          .from("polos")
          .select("asaas_api_key, asaas_ambiente")
          .eq("id", poloId)
          .single();

        const asaasApiKey = polo?.asaas_api_key || process.env.ASAAS_API_KEY;
        const asaasAmbiente = polo?.asaas_ambiente || process.env.ASAAS_AMBIENTE || "sandbox";
        if (!asaasApiKey) {
          return jsonResponse({ error: "Chave Asaas não configurada" }, 500);
        }

        const baseUrl = asaasAmbiente === "producao"
          ? "https://www.asaas.com/api/v3"
          : "https://sandbox.asaas.com/api/v3";

        const headers = {
          "Content-Type": "application/json",
          "access_token": asaasApiKey,
        };

        try {
          // 3. Criar ou buscar customer no Asaas
          let customerId = matricula.asaas_customer_id;
          if (!customerId) {
            const cpfLimpo = (matricula.cpf || "").replace(/\D/g, "");

            // Tentar buscar existente por CPF
            const busca = await fetch(`${baseUrl}/customers?cpfCnpj=${cpfLimpo}`, { headers });
            const buscaData = await busca.json();

            if (buscaData.totalCount > 0) {
              customerId = buscaData.data[0].id;
            } else {
              // Criar novo
              const criarRes = await fetch(`${baseUrl}/customers`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                  name: matricula.nome,
                  cpfCnpj: cpfLimpo,
                  phone: (matricula.telefone || "").replace(/\D/g, ""),
                  externalReference: matricula.id,
                  notificationDisabled: true,
                }),
              });
              const criarData = await criarRes.json();
              if (!criarRes.ok) {
                return jsonResponse({ error: "Erro ao criar cliente no Asaas", detail: criarData }, 502);
              }
              customerId = criarData.id;
            }

            await supabase
              .from("matriculas_aulao")
              .update({ asaas_customer_id: customerId })
              .eq("id", matricula_id);
          }

          // 4. Criar cobrança
          // TESTE: PIX = R$9,90 | Cartão = R$20,00 (produção: 69.90 / 1438.80)
          const valor = billing_type === "PIX" ? 9.90 : 20.00;
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 1);

          const paymentBody: any = {
            customer: customerId,
            billingType: billing_type,
            value: valor,
            dueDate: dueDate.toISOString().split("T")[0],
            description: billing_type === "PIX"
              ? "Taxa de Matrícula - Aulão Soluções Online"
              : "Curso Completo - Aulão Soluções Online",
            externalReference: matricula.id,
          };

          // Se for cartão, adicionar dados do cartão e parcelamento
          if (billing_type === "CREDIT_CARD" && payload.credit_card) {
            paymentBody.creditCard = {
              holderName: payload.credit_card.holderName,
              number: payload.credit_card.number,
              expiryMonth: payload.credit_card.expiryMonth,
              expiryYear: payload.credit_card.expiryYear,
              ccv: payload.credit_card.ccv,
            };
            paymentBody.creditCardHolderInfo = payload.credit_card_holder_info || {
              name: matricula.nome,
              cpfCnpj: (matricula.cpf || "").replace(/\D/g, ""),
              phone: (matricula.telefone || "").replace(/\D/g, ""),
              postalCode: "88058512",
              addressNumber: "65",
            };
            // Parcelamento (2-12x)
            const parcelas = payload.installment_count || 12;
            if (parcelas > 1) {
              paymentBody.installmentCount = parcelas;
              paymentBody.installmentValue = Math.round((valor / parcelas) * 100) / 100;
            }
          }

          const payRes = await fetch(`${baseUrl}/payments`, {
            method: "POST",
            headers,
            body: JSON.stringify(paymentBody),
          });
          const payData = await payRes.json();

          if (!payRes.ok) {
            return jsonResponse({ error: "Erro ao criar cobrança", detail: payData }, 502);
          }

          // 5. Se PIX, buscar QR code
          let pixQrCode = null;
          let pixCopiaCola = null;
          if (billing_type === "PIX") {
            const qrRes = await fetch(`${baseUrl}/payments/${payData.id}/pixQrCode`, { headers });
            const qrData = await qrRes.json();
            pixQrCode = qrData.encodedImage || null;
            pixCopiaCola = qrData.payload || null;
          }

          // 6. Atualizar matrícula com dados de pagamento
          const updateData: any = {
            asaas_payment_id: payData.id,
            pagamento_valor: valor,
          };

          if (billing_type === "PIX") {
            updateData.pagamento_pix_qrcode = pixQrCode;
            updateData.pagamento_pix_copiacola = pixCopiaCola;
            updateData.pagamento_status = "pendente";
          } else if (billing_type === "CREDIT_CARD") {
            // Cartão de crédito: se status CONFIRMED ou RECEIVED, já está pago
            if (payData.status === "CONFIRMED" || payData.status === "RECEIVED") {
              updateData.pagamento_status = "confirmado";
            } else {
              updateData.pagamento_status = "pendente";
            }
          }

          await supabase
            .from("matriculas_aulao")
            .update(updateData)
            .eq("id", matricula_id);

          return jsonResponse({
            ok: true,
            payment_id: payData.id,
            billing_type,
            status: payData.status,
            pix_qr_code: pixQrCode,
            pix_copia_cola: pixCopiaCola,
            credit_card_status: billing_type === "CREDIT_CARD" ? payData.status : null,
          });
        } catch (e: any) {
          console.error("[asaas-aulao] Erro:", e);
          return jsonResponse({ error: e?.message || String(e) }, 502);
        }
      },
    },
  },
});
