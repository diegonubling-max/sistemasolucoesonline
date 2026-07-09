import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, MessageCircle, User, Trash2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  selectedPoloId: string;
  colabPoloId?: string | null;
  isSuperAdmin: boolean;
}

const SENT_KEY = "vitrine_whats_enviados";
function getSentSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(SENT_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function markSent(id: string) {
  const s = getSentSet();
  s.add(id);
  localStorage.setItem(SENT_KEY, JSON.stringify([...s]));
}

function primeiroNome(nome: string) {
  const p = (nome || "").trim().split(/\s+/)[0] || "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "";
}

function buildMensagem(nome: string, curso: string) {
  return `Olá ${primeiroNome(nome)}! 👋
Vimos que você demonstrou interesse no curso de ${curso}! 📚
Ficou com alguma dúvida sobre o curso? Estamos aqui pra te ajudar! 😊
Responda essa mensagem que te explicamos tudo! 🚀`;
}

async function enviarWhatsVitrine(telefone: string, mensagem: string) {
  let tel = (telefone || "").replace(/\D/g, "");
  if (!tel.startsWith("55")) tel = "55" + tel;
  const response = await fetch(
    "https://api.z-api.io/instances/3F4CC1DC22AB31BDE17ECE717FF40C71/token/E55BC981D8AA6846EAFEAEE4/send-text",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": "F2ffd89a74df2440aad10b65315696d0eS",
      },
      body: JSON.stringify({ phone: tel, message: mensagem }),
    },
  );
  return response.ok;
}

export function VitrineInteresse({ selectedPoloId, colabPoloId, isSuperAdmin }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();
  const canDelete = isSuperAdmin || user?.email === "diegonubling@gmail.com";

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [ctx, setCtx] = useState<{
    cliqueId: string;
    alunoId: string;
    nome: string;
    telefone: string;
    curso: string;
  } | null>(null);
  const [sentTick, setSentTick] = useState(0);
  const sentSet = getSentSet();

  const effectivePolo = isSuperAdmin
    ? (selectedPoloId !== "all" ? selectedPoloId : null)
    : (colabPoloId ?? null);

  const { data: cliques } = useQuery({
    queryKey: ["vitrine-cliques", effectivePolo, expanded],
    queryFn: async () => {
      let q = supabase
        .from("vitrine_cliques")
        .select("id, clicado_em, polo_id, alunos(id, nome, telefone), cursos(nome)")
        .order("clicado_em", { ascending: false })
        .limit(expanded ? 200 : 20);
      if (effectivePolo) q = q.eq("polo_id", effectivePolo);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const excluirClique = useMutation({
    mutationFn: async (cliqueId: string) => {
      const { error } = await supabase.from("vitrine_cliques").delete().eq("id", cliqueId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Interesse removido!");
      qc.invalidateQueries({ queryKey: ["vitrine-cliques"] });
    },
    onError: (e: any) => toast.error("Erro ao remover", { description: e.message }),
  });

  function abrirModal(c: any) {
    const aluno = c.alunos?.nome ?? "Aluno";
    const curso = c.cursos?.nome ?? "curso";
    setCtx({
      cliqueId: c.id,
      alunoId: c.alunos?.id,
      nome: aluno,
      telefone: c.alunos?.telefone || "",
      curso,
    });
    setMensagem(buildMensagem(aluno, curso));
    setEditando(false);
    setModalOpen(true);
  }

  async function handleEnviar() {
    if (!ctx) return;
    if (!ctx.telefone) {
      toast.error("Aluno sem telefone cadastrado");
      return;
    }
    setEnviando(true);
    try {
      const ok = await enviarWhatsVitrine(ctx.telefone, mensagem);
      if (!ok) throw new Error("falha");
      toast.success(`✅ WhatsApp enviado para ${primeiroNome(ctx.nome)}!`);
      markSent(ctx.cliqueId);
      setSentTick((t) => t + 1);
      setModalOpen(false);
    } catch {
      toast.error("❌ Erro ao enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="mb-8">
      <CardHeader className="bg-gray-50/50 border-b border-gray-100 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          Interesse na Vitrine
        </CardTitle>
        {cliques && cliques.length >= 20 && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Recolher" : "Ver todos"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {(!cliques || cliques.length === 0) ? (
          <p className="text-center text-muted-foreground py-8 italic">Nenhum clique registrado ainda.</p>
        ) : (
          <ul className="divide-y" key={sentTick}>
            {cliques.map((c: any) => {
              const dt = new Date(c.clicado_em);
              const hora = format(dt, "HH:mm");
              const dataFmt = format(dt, "dd/MM/yyyy", { locale: ptBR });
              const aluno = c.alunos?.nome ?? "Aluno";
              const curso = c.cursos?.nome ?? "curso";
              const alunoId = c.alunos?.id;
              const telefone = c.alunos?.telefone;
              const jaEnviado = sentSet.has(c.id);

              return (
                <li key={c.id} className="px-6 py-3 text-sm hover:bg-gray-50 flex items-center justify-between gap-3">
                  <span>
                    <span className="font-medium">{aluno}</span>{" "}clicou em{" "}
                    <span className="font-medium text-primary">{curso}</span>{" "}
                    <span className="text-muted-foreground">às {hora} de {dataFmt}</span>
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {alunoId && (
                      <Link to="/alunos/$id" params={{ id: alunoId }}>
                        <Button variant="outline" size="sm" className="h-8 gap-1">
                          <User className="h-4 w-4" />
                          Ver aluno
                        </Button>
                      </Link>
                    )}
                    {telefone && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          onClick={() => abrirModal(c)}
                          className={`h-8 gap-1 text-white ${
                            jaEnviado
                              ? "bg-gray-400 hover:bg-gray-500"
                              : "bg-green-600 hover:bg-green-700"
                          }`}
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </Button>
                        {jaEnviado && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      </div>
                    )}
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive" className="h-8 w-8 p-0">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover interesse?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover este registro de interesse de {aluno} no curso {curso}? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => excluirClique.mutate(c.id)}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar WhatsApp para {ctx?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Curso: </span>
              <span className="font-medium">{ctx?.curso}</span>
            </div>
            <div>
              <Label className="text-sm">Mensagem</Label>
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                readOnly={!editando}
                rows={8}
                className="mt-1 font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={() => setEditando((v) => !v)} disabled={enviando}>
              ✏️ {editando ? "Concluir edição" : "Editar"}
            </Button>
            <Button
              onClick={handleEnviar}
              disabled={enviando}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              📤 {enviando ? "Enviando..." : "Enviar WhatsApp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
