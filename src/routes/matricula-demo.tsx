import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { maskPhone } from "@/lib/format";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/matricula-demo")({
  head: () => ({
    meta: [
      { title: "Matrícula (Demonstração) — Soluções Online" },
      { name: "description", content: "Demonstração de como realizar a matrícula no Aulão da Soluções Online" },
    ],
  }),
  component: MatriculaDemoPage,
});

// Página 100% de demonstração — usada durante a aula ao vivo pra mostrar o passo a passo do
// /matricula pro público. Espelha o fluxo real (modal de acesso → voucher → dados → forma de
// pagamento), mas SEM CPF e SEM tocar em banco de dados, Asaas ou qualquer API real: nada aqui
// gera cadastro, cobrança ou aparece no menu Matrículas Aulão.
type Step = 0 | 1 | 2;
type FormaPag = "boleto" | "cartao";

interface DadosAluno {
  nome: string;
  telefone: string;
  data_nascimento: string; // dd/mm/aaaa
}

const VOUCHER_CODE = "1627off";
const PLANOS: Record<FormaPag, { valorParc: string; parcelasExibicao: string }> = {
  boleto: { parcelasExibicao: "1 + 9", valorParc: "159,90" },
  cartao: { parcelasExibicao: "12", valorParc: "259,90" },
};
const PLANO_CARTAO_VOUCHER = { valorParc: "119,90" };

function maskDate(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function getProximoEncerramento(): Date {
  const agora = new Date();
  const meta = new Date(agora);
  meta.setHours(19, 30, 0, 0);
  if (agora >= meta) meta.setDate(meta.getDate() + 1);
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

function MatriculaDemoPage() {
  const [assistiuAula, setAssistiuAula] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [dados, setDados] = useState<DadosAluno>({ nome: "", telefone: "", data_nascimento: "" });
  const [forma, setForma] = useState<FormaPag | null>(null);
  const [printCartao, setPrintCartao] = useState(false);
  const [cartao, setCartao] = useState({ holderName: "", number: "", expiryMonth: "", expiryYear: "", ccv: "" });
  const [parcelasCartao, setParcelasCartao] = useState(12);
  const [voucherCode, setVoucherCode] = useState("");
  const voucherValido = voucherCode.trim().toLowerCase() === VOUCHER_CODE;

  const [tempoRestante, setTempoRestante] = useState(() => getProximoEncerramento().getTime() - Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setTempoRestante(getProximoEncerramento().getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function validarDados(): string | null {
    if (!dados.nome.trim() || dados.nome.trim().split(/\s+/).length < 2) return "Informe nome completo";
    if (dados.telefone.replace(/\D/g, "").length < 10) return "Telefone inválido";
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dados.data_nascimento)) return "Data de nascimento inválida (use dd/mm/aaaa)";
    return null;
  }

  const handleAvancarDados = () => {
    const err = validarDados();
    if (err) { toast.error(err); return; }
    setStep(2);
  };

  // Modal de acesso (Sim/Não assistiu à aula)
  if (assistiuAula === null) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="pt-8 pb-6 space-y-5 text-center">
              <h1 className="text-xl md:text-2xl font-bold">
                Você assistiu à aula ao vivo completa e tem o voucher que foi liberado nela?
              </h1>
              <p className="text-sm text-muted-foreground">
                As vagas dessa matrícula são exclusivas pra quem participou da aula do início ao fim.
              </p>
              <div className="flex gap-3 justify-center pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => setAssistiuAula(false)}
                >
                  Não
                </Button>
                <Button
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                  onClick={() => setAssistiuAula(true)}
                >
                  Sim
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (assistiuAula === false) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="pt-8 pb-6 space-y-4 text-center">
              <h1 className="text-xl font-bold">Infelizmente não é possível fazer a matrícula agora</h1>
              <p className="text-muted-foreground text-sm">
                As vagas dessa turma foram liberadas exclusivamente pra quem assistiu à aula ao vivo e recebeu o
                voucher nela. Fique de olho no nosso grupo/canal pra não perder a próxima aula e garantir sua vaga!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // "Print" da tela real de pagamento no cartão — só pra mostrar como fica pro aluno durante a
  // aula. Os campos são digitáveis (fica mais real na demonstração), mas o botão não processa
  // nada de verdade nem sai dessa tela.
  if (printCartao) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-center">Bem-vindo(a) à Soluções Online! 🎓</h1>
            <p className="text-muted-foreground text-center text-sm">
              Parabéns pela decisão! Você está a um passo de realizar o sonho de concluir seus estudos
              em <strong>menos de 6 meses</strong>. Falta pouco — efetue o pagamento abaixo para garantir sua vaga.
            </p>

            <div className="space-y-3">
              <p className="text-sm font-medium text-center">Pague com cartão de crédito em até 12x:</p>
              <div className="space-y-2">
                <div>
                  <Label>Nome no cartão</Label>
                  <Input
                    value={cartao.holderName}
                    onChange={(e) => setCartao({ ...cartao, holderName: e.target.value })}
                    placeholder="Nome como está no cartão"
                  />
                </div>
                <div>
                  <Label>Número do cartão</Label>
                  <Input
                    value={cartao.number}
                    onChange={(e) => setCartao({ ...cartao, number: e.target.value.replace(/\D/g, "").slice(0, 16) })}
                    placeholder="0000 0000 0000 0000"
                    inputMode="numeric"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Mês</Label>
                    <Input
                      value={cartao.expiryMonth}
                      onChange={(e) => setCartao({ ...cartao, expiryMonth: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                      placeholder="MM"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <Label>Ano</Label>
                    <Input
                      value={cartao.expiryYear}
                      onChange={(e) => setCartao({ ...cartao, expiryYear: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                      placeholder="AAAA"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <Label>CVV</Label>
                    <Input
                      value={cartao.ccv}
                      onChange={(e) => setCartao({ ...cartao, ccv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                      placeholder="123"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <div>
                  <Label>Parcelas</Label>
                  <select
                    value={parcelasCartao}
                    onChange={(e) => setParcelasCartao(Number(e.target.value))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {[12,11,10,9,8,7,6,5,4,3,2,1].map((n) => {
                      const valorParcela = (1438.80 / n).toFixed(2).replace(".", ",");
                      return <option key={n} value={n}>{n}x de R$ {valorParcela} — Sem Juros</option>;
                    })}
                  </select>
                </div>
              </div>
              <Button className="w-full text-base py-5">
                ✅ Confirmar Matrícula
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Assim que confirmado, o acesso às aulas já é liberado na hora, automaticamente.
              </p>
            </div>

            <Button variant="ghost" className="w-full" onClick={() => setPrintCartao(false)}>
              ← Voltar
            </Button>
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
          {[0, 1, 2].map((n) => (
            <div key={n} className={`h-2 w-16 rounded-full ${step >= n ? "bg-orange-500" : "bg-gray-200"}`} />
          ))}
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {step === 0 && (
              <>
                <h2 className="text-xl font-semibold text-center">Comprove sua presença na aula</h2>
                <p className="text-sm text-muted-foreground text-center">
                  Se você realmente esteve presente na aula ao vivo, você recebeu um <strong>código</strong> pra
                  usar aqui. Ele dá direito à bolsa de estudo da Escola Soluções Online pra você concluir seus
                  estudos.
                </p>
                <div className="space-y-1">
                  <Label htmlFor="voucher">Código recebido na aula ao vivo</Label>
                  <Input
                    id="voucher"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    placeholder="Digite seu código aqui"
                    onKeyDown={(e) => e.key === "Enter" && voucherValido && setStep(1)}
                  />
                  {voucherCode.trim() !== "" && !voucherValido && (
                    <p className="text-sm text-red-600">Código inválido — confira e tente de novo</p>
                  )}
                  {voucherValido && (
                    <p className="text-sm text-green-600 font-medium">✅ Código confirmado!</p>
                  )}
                </div>
                <Button
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  disabled={!voucherValido}
                  onClick={() => setStep(1)}
                >
                  Confirmar código
                </Button>
              </>
            )}

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
                    <Label>Data de nascimento (dd/mm/aaaa) *</Label>
                    <Input
                      value={dados.data_nascimento}
                      onChange={(e) => setDados({ ...dados, data_nascimento: maskDate(e.target.value) })}
                      placeholder="15/03/1990"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <Button className="w-full" onClick={handleAvancarDados}>Avançar</Button>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-xl font-semibold">Investimento</h2>
                <div className="text-center bg-gray-50 border rounded-lg py-5 px-4">
                  <p className="text-sm text-muted-foreground mb-1">Preço padrão da escola</p>
                  <p className="text-lg text-muted-foreground line-through">
                    12x de R$ {PLANOS.cartao.valorParc}
                  </p>
                  <p className="text-sm text-green-700 font-semibold mt-1">✅ Bolsa de estudo aplicada</p>
                </div>

                <h2 className="text-xl font-semibold pt-2">Forma de pagamento</h2>
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
                    <div className="text-sm text-muted-foreground">
                      <span className="line-through mr-1">12x de R$ {PLANOS.cartao.valorParc}</span>
                      <span className="text-green-700 font-semibold">12x de R$ {PLANO_CARTAO_VOUCHER.valorParc}</span>
                    </div>
                    <div className="text-sm text-orange-700 font-medium mt-1">
                      ⚡ Nessa opção você conclui tudo em menos tempo — entre 10 e 30 dias
                    </div>
                  </button>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Voltar</Button>
                  <Button
                    onClick={() => {
                      if (!forma) { toast.error("Selecione uma forma de pagamento"); return; }
                      if (forma === "cartao") {
                        // Mostra o "print" de como fica a tela real de pagamento no cartão —
                        // só pra visualização durante a aula, não processa nada de verdade.
                        setPrintCartao(true);
                        return;
                      }
                      // Boleto: demonstração — não gera cobrança nenhuma, a tela permanece a mesma
                      // (evita quebrar o fluxo visual pro público assistindo ao vivo).
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    ✅ Garantir minha vaga
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
