const Z_API_BASE =
  "https://api.z-api.io/instances/3F4CC1DC22AB31BDE17ECE717FF40C71/token/E55BC981D8AA6846EAFEAEE4";
const Z_API_CLIENT_TOKEN = "E55BC981D8AA6846EAFEAEE4";

function formatPhone(telefone: string): string {
  const numero = (telefone || "").replace(/\D/g, "");
  return numero.startsWith("55") ? numero : "55" + numero;
}

export async function sendWhatsApp(telefone: string, mensagem: string): Promise<void> {
  if (!telefone) {
    console.warn("[zApi] Telefone vazio, pulando envio");
    return;
  }
  try {
    const res = await fetch(`${Z_API_BASE}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": Z_API_CLIENT_TOKEN,
      },
      body: JSON.stringify({ phone: formatPhone(telefone), message: mensagem }),
    });
    const json = await res.json().catch(() => ({}));
    console.log("[zApi] Resultado:", res.status, JSON.stringify(json));
  } catch (e) {
    console.error("[zApi] Erro ao enviar WhatsApp:", e);
  }
}

const SITE_URL = "https://sistemasolucoesonline.lovable.app";

export async function sendBoasVindasMatricula(params: {
  telefone: string;
  nome: string;
  ctr: number | string;
}) {
  const primeiroNome = (params.nome || "").trim().split(/\s+/)[0] || "";
  const msg = `*🎓 Bem-vindo(a) à Soluções Online!*

Olá, *${params.nome}*! Sua matrícula foi realizada com sucesso! 🎉

📚 *Seus dados de acesso:*
- Login: *${params.ctr}*
- Senha: *1234${primeiroNome}*

Acesse sua área de estudos em:
👉 ${SITE_URL}

Qualquer dúvida estamos à disposição! 😊`;
  await sendWhatsApp(params.telefone, msg);
}

function formatBRL(valor: number) {
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateBR(dateISO: string) {
  const [y, m, d] = dateISO.split("-");
  return `${d}/${m}/${y}`;
}

export async function sendLembreteVencimento(params: {
  telefone: string;
  nome: string;
  valor: number;
  dataVencimento: string; // YYYY-MM-DD
}) {
  const msg = `*⚠️ Soluções Online — Lembrete de Pagamento*

Olá, *${params.nome}*! Sua parcela de *R$ ${formatBRL(params.valor)}* vence em *3 dias* (${formatDateBR(
    params.dataVencimento,
  )}).

Evite a interrupção do seu acesso aos estudos. Regularize em dia! 📚`;
  await sendWhatsApp(params.telefone, msg);
}

export async function sendAvisoAtraso(params: {
  telefone: string;
  nome: string;
  valor: number;
  dataVencimento: string;
}) {
  const msg = `*🔴 Soluções Online — Parcela em Atraso*

Olá, *${params.nome}*! Identificamos que sua parcela de *R$ ${formatBRL(params.valor)}* está em atraso desde ${formatDateBR(
    params.dataVencimento,
  )}.

Regularize agora para manter seu acesso! Entre em contato conosco.`;
  await sendWhatsApp(params.telefone, msg);
}

export async function sendConfirmacaoPagamento(params: {
  telefone: string;
  nome: string;
  valor: number;
}) {
  const msg = `*✅ Soluções Online — Pagamento Confirmado!*

Olá, *${params.nome}*! Recebemos seu pagamento de *R$ ${formatBRL(params.valor)}* com sucesso!

Continue seus estudos acessando:
👉 ${SITE_URL} 📚`;
  await sendWhatsApp(params.telefone, msg);
}
