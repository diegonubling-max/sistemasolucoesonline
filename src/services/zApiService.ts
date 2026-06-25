const Z_API_BASE =
  "https://api.z-api.io/instances/3F4CC1DC22AB31BDE17ECE717FF40C71/token/E55BC981D8AA6846EAFEAEE4";
const Z_API_CLIENT_TOKEN = "F2ffd89a74df2440aad10b65315696d0eS";

function formatPhone(telefone: string): string {
  const numero = (telefone || "").replace(/\D/g, "");
  return numero.startsWith("55") ? numero : "55" + numero;
}

function getPrimeiroNome(nome: string): string {
  return (nome || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
}

function getNomeExibicao(nome: string): string {
  const primeiro = getPrimeiroNome(nome);
  return primeiro ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1) : "";
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

const SITE_URL = "https://sistemasolucoesonline.lovable.app/aluno/login";

export async function sendBoasVindasMatricula(params: {
  telefone: string;
  nome: string;
  ctr: number | string;
}) {
  const primeiroNome = getPrimeiroNome(params.nome);
  const nomeExibicao = getNomeExibicao(params.nome);
  const msg = `*🎓 Bem-vindo(a) à Soluções Online!*

Olá, *${nomeExibicao}*! Sua matrícula foi realizada com sucesso! 🎉

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
  const nomeExibicao = getNomeExibicao(params.nome);
  const msg = `*⚠️ Soluções Online — Lembrete de Pagamento*

Olá, *${nomeExibicao}*! Sua parcela de *R$ ${formatBRL(params.valor)}* vence em *3 dias* (${formatDateBR(
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
  const nomeExibicao = getNomeExibicao(params.nome);
  const msg = `*🔴 Soluções Online — Parcela em Atraso*

Olá, *${nomeExibicao}*! Identificamos que sua parcela de *R$ ${formatBRL(params.valor)}* está em atraso desde ${formatDateBR(
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
  const nomeExibicao = getNomeExibicao(params.nome);
  const msg = `*✅ Soluções Online — Pagamento Confirmado!*

Olá, *${nomeExibicao}*! Recebemos seu pagamento de *R$ ${formatBRL(params.valor)}* com sucesso!

Continue seus estudos acessando:
👉 ${SITE_URL} 📚`;
  await sendWhatsApp(params.telefone, msg);
}

export async function sendBoasVindasPrimeiroAcesso(params: {
  telefone: string;
  nome: string;
}) {
  const nomeExibicao = getNomeExibicao(params.nome);
  const msg = `*🎓 Soluções Online*

Olá, *${nomeExibicao}*! 👋

Que alegria ver você aqui! Cada vez que você abre seus estudos, está construindo um futuro melhor para você e sua família. 💪

Saiba que você não está sozinho nessa jornada. Nossa equipe acredita no seu potencial e torce muito pelo seu sucesso! 🌟

Bons estudos e conte sempre conosco!
_Equipe Soluções Online_ 📚`;
  await sendWhatsApp(params.telefone, msg);
}

export async function sendNuncaAcessou(params: {
  telefone: string;
  nome: string;
  ctr: number | string;
}) {
  const nomeExibicao = getNomeExibicao(params.nome);
  const primeiroNome = getPrimeiroNome(params.nome);
  const msg = `Olá, *${nomeExibicao}*! 👋
Notamos que você ainda não acessou sua área de estudos desde que fez sua matrícula.
Sabemos que dar o primeiro passo pode parecer difícil, mas o mais importante é começar! 🚀
Seu diploma está esperando por você.
👉 Acesse agora: ${SITE_URL}
📋 Login: ${params.ctr} | 🔑 Senha: 1234${primeiroNome}`;
  await sendWhatsApp(params.telefone, msg);
}

export async function sendSemAcesso4Dias(params: {
  telefone: string;
  nome: string;
  dias: number;
  ultimaAula: string | null;
  materia: string | null;
}) {
  const nomeExibicao = getNomeExibicao(params.nome);
  const aula = params.ultimaAula || "suas aulas";
  const materia = params.materia || "seus cursos";
  const msg = `Olá, *${nomeExibicao}*! 💙
Já faz *${params.dias}* dias que você não acessa a sua área de estudos...
A última vez que você assistiu foi na aula *${aula}* de *${materia}*

Cada dia de estudo te aproxima do seu diploma.
Não deixa o caminho esfriar! 🎓

👉 Continue de onde parou: ${SITE_URL}`;
  await sendWhatsApp(params.telefone, msg);
}

export async function sendMensagemSabado(params: {
  telefone: string;
  nome: string;
  ultimaAula: string | null;
  materia: string | null;
}) {
  const nomeExibicao = getNomeExibicao(params.nome);
  const aula = params.ultimaAula || "suas aulas";
  const materia = params.materia || "seus cursos";
  const msg = `Feliz sábado, *${nomeExibicao}*! ☀️
Enquanto o mundo descansa, os que constroem o futuro aproveitam cada momento.
Você sabia que está na aula *${aula}* de *${materia}*? Que tal avançar hoje?
Família por perto, celular na mão... é o momento perfeito para estudar com calma e sem pressa. 📚
Seu diploma agradece cada minuto dedicado hoje!
👉 ${SITE_URL}`;
  await sendWhatsApp(params.telefone, msg);
}

export async function sendMensagemDomingo(params: {
  telefone: string;
  nome: string;
  ultimaAula: string | null;
  materia: string | null;
}) {
  const nomeExibicao = getNomeExibicao(params.nome);
  const aula = params.ultimaAula || "suas aulas";
  const materia = params.materia || "seus cursos";
  const msg = `Bom domingo, *${nomeExibicao}*! 🌟
Um domingo bem aproveitado é aquele que te deixa mais perto dos seus sonhos.
Enquanto a semana ainda não chegou, que tal dedicar uns minutinhos aos seus estudos?
Você estava na aula *${aula}* de *${materia}* — cada aula assistida é um passo real rumo ao seu diploma. 🎓
Invista em você hoje. Seu futuro agradece!
👉 ${SITE_URL}`;
  await sendWhatsApp(params.telefone, msg);
}
