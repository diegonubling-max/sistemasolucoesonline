import { supabase } from "@/integrations/supabase/client";

const Z_API_BASE =
  "https://api.z-api.io/instances/3F4CC1DC22AB31BDE17ECE717FF40C71/token/E55BC981D8AA6846EAFEAEE4";
const Z_API_CLIENT_TOKEN = "F2ffd89a74df2440aad10b65315696d0eS";

export type ZapiTipoDisparo =
  | "boas_vindas"
  | "confirmacao_pagamento"
  | "lembrete_vencimento"
  | "aviso_atraso"
  | "motivacional_primeiro_login"
  | "reenvio_acesso"
  | "redefinicao_senha"
  | "nunca_acessou"
  | "4_dias_sem_acessar"
  | "sabado"
  | "domingo"
  | "agendamento_prova"
  | "outro";

export async function isDisparoEnabled(nome: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", `zapi_disparo_${nome}`)
      .maybeSingle();
    if (!data) return true; // default enabled when não existir
    return data.valor !== "false";
  } catch (e) {
    console.warn("[zApi] Falha ao checar toggle:", nome, e);
    return true;
  }
}

export async function sendAgendamentoProva(params: {
  telefone: string;
  nome: string;
  dataProva: string; // YYYY-MM-DD
  horaProva: string; // HH:mm[:ss]
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled('agendamento_prova'))) { console.log('[zApi] disparo desativado:', 'agendamento_prova'); return; }
  const nomeExibicao = (params.nome || "").trim().split(/\s+/)[0] || "";
  const nomeFmt = nomeExibicao
    ? nomeExibicao.charAt(0).toUpperCase() + nomeExibicao.slice(1).toLowerCase()
    : "";
  const [y, m, d] = params.dataProva.split("-");
  const dataFmt = `${d}/${m}/${y}`;
  const horaFmt = (params.horaProva || "").substring(0, 5);
  const msg = `*📝 Prova Agendada!*

Olá, *${nomeFmt}*! Sua prova final foi agendada com sucesso! ✅

📅 *Data:* ${dataFmt}
🕐 *Horário:* ${horaFmt}

Acesse a plataforma no dia e horário agendado para realizar sua prova.
👉 https://sistemasolucoesonline.lovable.app/aluno/login

Qualquer dúvida estamos à disposição! 😊`;
  await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "agendamento_prova" });
}

export type LogCtx = { alunoId?: string | null; tipo: ZapiTipoDisparo };

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

async function registrarLog(
  log: LogCtx,
  mensagem: string,
  status: "enviado" | "erro",
  erroDetalhe?: string,
) {
  try {
    await supabase.from("zapi_mensagens_log").insert({
      aluno_id: log.alunoId ?? null,
      tipo: log.tipo,
      mensagem,
      status,
      erro_detalhe: erroDetalhe ?? null,
    });
  } catch (e) {
    console.warn("[zApi] Falha ao registrar log:", e);
  }
}

export async function sendWhatsApp(
  telefone: string,
  mensagem: string,
  log?: LogCtx,
): Promise<void> {
  console.log("[zApi] sendWhatsApp chamado | telefone bruto:", telefone);
  const ctx: LogCtx = log ?? { tipo: "outro" };
  if (!telefone) {
    console.warn("[zApi] Telefone vazio, pulando envio");
    await registrarLog(ctx, mensagem, "erro", "telefone vazio");
    return;
  }
  const phone = formatPhone(telefone);
  const url = `${Z_API_BASE}/send-text`;
  const payload = { phone, message: mensagem };
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
    console.log("[zApi] Status HTTP:", res.status, "| Resposta:", text);
    if (!res.ok) {
      await registrarLog(ctx, mensagem, "erro", `HTTP ${res.status}: ${text}`);
      return;
    }
    await registrarLog(ctx, mensagem, "enviado");
  } catch (e: any) {
    console.error("[zApi] Erro ao enviar WhatsApp:", e);
    await registrarLog(ctx, mensagem, "erro", e?.message || String(e));
  }
}

const SITE_URL = "https://sistemasolucoesonline.lovable.app/aluno/login";

export async function sendBoasVindasMatricula(params: {
  telefone: string;
  nome: string;
  ctr: number | string;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled('boas_vindas'))) { console.log('[zApi] disparo desativado:', 'boas_vindas'); return; }
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
  await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "boas_vindas" });
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
  dataVencimento: string;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled('lembrete_vencimento'))) { console.log('[zApi] disparo desativado:', 'lembrete_vencimento'); return; }
  const nomeExibicao = getNomeExibicao(params.nome);
  const msg = `*⚠️ Soluções Online — Lembrete de Pagamento*

Olá, *${nomeExibicao}*! Sua parcela de *R$ ${formatBRL(params.valor)}* vence em *3 dias* (${formatDateBR(
    params.dataVencimento,
  )}).

Evite a interrupção do seu acesso aos estudos. Regularize em dia! 📚`;
  await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "lembrete_vencimento" });
}

export async function sendAvisoAtraso(params: {
  telefone: string;
  nome: string;
  valor: number;
  dataVencimento: string;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled('aviso_atraso'))) { console.log('[zApi] disparo desativado:', 'aviso_atraso'); return; }
  const nomeExibicao = getNomeExibicao(params.nome);
  const msg = `*🔴 Soluções Online — Parcela em Atraso*

Olá, *${nomeExibicao}*! Identificamos que sua parcela de *R$ ${formatBRL(params.valor)}* está em atraso desde ${formatDateBR(
    params.dataVencimento,
  )}.

Regularize agora para manter seu acesso! Entre em contato conosco.`;
  await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "aviso_atraso" });
}

export async function sendConfirmacaoPagamento(params: {
  telefone: string;
  nome: string;
  valor: number;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled('confirmacao_pagamento'))) { console.log('[zApi] disparo desativado:', 'confirmacao_pagamento'); return; }
  const nomeExibicao = getNomeExibicao(params.nome);
  const msg = `*✅ Soluções Online — Pagamento Confirmado!*

Olá, *${nomeExibicao}*! Recebemos seu pagamento de *R$ ${formatBRL(params.valor)}* com sucesso!

Continue seus estudos acessando:
👉 ${SITE_URL} 📚`;
  await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "confirmacao_pagamento" });
}

export async function sendBoasVindasPrimeiroAcesso(params: {
  telefone: string;
  nome: string;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled('motivacional_primeiro_login'))) { console.log('[zApi] disparo desativado:', 'motivacional_primeiro_login'); return; }
  const nomeExibicao = getNomeExibicao(params.nome);
  const msg = `*🎓 Soluções Online*

Olá, *${nomeExibicao}*! 👋

Que alegria ver você aqui! Cada vez que você abre seus estudos, está construindo um futuro melhor para você e sua família. 💪

Saiba que você não está sozinho nessa jornada. Nossa equipe acredita no seu potencial e torce muito pelo seu sucesso! 🌟

Bons estudos e conte sempre conosco!
_Equipe Soluções Online_ 📚`;
  await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "motivacional_primeiro_login" });
}

export async function sendNuncaAcessou(params: {
  telefone: string;
  nome: string;
  ctr: number | string;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled('nunca_acessou'))) { console.log('[zApi] disparo desativado:', 'nunca_acessou'); return; }
  const nomeExibicao = getNomeExibicao(params.nome);
  const primeiroNome = getPrimeiroNome(params.nome);
  const msg = `Olá, *${nomeExibicao}*! 👋
Notamos que você ainda não acessou sua área de estudos desde que fez sua matrícula.
Sabemos que dar o primeiro passo pode parecer difícil, mas o mais importante é começar! 🚀
Seu diploma está esperando por você.
👉 Acesse agora: ${SITE_URL}
📋 Login: ${params.ctr} | 🔑 Senha: 1234${primeiroNome}`;
  await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "nunca_acessou" });
}

export async function sendSemAcesso4Dias(params: {
  telefone: string;
  nome: string;
  dias: number;
  ultimaAula: string | null;
  materia: string | null;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled('4_dias_sem_acessar'))) { console.log('[zApi] disparo desativado:', '4_dias_sem_acessar'); return; }
  const nomeExibicao = getNomeExibicao(params.nome);
  const aula = params.ultimaAula || "suas aulas";
  const materia = params.materia || "seus cursos";
  const msg = `Olá, *${nomeExibicao}*! 💙
Já faz *${params.dias}* dias que você não acessa a sua área de estudos...
A última vez que você assistiu foi na aula *${aula}* de *${materia}*

Cada dia de estudo te aproxima do seu diploma.
Não deixa o caminho esfriar! 🎓

👉 Continue de onde parou: ${SITE_URL}`;
  await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "4_dias_sem_acessar" });
}

export async function sendMensagemSabado(params: {
  telefone: string;
  nome: string;
  ultimaAula: string | null;
  materia: string | null;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled('sabado'))) { console.log('[zApi] disparo desativado:', 'sabado'); return; }
  const nomeExibicao = getNomeExibicao(params.nome);
  const semAula = !params.ultimaAula || !params.materia;
  const msg = semAula
    ? `Feliz sábado, *${nomeExibicao}*! ☀️
O fim de semana é seu — e uns minutinhos de estudo fazem toda a diferença!
Você ainda não começou suas aulas, mas hoje é um dia perfeito para dar o primeiro passo! 🚀
Com calma e sem pressa, acessa a área do aluno e começa sua jornada rumo ao diploma. 📚
A gente acredita em você!
👉 ${SITE_URL}`
    : `Feliz sábado, *${nomeExibicao}*! ☀️
O fim de semana é seu — e uns minutinhos de estudo fazem toda a diferença!
Você está na aula *${params.ultimaAula}* de *${params.materia}*. Que tal avançar um pouquinho hoje?
Com a família por perto e o celular na mão, é o momento perfeito para estudar com calma e sem pressa. 📚
Seu diploma agradece cada minuto dedicado hoje!
👉 ${SITE_URL}`;
  await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "sabado" });
}

export async function sendMensagemDomingo(params: {
  telefone: string;
  nome: string;
  ultimaAula: string | null;
  materia: string | null;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled('domingo'))) { console.log('[zApi] disparo desativado:', 'domingo'); return; }
  const nomeExibicao = getNomeExibicao(params.nome);
  const semAula = !params.ultimaAula || !params.materia;
  const msg = semAula
    ? `Bom domingo, *${nomeExibicao}*! 🌟
Domingo é dia de recarregar as energias — e também de dar o primeiro passo rumo ao seu diploma!
Você ainda não assistiu nenhuma aula, mas nunca é tarde para começar. 🎓
Dedica uns minutinhos hoje, acessa a área do aluno e dá início à sua história!
Seu futuro agradece!
👉 ${SITE_URL}`
    : `Bom domingo, *${nomeExibicao}*! 🌟
Domingo é dia de recarregar as energias — e também de dar um passo rumo ao seu diploma!
Você estava na aula *${params.ultimaAula}* de *${params.materia}* — cada aula assistida é uma conquista real. 🎓
Dedica uns minutinhos a você hoje. Seu futuro agradece!
👉 ${SITE_URL}`;
  await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "domingo" });
}
