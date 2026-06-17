const Z_API_BASE =
  "https://api.z-api.io/instances/3F4CC1DC22AB31BDE17ECE717FF40C71/token/E55BC981D8AA6846EAFEAEE4";
const Z_API_CLIENT_TOKEN = "F2ffd89a74df2440aad10b65315696d0eS";

function formatPhone(telefone: string): string {
  const numero = (telefone || "").replace(/\D/g, "");
  return numero.startsWith("55") ? numero : "55" + numero;
}

export async function sendWhatsApp(telefone: string, mensagem: string): Promise<void> {
  console.log("[zApi] sendWhatsApp chamado | telefone bruto:", telefone);
  if (!telefone) {
    console.warn("[zApi] Telefone vazio, pulando envio");
    return;
  }
  const phone = formatPhone(telefone);
  const url = `${Z_API_BASE}/send-text`;
  const payload = { phone, message: mensagem };
  console.log("[zApi] Enviando para:", phone);
  console.log("[zApi] URL:", url);
  console.log("[zApi] Payload:", JSON.stringify(payload));
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": Z_API_CLIENT_TOKEN,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log("[zApi] Status HTTP:", res.status);
    console.log("[zApi] Resposta bruta:", text);
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      console.warn("[zApi] Resposta não é JSON válido");
    }
    console.log("[zApi] Resposta JSON:", JSON.stringify(json));
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

export async function sendBoasVindasPrimeiroAcesso(params: {
  telefone: string;
  nome: string;
}) {
  const primeiroNome = (params.nome || "").trim().split(/\s+/)[0] || params.nome;
  const msg = `*🎓 Soluções Online*

Olá, *${primeiroNome}*! 👋

Que alegria ver você aqui! Cada vez que você abre seus estudos, está construindo um futuro melhor para você e sua família. 💪

Saiba que você não está sozinho nessa jornada. Nossa equipe acredita no seu potencial e torce muito pelo seu sucesso! 🌟

Bons estudos e conte sempre conosco!
_Equipe Soluções Online_ 📚`;
  await sendWhatsApp(params.telefone, msg);
}
