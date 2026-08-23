import { supabase } from "@/integrations/supabase/client";

// URL do próprio sistema — sempre absoluta, funciona tanto chamada do navegador
// quanto de dentro de um endpoint rodando no servidor (cron jobs, webhooks).
const ZAPI_SEND_ENDPOINT = "https://sistema.supletivosolucoesonline.com.br/api/public/hooks/zapi-send";

// Link da área do aluno — domínio atual do sistema (18/02/2026: trocado do
// domínio antigo do Lovable, que ficou fora do ar).
const SITE_URL = "https://sistema.supletivosolucoesonline.com.br/aluno/login";

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

// Checa o interruptor de "Configurações → Disparos WhatsApp" pra esse tipo de disparo.
// Sem registro na tabela = habilitado por padrão (comportamento antigo preservado).
export async function isDisparoEnabled(nome: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", `zapi_disparo_${nome}`)
      .maybeSingle();
    if (error) {
      console.warn("[zApi] Erro ao checar toggle (tratando como desabilitado por segurança):", nome, error);
      return false;
    }
    if (!data) return true;
    return data.valor !== "false";
  } catch (e) {
    console.warn("[zApi] Falha ao checar toggle (tratando como desabilitado por segurança):", nome, e);
    return false;
  }
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
  telefone: string,
  mensagem: string,
  status: "enviado" | "erro",
  erroDetalhe?: string,
) {
  try {
    const { error } = await supabase.from("zapi_mensagens_log").insert({
      aluno_id: log.alunoId ?? null,
      tipo: log.tipo,
      telefone,
      mensagem,
      status,
      erro_detalhe: erroDetalhe ?? null,
    });
    if (error) console.warn("[zApi] Falha ao registrar log:", error);
  } catch (e) {
    console.warn("[zApi] Falha ao registrar log:", e);
  }
}

// Função única de envio — usada por TODOS os disparos, sem duplicação.
export async function sendWhatsApp(
  telefone: string,
  mensagem: string,
  log?: LogCtx,
): Promise<boolean> {
  const ctx: LogCtx = log ?? { tipo: "outro" };
  if (!telefone) {
    console.warn("[zApi] Telefone vazio, pulando envio:", ctx.tipo);
    await registrarLog(ctx, telefone, mensagem, "erro", "telefone vazio");
    return false;
  }
  const phone = formatPhone(telefone);
  console.log(`[zApi] Enviando '${ctx.tipo}' para ${phone}...`);
  try {
    const res = await fetch(ZAPI_SEND_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message: mensagem }),
    });
    const text = await res.text();
    console.log(`[zApi] '${ctx.tipo}' -> HTTP ${res.status}:`, text);
    if (!res.ok) {
      await registrarLog(ctx, phone, mensagem, "erro", `HTTP ${res.status}: ${text}`);
      return false;
    }
    await registrarLog(ctx, phone, mensagem, "enviado");
    return true;
  } catch (e: any) {
    console.error(`[zApi] Erro ao enviar '${ctx.tipo}':`, e);
    await registrarLog(ctx, phone, mensagem, "erro", e?.message || String(e));
    return false;
  }
}

function formatBRL(valor: number) {
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateBR(dateISO: string) {
  const [y, m, d] = dateISO.split("-");
  return `${d}/${m}/${y}`;
}

export async function sendAgendamentoProva(params: {
  telefone: string;
  nome: string;
  dataProva: string; // YYYY-MM-DD
  horaProva: string; // HH:mm[:ss]
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled("agendamento_prova"))) { console.log("[zApi] disparo desativado: agendamento_prova"); return false; }
  const nomeFmt = getNomeExibicao(params.nome);
  const [y, m, d] = params.dataProva.split("-");
  const dataFmt = `${d}/${m}/${y}`;
  const horaFmt = (params.horaProva || "").substring(0, 5);
  const msg = `*📝 Prova Agendada!*

Olá, *${nomeFmt}*! Sua prova final foi agendada com sucesso! ✅

📅 *Data:* ${dataFmt}
🕐 *Horário:* ${horaFmt}

Acesse a plataforma no dia e horário agendado para realizar sua prova.
👉 ${SITE_URL}

Qualquer dúvida estamos à disposição! 😊`;
  return await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "agendamento_prova" });
}

export async function sendBoasVindasMatricula(params: {
  telefone: string;
  nome: string;
  ctr: number | string;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled("boas_vindas"))) { console.log("[zApi] disparo desativado: boas_vindas"); return false; }
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
  return await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "boas_vindas" });
}

export async function sendLembreteVencimento(params: {
  telefone: string;
  nome: string;
  valor: number;
  dataVencimento: string;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled("lembrete_vencimento"))) { console.log("[zApi] disparo desativado: lembrete_vencimento"); return false; }
  const nomeExibicao = getNomeExibicao(params.nome);
  const msg = `*⚠️ Soluções Online — Lembrete de Pagamento*

Olá, *${nomeExibicao}*! Sua parcela de *R$ ${formatBRL(params.valor)}* vence em *3 dias* (${formatDateBR(params.dataVencimento)}).

Evite a interrupção do seu acesso aos estudos. Regularize em dia! 📚`;
  return await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "lembrete_vencimento" });
}

export async function sendAvisoAtraso(params: {
  telefone: string;
  nome: string;
  valor: number;
  dataVencimento: string;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled("aviso_atraso"))) { console.log("[zApi] disparo desativado: aviso_atraso"); return false; }
  const nomeExibicao = getNomeExibicao(params.nome);
  const msg = `*🔴 Soluções Online — Parcela em Atraso*

Olá, *${nomeExibicao}*! Identificamos que sua parcela de *R$ ${formatBRL(params.valor)}* está em atraso desde ${formatDateBR(params.dataVencimento)}.

Regularize agora para manter seu acesso! Entre em contato conosco.`;
  return await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "aviso_atraso" });
}

export async function sendConfirmacaoPagamento(params: {
  telefone: string;
  nome: string;
  valor: number;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled("confirmacao_pagamento"))) { console.log("[zApi] disparo desativado: confirmacao_pagamento"); return false; }
  const nomeExibicao = getNomeExibicao(params.nome);
  const msg = `*✅ Soluções Online — Pagamento Confirmado!*

Olá, *${nomeExibicao}*! Recebemos seu pagamento de *R$ ${formatBRL(params.valor)}* com sucesso!

Continue seus estudos acessando:
👉 ${SITE_URL} 📚`;
  return await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "confirmacao_pagamento" });
}

export async function sendBoasVindasPrimeiroAcesso(params: {
  telefone: string;
  nome: string;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled("motivacional_primeiro_login"))) { console.log("[zApi] disparo desativado: motivacional_primeiro_login"); return false; }
  const nomeExibicao = getNomeExibicao(params.nome);
  const msg = `*🎓 Soluções Online*

Olá, *${nomeExibicao}*! 👋

Que alegria ver você aqui! Cada vez que você abre seus estudos, está construindo um futuro melhor para você e sua família. 💪

Saiba que você não está sozinho nessa jornada. Nossa equipe acredita no seu potencial e torce muito pelo seu sucesso! 🌟

Bons estudos e conte sempre conosco!
_Equipe Soluções Online_ 📚`;
  return await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "motivacional_primeiro_login" });
}

export async function sendNuncaAcessou(params: {
  telefone: string;
  nome: string;
  ctr: number | string;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled("nunca_acessou"))) { console.log("[zApi] disparo desativado: nunca_acessou"); return false; }
  const nomeExibicao = getNomeExibicao(params.nome);
  const primeiroNome = getPrimeiroNome(params.nome);
  const msg = `Olá, *${nomeExibicao}*! 👋
Notamos que você ainda não acessou sua área de estudos desde que fez sua matrícula.
Sabemos que dar o primeiro passo pode parecer difícil, mas o mais importante é começar! 🚀
Seu diploma está esperando por você.
👉 Acesse agora: ${SITE_URL}
📋 Login: ${params.ctr} | 🔑 Senha: 1234${primeiroNome}`;
  return await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "nunca_acessou" });
}

export async function sendSemAcesso4Dias(params: {
  telefone: string;
  nome: string;
  dias: number;
  ultimaAula: string | null;
  materia: string | null;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled("4_dias_sem_acessar"))) { console.log("[zApi] disparo desativado: 4_dias_sem_acessar"); return false; }
  const nomeExibicao = getNomeExibicao(params.nome);
  const aula = params.ultimaAula || "suas aulas";
  const materia = params.materia || "seus cursos";
  const msg = `Olá, *${nomeExibicao}*! 💙
Já faz *${params.dias}* dias que você não acessa a sua área de estudos...
A última vez que você assistiu foi na aula *${aula}* de *${materia}*

Cada dia de estudo te aproxima do seu diploma.
Não deixa o caminho esfriar! 🎓

👉 Continue de onde parou: ${SITE_URL}`;
  return await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "4_dias_sem_acessar" });
}

export async function sendMensagemSabado(params: {
  telefone: string;
  nome: string;
  ultimaAula: string | null;
  materia: string | null;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled("sabado"))) { console.log("[zApi] disparo desativado: sabado"); return false; }
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
  return await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "sabado" });
}

export async function sendMensagemDomingo(params: {
  telefone: string;
  nome: string;
  ultimaAula: string | null;
  materia: string | null;
  alunoId?: string | null;
}) {
  if (!(await isDisparoEnabled("domingo"))) { console.log("[zApi] disparo desativado: domingo"); return false; }
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
  return await sendWhatsApp(params.telefone, msg, { alunoId: params.alunoId, tipo: "domingo" });
}
