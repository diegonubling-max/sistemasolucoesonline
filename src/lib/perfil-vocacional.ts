export type Segmento = "Administrativo" | "Tecnologia" | "Saúde" | "Beleza" | "Diversos";

export type Pontuacao = Record<Segmento, number>;

export const SEGMENTOS_LISTA: Segmento[] = [
  "Administrativo",
  "Tecnologia",
  "Saúde",
  "Beleza",
  "Diversos",
];

export type Pergunta = {
  id: string;
  texto: string;
  opcoes: {
    id: string;
    label: string;
    emoji?: string;
    delta: Partial<Pontuacao> | "neutro" | "todos" | "principal" | "maior";
  }[];
};

export const PERGUNTAS: Pergunta[] = [
  {
    id: "p1",
    texto: "Qual área mais combina com você hoje?",
    opcoes: [
      { id: "a", emoji: "💼", label: "Trabalhar em escritório ou empresa", delta: { Administrativo: 3 } },
      { id: "b", emoji: "💻", label: "Tecnologia, redes sociais e internet", delta: { Tecnologia: 3 } },
      { id: "c", emoji: "💆", label: "Cuidar de pessoas (saúde ou estética)", delta: { Saúde: 2, Beleza: 2 } },
      { id: "d", emoji: "🔧", label: "Trabalhos práticos e técnicos", delta: { Diversos: 3 } },
      { id: "e", emoji: "🤔", label: "Ainda não sei", delta: "neutro" },
    ],
  },
  {
    id: "p2",
    texto: "O que você mais deseja conquistar?",
    opcoes: [
      { id: "a", label: "Um emprego melhor ou primeira oportunidade", delta: { Administrativo: 2, Diversos: 1 } },
      { id: "b", label: "Abrir meu próprio negócio", delta: { Tecnologia: 2, Administrativo: 2 } },
      { id: "c", label: "Aprender algo novo para crescer", delta: "todos" },
      { id: "d", label: "Mudar de área profissional", delta: { Tecnologia: 1, Beleza: 1 } },
    ],
  },
  {
    id: "p3",
    texto: "Como você prefere aprender?",
    opcoes: [
      { id: "a", label: "Assistindo vídeos no celular", delta: { Tecnologia: 1 } },
      { id: "b", label: "Praticando com ferramentas reais (Excel, Canva, etc.)", delta: { Tecnologia: 3, Administrativo: 2 } },
      { id: "c", label: "Estudando no meu ritmo, sem pressa", delta: "neutro" },
    ],
  },
  {
    id: "p4",
    texto: "Qual dessas áreas você tem mais curiosidade?",
    opcoes: [
      { id: "a", label: "Vendas, atendimento ou marketing", delta: { Administrativo: 3, Tecnologia: 2 } },
      { id: "b", label: "Computadores, design ou redes sociais", delta: { Tecnologia: 3 } },
      { id: "c", label: "Saúde, beleza ou bem-estar", delta: { Saúde: 3, Beleza: 3 } },
      { id: "d", label: "Logística, estoque ou finanças", delta: { Administrativo: 3 } },
      { id: "e", label: "Trabalhos manuais ou técnicos", delta: { Diversos: 3 } },
    ],
  },
  {
    id: "p5",
    texto: "Você já trabalha atualmente?",
    opcoes: [
      { id: "a", label: "Sim, quero crescer na mesma área", delta: "principal" },
      { id: "b", label: "Sim, mas quero mudar de área", delta: { Tecnologia: 1, Diversos: 1 } },
      { id: "c", label: "Não, estou buscando minha primeira oportunidade", delta: { Administrativo: 2, Diversos: 1 } },
    ],
  },
  {
    id: "p6",
    texto: "Qual seu maior objetivo nos próximos 6 meses?",
    opcoes: [
      { id: "a", label: "Conseguir um emprego", delta: { Administrativo: 2, Diversos: 1 } },
      { id: "b", label: "Ganhar mais dinheiro", delta: { Tecnologia: 2, Administrativo: 2 } },
      { id: "c", label: "Ter meu próprio negócio", delta: { Tecnologia: 3, Administrativo: 2 } },
      { id: "d", label: "Me especializar e crescer profissionalmente", delta: "maior" },
    ],
  },
];

export function calcularPontuacao(respostas: Record<string, string>): {
  pontuacao: Pontuacao;
  topSegmentos: Segmento[];
  perfil: string;
} {
  const pontuacao: Pontuacao = {
    Administrativo: 0,
    Tecnologia: 0,
    Saúde: 0,
    Beleza: 0,
    Diversos: 0,
  };

  // Passada 1: aplicar todos os deltas "concretos" e "todos"/"neutro"
  for (const p of PERGUNTAS) {
    const respId = respostas[p.id];
    const opc = p.opcoes.find((o) => o.id === respId);
    if (!opc) continue;
    const d = opc.delta;
    if (d === "neutro") continue;
    if (d === "todos") {
      for (const s of SEGMENTOS_LISTA) pontuacao[s] += 1;
      continue;
    }
    if (d === "principal" || d === "maior") continue;
    for (const [seg, val] of Object.entries(d) as [Segmento, number][]) {
      pontuacao[seg] += val;
    }
  }

  // Passada 2: aplicar "principal" e "maior" (dependem do estado atual)
  for (const p of PERGUNTAS) {
    const respId = respostas[p.id];
    const opc = p.opcoes.find((o) => o.id === respId);
    if (!opc) continue;
    if (opc.delta === "principal" || opc.delta === "maior") {
      const maior = (Object.entries(pontuacao) as [Segmento, number][]).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0];
      if (maior) pontuacao[maior] += opc.delta === "maior" ? 2 : 2;
    }
  }

  const ordenado = (Object.entries(pontuacao) as [Segmento, number][])
    .sort((a, b) => b[1] - a[1]);
  const topSegmentos = ordenado.slice(0, 2).map(([s]) => s);

  const perfilMap: Record<Segmento, string> = {
    Tecnologia: "Especialista Digital 💻",
    Administrativo: "Profissional de Negócios 💼",
    Saúde: "Cuidador de Pessoas 💆",
    Beleza: "Artista da Beleza 💄",
    Diversos: "Profissional Técnico 🔧",
  };

  return { pontuacao, topSegmentos, perfil: perfilMap[topSegmentos[0]] ?? "Profissional em Descoberta ✨" };
}

// Mapa de segmento "lógico" → nome(s) reais na tabela segmentos (busca por ILIKE)
export const SEGMENTO_MATCH: Record<Segmento, string[]> = {
  Administrativo: ["administr"],
  Tecnologia: ["tecnolog"],
  Saúde: ["saúde", "saude"],
  Beleza: ["beleza"],
  Diversos: ["divers"],
};
