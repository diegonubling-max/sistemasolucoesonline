import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, GraduationCap, Send, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { sendWhatsApp } from "@/services/zApiService";

type PerfilKey = "beleza" | "digital" | "negocios" | "tecnico" | "geral" | "todos";

const PERFIL_LABEL: Record<PerfilKey, string> = {
  beleza: "💄 Artista da Beleza",
  digital: "💻 Especialista Digital",
  negocios: "💼 Profissional de Negócios",
  tecnico: "🔧 Profissional Técnico",
  geral: "📚 Geral (alunos sem perfil)",
  todos: "🚀 Todos os perfis",
};

// Corresponde ao valor gravado em aluno_perfil_vocacional.perfil_identificado
const PERFIL_MATCH: Record<Exclude<PerfilKey, "geral" | "todos">, string> = {
  beleza: "Artista da Beleza",
  digital: "Especialista Digital",
  negocios: "Profissional de Negócios",
  tecnico: "Profissional Técnico",
};

const MENSAGENS: Record<Exclude<PerfilKey, "todos">, string> = {
  beleza: `Oi, [nome]! 👋

Você tem um perfil incrível para a área de beleza e saúde — e eu tenho uma oportunidade que combina muito com você! 💄✨

Olha o que separei especialmente para você:

🔹 Atendente de Farmácia
🔹 Canva
🔹 Instagram para Vendas

Imagina ter esses certificados no currículo e ainda usar o Instagram para atrair muito mais clientes? 🚀

✅ Taxa única a partir de *R$ 47*
✅ Sem mensalidade
✅ Certificado incluído
✅ Acesso imediato

É o menor investimento com o maior retorno para a sua carreira! 💰

Quer saber mais? Me responde aqui! 👇`,
  digital: `Oi, [nome]! 👋

O mercado digital está contratando como nunca — e quem tem certificado na área sai na frente de todo mundo! 🔥

Com o seu perfil, você tem tudo para se destacar em:

🔹 Marketing Digital
🔹 Instagram para Vendas
🔹 Inteligência Artificial
🔹 Criação de Sites WordPress
🔹 Canva

Imagina colocar tudo isso no seu currículo ainda esse mês? 😍

✅ Taxa única a partir de *R$ 47*
✅ Sem mensalidade
✅ Certificado incluído
✅ Acesso imediato

Você investe uma vez e o conhecimento é seu para sempre! 🎓

Qual desses cursos você quer começar primeiro? Me responde aqui! 👇`,
  negocios: `Oi, [nome]! 👋

Você sabia que profissionais de negócios que dominam as ferramentas certas ganham em média 40% a mais no mercado? 💰

Olha o que separei especialmente para o seu perfil:

🔹 Excel Avançado
🔹 Power BI
🔹 Departamento Pessoal
🔹 Gestão em RH
🔹 Empreendedorismo
🔹 Contabilidade

Um investimento pequeno com retorno enorme na sua carreira!

✅ Taxa única a partir de *R$ 47*
✅ Sem mensalidade
✅ Certificado incluído
✅ Acesso imediato

Bora turbinar seu currículo? Me fala qual desperta mais seu interesse! 👇`,
  tecnico: `Oi, [nome]! 👋

Tenho uma novidade que pode mudar o seu currículo ainda essa semana! 🚀

Com base no seu perfil, selecionei os cursos que combinam exatamente com você:

🔹 AutoCAD 2D e 3D
🔹 Excel Básico e Avançado
🔹 Power BI
🔹 Inteligência Artificial

São as habilidades mais buscadas pelas empresas hoje — e quem tem no currículo sai na frente *sempre!*

✅ Taxa única a partir de *R$ 47*
✅ Sem mensalidade
✅ Certificado incluído
✅ Acesso imediato

Você paga uma vez e o curso é seu para sempre! 🎓

Qual desses desperta mais seu interesse? Me responde aqui! 👇`,
  geral: `Oi, [nome]! 👋

Tenho uma novidade que poucos alunos ainda sabem! 🎓

Além do seu curso EJA, você tem acesso a uma vitrine completa com mais de 20 cursos profissionalizantes:

💼 Negócios e Administração
💻 Tecnologia e Digital
💄 Beleza e Saúde
📊 Finanças e Contabilidade

Tudo com certificado reconhecido e sem complicação!

✅ Taxa única a partir de *R$ 47*
✅ Sem mensalidade
✅ Certificado incluído
✅ Acesso imediato

Quer que eu te mande a lista completa com os cursos e preços? É só responder aqui! 👇`,
};

function primeiroNomeFmt(nome: string): string {
  const p = (nome || "").trim().split(/\s+/)[0] || "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "";
}

function limparTelefone(tel: string): string {
  return (tel || "").replace(/\D/g, "");
}

type AlunoRow = { id: string; nome: string; telefone: string | null; perfil: string | null };

export function OfertaCursosModal() {
  const [open, setOpen] = useState(false);
  const [perfil, setPerfil] = useState<PerfilKey | null>(null);
  const [enviando, setEnviando] = useState(false);

  const { data: alunos, isLoading } = useQuery({
    queryKey: ["oferta-cursos-alunos"],
    enabled: open,
    queryFn: async () => {
      const { data: baseAlunos, error } = await supabase
        .from("alunos")
        .select("id, nome, telefone, ativo, status")
        .eq("ativo", true)
        .neq("status", "trancado")
        .neq("status", "inativo");
      if (error) throw error;
      const ids = (baseAlunos ?? []).map((a: any) => a.id);
      const { data: perfis } = await supabase
        .from("aluno_perfil_vocacional")
        .select("aluno_id, perfil_identificado")
        .in("aluno_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const perfilMap = new Map<string, string | null>();
      (perfis ?? []).forEach((p: any) => perfilMap.set(p.aluno_id, p.perfil_identificado ?? null));
      return (baseAlunos ?? []).map((a: any) => ({
        id: a.id,
        nome: a.nome,
        telefone: a.telefone,
        perfil: perfilMap.get(a.id) ?? null,
      })) as AlunoRow[];
    },
  });

  function filtrarPorPerfil(key: Exclude<PerfilKey, "todos">, list: AlunoRow[]): AlunoRow[] {
    if (key === "geral") return list.filter((a) => !a.perfil);
    const match = PERFIL_MATCH[key];
    return list.filter((a) => (a.perfil || "").includes(match));
  }

  const grupos = useMemo(() => {
    const list = alunos ?? [];
    return {
      beleza: filtrarPorPerfil("beleza", list),
      digital: filtrarPorPerfil("digital", list),
      negocios: filtrarPorPerfil("negocios", list),
      tecnico: filtrarPorPerfil("tecnico", list),
      geral: filtrarPorPerfil("geral", list),
    };
  }, [alunos]);

  const previewCount = useMemo(() => {
    if (!perfil) return 0;
    if (perfil === "todos") {
      return Object.values(grupos).reduce((s, g) => s + g.length, 0);
    }
    return grupos[perfil].length;
  }, [perfil, grupos]);

  async function disparar() {
    if (!perfil) return;
    // Verifica toggle global
    const { data: cfg } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "zapi_global_ativo")
      .maybeSingle();
    if (cfg && cfg.valor === "false") {
      toast.error("Z-API está desativado globalmente.");
      return;
    }

    setEnviando(true);
    let total = 0;
    let erros = 0;

    async function enviarGrupo(key: Exclude<PerfilKey, "todos">, list: AlunoRow[]) {
      const template = MENSAGENS[key];
      for (const a of list) {
        if (!a.telefone) continue;
        const tel = limparTelefone(a.telefone);
        if (!tel) continue;
        const msg = template.replace(/\[nome\]/g, primeiroNomeFmt(a.nome));
        try {
          await sendWhatsApp(tel, msg, {
            alunoId: a.id,
            tipo: `oferta_cursos_${key}` as any,
          });
          total++;
        } catch {
          erros++;
        }
      }
    }

    try {
      if (perfil === "todos") {
        for (const k of ["beleza", "digital", "negocios", "tecnico", "geral"] as const) {
          await enviarGrupo(k, grupos[k]);
        }
      } else {
        await enviarGrupo(perfil, grupos[perfil]);
      }
      toast.success(
        `${total} mensagem(ns) enviada(s) com sucesso${erros ? ` — ${erros} erro(s)` : ""}.`,
      );
      setOpen(false);
      setPerfil(null);
    } catch (e: any) {
      toast.error("Erro no disparo: " + (e?.message ?? String(e)));
    } finally {
      setEnviando(false);
    }
  }

  const previewMsg = perfil && perfil !== "todos" ? MENSAGENS[perfil] : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setPerfil(null);
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">
          <GraduationCap className="h-4 w-4 mr-2" />
          🎓 Oferta Cursos Profissionalizantes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🎓 Oferta de Cursos Profissionalizantes</DialogTitle>
          <DialogDescription>
            Selecione um perfil para pré-visualizar e disparar a mensagem via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando alunos...
          </div>
        ) : !perfil ? (
          <div className="grid gap-2">
            {(Object.keys(PERFIL_LABEL) as PerfilKey[]).map((k) => {
              const count =
                k === "todos"
                  ? Object.values(grupos).reduce((s, g) => s + g.length, 0)
                  : grupos[k].length;
              return (
                <Card
                  key={k}
                  onClick={() => setPerfil(k)}
                  className="p-4 cursor-pointer hover:border-primary hover:bg-muted/40 transition flex items-center justify-between"
                >
                  <span className="font-medium">{PERFIL_LABEL[k]}</span>
                  <span className="text-sm text-muted-foreground">{count} aluno(s)</span>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setPerfil(null)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <span className="text-sm">
                <strong>{PERFIL_LABEL[perfil]}</strong> — {previewCount} aluno(s)
              </span>
            </div>

            {perfil === "todos" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Uma mensagem personalizada será enviada para cada perfil:
                </p>
                <ul className="text-sm space-y-1">
                  {(Object.keys(grupos) as (keyof typeof grupos)[]).map((k) => (
                    <li key={k} className="flex justify-between border rounded px-3 py-2">
                      <span>{PERFIL_LABEL[k as PerfilKey]}</span>
                      <span className="text-muted-foreground">{grupos[k].length} aluno(s)</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-72 overflow-y-auto">
                {previewMsg?.replace(/\[nome\]/g, "[Nome do aluno]")}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={enviando}>
                Cancelar
              </Button>
              <Button
                onClick={disparar}
                disabled={enviando || previewCount === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                {enviando ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Disparar agora ({previewCount})
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
