import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, MessageCircle, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  selectedPoloId: string;
  colabPoloId?: string | null;
  isSuperAdmin: boolean;
}

export function VitrineInteresse({ selectedPoloId, colabPoloId, isSuperAdmin }: Props) {
  const [expanded, setExpanded] = useState(false);

  const effectivePolo = isSuperAdmin
    ? (selectedPoloId !== "all" ? selectedPoloId : null)
    : (colabPoloId ?? null);

  const { data: cliques } = useQuery({
    queryKey: ["vitrine-cliques", effectivePolo, expanded],
    queryFn: async () => {
      let q = supabase
        .from("vitrine_cliques")
        .select("id, clicado_em, polo_id, alunos(nome), cursos(nome)")
        .order("clicado_em", { ascending: false })
        .limit(expanded ? 200 : 20);
      if (effectivePolo) q = q.eq("polo_id", effectivePolo);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
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
              return (
                <li key={c.id} className="px-6 py-3 text-sm hover:bg-gray-50">
                  <span className="font-medium">{aluno}</span>{" "}clicou em{" "}
                  <span className="font-medium text-primary">{curso}</span>{" "}
                  <span className="text-muted-foreground">às {hora} de {dataFmt}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
