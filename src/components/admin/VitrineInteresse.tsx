import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, MessageCircle, User, Trash2 } from "lucide-react";
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

interface Props {
  selectedPoloId: string;
  colabPoloId?: string | null;
  isSuperAdmin: boolean;
}


export function VitrineInteresse({ selectedPoloId, colabPoloId, isSuperAdmin }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();
  const canDelete = isSuperAdmin || user?.email === "diegonubling@gmail.com";

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

  const excluirAluno = useMutation({
    mutationFn: async (alunoId: string) => {
      const { error } = await supabase.rpc("delete_aluno_completo", { p_aluno_id: alunoId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aluno excluído com sucesso!");
      qc.invalidateQueries({ queryKey: ["vitrine-cliques"] });
    },
    onError: (e: any) => toast.error("Erro ao excluir aluno", { description: e.message }),
  });

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
          <ul className="divide-y">
            {cliques.map((c: any) => {
              const dt = new Date(c.clicado_em);
              const hora = format(dt, "HH:mm");
              const dataFmt = format(dt, "dd/MM/yyyy", { locale: ptBR });
              const aluno = c.alunos?.nome ?? "Aluno";
              const curso = c.cursos?.nome ?? "curso";
              const alunoId = c.alunos?.id;
              const telefone = c.alunos?.telefone;
              const telefoneLimpo = telefone ? telefone.replace(/\D/g, "") : "";
              const mensagem = encodeURIComponent(
                `Olá ${aluno}! Vi que você se interessou pelo curso ${curso}. Posso te ajudar com mais informações?`
              );
              const waLink = telefoneLimpo
                ? `https://wa.me/55${telefoneLimpo}?text=${mensagem}`
                : null;

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
                    {waLink && (
                      <a href={waLink} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="h-8 gap-1 bg-green-600 hover:bg-green-700 text-white">
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </Button>
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
