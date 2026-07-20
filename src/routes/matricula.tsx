import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { maskCPF, maskPhone, isValidCPF } from "@/lib/format";
import { format } from "date-fns";
import { Loader2, CheckCircle2 } from "lucide-react";

const POLO_ID_FLORIPA = "32671c78-9076-4f88-8161-bfd5ee8e866b";
const WHATSAPP_EQUIPE = "48991535895";

export const Route = createFileRoute("/matricula")({
  head: () => ({
    meta: [
      { title: "Matrícula — Soluções Online" },
      { name: "description", content: "Realize sua matrícula no Aulão da Soluções Online" },
    ],
  }),
  component: MatriculaPublicaPage,
});

type Step = 1 | 2 | 3;
type FormaPag = "boleto" | "cartao";

interface DadosAluno {
  nome: string;
  telefone: string;
  cpf: string;
  data_nascimento: string; // dd/mm/aaaa
}


interface Sucesso {
  jaExistia: boolean;
}

function getUtm() {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source: p.get("utm_source") || null,
    utm_medium: p.get("utm_medium") || null,
    utm_campaign: p.get("utm_campaign") || null,
    utm_content: p.get("utm_content") || null,
  };
}

function maskDate(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function parseDateBR(value: string): string | null {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd), month = Number(mm), year = Number(yyyy);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > new Date().getFullYear()) return null;
  const d = new Date(year, month - 1, day);
  if (d.getDate() !== day || d.getMonth() !== month - 1) return null;
  return `${yyyy}-${mm}-${dd}`;
}

const PLANOS: Record<FormaPag, { entrada: string; qtdParc: string; valorParc: string; total: string }> = {
  boleto: { entrada: "69,90", qtdParc: "10", valorParc: "159,90", total: "1.668,90" },
  cartao: { entrada: "69,90", qtdParc: "12", valorParc: "119,90", total: "1.508,70" },
};

function getProximoEncerramento(): Date {
  const agora = new Date();
  const meta = new Date(agora);
  meta.setHours(19, 30, 0, 0);
  if (agora >= meta) {
    meta.setDate(meta.getDate() + 1);
  }
  return meta;
}

function formatContagem(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSegundos = Math.floor(ms / 1000);
  const h = Math.floor(totalSegundos / 3600);
  const m = Math.floor((totalSegundos % 3600) / 60);
  const s = totalSegundos % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const NOMES_PROVA_SOCIAL: { nome: string; cidade: string }[] = [
  { nome: "Marcos Silva", cidade: "Florianópolis/SC" },
  { nome: "Jéssica Dias", cidade: "Vitória da Conquista/BA" },
  { nome: "Gustavo Pinto", cidade: "Ponta Grossa/PR" },
  { nome: "Luciana Brito", cidade: "Caruaru/PE" },
  { nome: "Tatiana Vieira", cidade: "Santa Maria/RS" },
  { nome: "Sandra Machado", cidade: "Campinas/SP" },
  { nome: "Amanda Cunha", cidade: "Imperatriz/MA" },
  { nome: "Bruno Ferreira", cidade: "Xanxerê/SC" },
  { nome: "Leandro Campos", cidade: "Uberlândia/MG" },
  { nome: "Aline Freitas", cidade: "Londrina/PR" },
  { nome: "Carlos Alberto", cidade: "Mossoró/RN" },
  { nome: "Rodrigo Martins", cidade: "Videira/SC" },
  { nome: "Ricardo Lopes", cidade: "Feira de Santana/BA" },
  { nome: "Lucas Moreira", cidade: "Canoas/RS" },
  { nome: "Daniele Rocha", cidade: "Sorocaba/SP" },
  { nome: "Márcio Rezende", cidade: "Macapá/AP" },
  { nome: "Patrícia Almeida", cidade: "Rio do Sul/SC" },
  { nome: "Fábio Monteiro", cidade: "Governador Valadares/MG" },
  { nome: "Eduardo Mendes", cidade: "Cascavel/PR" },
  { nome: "Roberta Nascimento", cidade: "Pelotas/RS" },
  { nome: "Michele Tavares", cidade: "Juiz de Fora/MG" },
  { nome: "Juliana Costa", cidade: "Lages/SC" },
  { nome: "Felipe Ramos", cidade: "Bagé/RS" },
  { nome: "Cláudio Borges", cidade: "São José dos Campos/SP" },
  { nome: "Adriana Souza", cidade: "Palhoça/SC" },
  { nome: "Isabela Correia", cidade: "Montes Claros/MG" },
  { nome: "Carla Nunes", cidade: "Maringá/PR" },
  { nome: "Marcelo Duarte", cidade: "Passo Fundo/RS" },
  { nome: "Larissa Gomes", cidade: "Araranguá/SC" },
  { nome: "Paulo Henrique", cidade: "Ribeirão Preto/SP" },
  { nome: "Simone Teixeira", cidade: "Erechim/RS" },
  { nome: "Rafael Oliveira", cidade: "Chapecó/SC" },
  { nome: "Renata Araújo", cidade: "Guarapuava/PR" },
  { nome: "Thiago Barbosa", cidade: "Caçador/SC" },
  { nome: "Camila Santos", cidade: "Itajaí/SC" },
  { nome: "Vanessa Rodrigues", cidade: "Canoinhas/SC" },
  { nome: "Diego Pereira", cidade: "Criciúma/SC" },
  { nome: "Anderson Ribeiro", cidade: "Brusque/SC" },
  { nome: "Fernanda Lima", cidade: "Concórdia/SC" },
  { nome: "Priscila Cardoso", cidade: "Navegantes/SC" },
];

function MatriculaPublicaPage() {
  const [step, setStep] = useState<Step>(1);
  const [dados, setDados] = useState<DadosAluno>({
    nome: "", telefone: "", cpf: "", data_nascimento: "",
  });

  const [forma, setForma] = useState<FormaPag | null>(null);
  const [aceito, setAceito] = useState(false);
  const [assinatura, setAssinatura] = useState("");
  const [confirmacaoCpf, setConfirmacaoCpf] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState<Sucesso | null>(null);

  const [tempoRestante, setTempoRestante] = useState(() => getProximoEncerramento().getTime() - Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setTempoRestante(getProximoEncerramento().getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const [provaSocialIndex, setProvaSocialIndex] = useState(() => Math.floor(Math.random() * NOMES_PROVA_SOCIAL.length));
  const [provaSocialVisivel, setProvaSocialVisivel] = useState(true);
  useEffect(() => {
    let timeoutEsconder: ReturnType<typeof setTimeout>;
    const agendar = () => {
      const delay = 8000 + Math.random() * 4000; // 8 a 12 segundos
      return setInterval(() => {
        setProvaSocialVisivel(false);
        timeoutEsconder = setTimeout(() => {
          setProvaSocialIndex(() => Math.floor(Math.random() * NOMES_PROVA_SOCIAL.length));
          setProvaSocialVisivel(true);
        }, 400);
      }, delay);
    };
    const interval = agendar();
    return () => {
      clearInterval(interval);
      clearTimeout(timeoutEsconder);
    };
  }, []);

  const { data: modelo } = useQuery({
    queryKey: ["contrato-publico"],
    queryFn: async () => {
      const { data } = await supabase
        .from("modelos_contrato" as any)
        .select("id, conteudo_html")
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { id: string; conteudo_html: string } | null;
    },
    enabled: step === 3,
  });

  const dataISO = useMemo(() => parseDateBR(dados.data_nascimento), [dados.data_nascimento]);

  const contratoHtml = useMemo(() => {
    if (!modelo?.conteudo_html || !forma) return "";
    const plano = PLANOS[forma];
    const formaLabel = forma === "boleto" ? "Boleto Bancário" : "Cartão de Crédito";
    let html = modelo.conteudo_html;
    const variables: Record<string, string> = {
      "[NOME_ALUNO]": dados.nome,
      "[CPF_ALUNO]": dados.cpf,
      "[TELEFONE_ALUNO]": dados.telefone,
      "[DATA_NASCIMENTO]": dataISO ? format(new Date(dataISO + "T00:00:00"), "dd/MM/yyyy") : dados.data_nascimento,
      "[PACOTE_NOME]": "Aulão - Lançamento",
      "[FORMA_PAGAMENTO]": formaLabel,
      "[VALOR_ENTRADA]": `R$ ${plano.entrada}`,
      "[VALOR_PARCELA]": `R$ ${plano.valorParc}`,
      "[NUMERO_PARCELAS]": plano.qtdParc,
      "[VALOR_TOTAL]": `R$ ${plano.total}`,
      "[DATA_MATRICULA]": format(new Date(), "dd/MM/yyyy"),
      "[NOME_ESCOLA]": "Soluções Online",
      "[DATA_CONTRATO]": format(new Date(), "dd/MM/yyyy"),
      "[DATA_HOJE]": format(new Date(), "dd/MM/yyyy"),
      "[DATA_PRIMEIRA_PARCELA]": format(new Date(), "dd/MM/yyyy"),
    };
    Object.entries(variables).forEach(([k, v]) => {
      html = html.replaceAll(k, v);
    });
    // remove eventual "R$ R$" duplicado do template
    html = html.replace(/R\$\s*R\$\s*/g, "R$ ");
    return html;
  }, [modelo, dados, forma, dataISO]);

  function validarStep1(): string | null {
    if (!dados.nome.trim() || dados.nome.trim().split(/\s+/).length < 2)
      return "Informe nome completo";
    if (dados.telefone.replace(/\D/g, "").length < 10) return "Telefone inválido";
    if (!isValidCPF(dados.cpf)) return "CPF inválido";
    if (!parseDateBR(dados.data_nascimento)) return "Data de nascimento inválida (use dd/mm/aaaa)";
    return null;

  }

  const handleAvancar1 = () => {
    const err = validarStep1();
    if (err) { toast.error(err); return; }
    setStep(2);
  };

  const handleAvancar2 = () => {
    if (!forma) { toast.error("Selecione uma forma de pagamento"); return; }
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!aceito) { toast.error("Aceite o contrato para continuar"); return; }
    if (assinatura.trim().toLowerCase() !== dados.nome.trim().toLowerCase()) {
      toast.error("Digite seu nome completo exatamente como no cadastro");
      return;
    }
    if (confirmacaoCpf.trim() !== dados.cpf.trim()) {
      toast.error("O CPF de confirmação não confere com o CPF informado no cadastro");
      return;
    }
    if (!dataISO) { toast.error("Data de nascimento inválida"); return; }

    setEnviando(true);
    try {
      const utm = getUtm();
      const { data, error } = await supabase.rpc("criar_matricula_lancamento" as any, {
        p_nome: dados.nome.trim(),
        p_email: null,
        p_telefone: dados.telefone,
        p_cpf: dados.cpf,
        p_data_nascimento: dataISO,
        p_forma_pagamento: forma,
        p_polo_id: POLO_ID_FLORIPA,
        p_utm_source: utm.utm_source,
        p_utm_medium: utm.utm_medium,
        p_utm_campaign: utm.utm_campaign,
        p_utm_content: utm.utm_content,
        p_contrato_html: contratoHtml || null,
        p_assinatura_nome: assinatura.trim() || null,
        p_sexo: null,
      });


      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("Resposta vazia do servidor");

      if (row.ja_existia) {
        toast.error("Você já possui matrícula! Nossa equipe já está com seus dados.", { duration: 8000 });
        setEnviando(false);
        return;
      }

      const formaTxt = forma === "boleto" ? "Boleto" : "Cartão";
      const mensagem = `Nova matrícula de Aulão! 🎉🟠\n👤 Nome: ${dados.nome}\n📱 Telefone: ${dados.telefone}\n💳 Preferência: ${formaTxt}\nContrato assinado: ${assinatura ? "Sim" : "Não"}\nVer detalhes no menu Matrículas Aulão.`;
      try {
        await fetch("/api/public/hooks/zapi-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: WHATSAPP_EQUIPE, message: mensagem }),
        });
      } catch (e) {
        console.warn("Falha ao enviar WhatsApp da equipe", e);
      }

      setSucesso({ jaExistia: false });
    } catch (e: any) {
      toast.error(e.message || "Erro ao processar matrícula");
    } finally {
      setEnviando(false);
    }
  };

  if (sucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold">Matrícula realizada com sucesso!</h1>
            <p className="text-muted-foreground">
              Recebemos seus dados e seu contrato assinado. Você vai receber uma mensagem nossa no WhatsApp
              em instantes, e nossa equipe entrará em contato para alinhar o pagamento e liberar seu acesso
              às aulas.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white px-4 py-6 md:py-10">
      <div className="max-w-2xl mx-auto">
        <img
          src="/banner-matriculas.png"
          alt="Matrículas Abertas — Faça sua matrícula e garanta sua vaga. Vagas limitadas."
          className="mb-6 w-full rounded-lg"
        />

        <div className="mb-4 rounded-lg border-2 border-red-600 bg-red-50 px-4 py-3 text-center">
          <div className="text-xs md:text-sm font-semibold text-red-700 uppercase tracking-wide">
            ⏰ Encerramento das matrículas em
          </div>
          <div className="text-3xl md:text-4xl font-black text-red-600 tabular-nums tracking-wider">
            {formatContagem(tempoRestante)}
          </div>
        </div>

        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-2 w-16 rounded-full ${step >= n ? "bg-orange-500" : "bg-gray-200"}`} />
          ))}
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {step === 1 && (
              <>
                <h2 className="text-xl font-semibold">Seus dados</h2>
                <div className="space-y-3">
                  <div>
                    <Label>Nome completo *</Label>
                    <Input
                      value={dados.nome}
                      onChange={(e) => setDados({ ...dados, nome: e.target.value })}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div>
                    <Label>Telefone (com DDD) *</Label>
                    <Input
                      value={dados.telefone}
                      onChange={(e) => setDados({ ...dados, telefone: maskPhone(e.target.value) })}
                      placeholder="(48) 99999-9999"
                      inputMode="tel"
                    />
                  </div>
                  <div>
                    <Label>CPF *</Label>
                    <Input
                      value={dados.cpf}
                      onChange={(e) => setDados({ ...dados, cpf: maskCPF(e.target.value) })}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <Label>Data de nascimento (dd/mm/aaaa) *</Label>
                    <Input
                      value={dados.data_nascimento}
                      onChange={(e) => setDados({ ...dados, data_nascimento: maskDate(e.target.value) })}
                      placeholder="15/03/1990"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <Button className="w-full" onClick={handleAvancar1}>Avançar</Button>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-xl font-semibold">Forma de pagamento</h2>
                <p className="text-sm text-muted-foreground">
                  Como prefere pagar? Nossa equipe entrará em contato para alinhar as condições.
                </p>
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => setForma("boleto")}
                    className={`border rounded-lg p-4 text-left transition ${forma === "boleto" ? "border-orange-500 bg-orange-50 ring-2 ring-orange-500" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div className="text-3xl mb-1">📄</div>
                    <div className="font-semibold">Boleto Bancário</div>
                    <div className="text-sm text-muted-foreground">1 + 9 parcelas de R$ 159,90</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForma("cartao")}
                    className={`border rounded-lg p-4 text-left transition ${forma === "cartao" ? "border-orange-500 bg-orange-50 ring-2 ring-orange-500" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div className="text-3xl mb-1">💳</div>
                    <div className="font-semibold">Cartão de Crédito</div>
                    <div className="text-sm text-muted-foreground">12x de R$ 119,90</div>
                    <div className="text-sm text-orange-700 font-medium mt-1">
                      ⚡ Nessa opção você conclui tudo em menos tempo — entre 10 e 30 dias
                    </div>
                  </button>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Voltar</Button>
                  <Button onClick={handleAvancar2} className="flex-1">Avançar</Button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="text-xl font-semibold">Contrato de Matrícula</h2>
                <div
                  className="border rounded max-h-80 overflow-y-auto p-4 text-sm bg-gray-50 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: contratoHtml || "<p>Carregando contrato...</p>" }}
                />
                <div className="flex items-start gap-2">
                  <Checkbox id="aceito" checked={aceito} onCheckedChange={(v) => setAceito(!!v)} />
                  <Label htmlFor="aceito" className="text-sm leading-tight">
                    Li e aceito todas as cláusulas do contrato
                  </Label>
                </div>
                <div>
                  <Label>Assinatura digital (digite seu nome completo)</Label>
                  <Input
                    value={assinatura}
                    onChange={(e) => setAssinatura(e.target.value)}
                    placeholder={dados.nome}
                  />
                </div>
                <div>
                  <Label>Confirme seu CPF</Label>
                  <Input
                    value={confirmacaoCpf}
                    onChange={(e) => setConfirmacaoCpf(maskCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1" disabled={enviando}>Voltar</Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={enviando}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {enviando ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>) : (<>✅ Realizar Matrícula</>)}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div
        className={`fixed top-4 left-4 right-4 md:right-auto md:max-w-xs bg-white border border-gray-200 shadow-lg rounded-lg px-4 py-3 flex items-center gap-3 z-50 transition-all duration-300 ${
          provaSocialVisivel ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        }`}
      >
        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold shrink-0">
          {NOMES_PROVA_SOCIAL[provaSocialIndex].nome.charAt(0)}
        </div>
        <div className="text-sm">
          <strong>{NOMES_PROVA_SOCIAL[provaSocialIndex].nome}</strong> — {NOMES_PROVA_SOCIAL[provaSocialIndex].cidade}
          <br />
          <span className="text-muted-foreground">realizou a matrícula agora</span>
        </div>
      </div>
    </div>
  );
}
