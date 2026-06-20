import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, CheckCircle2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { SEGMENTO_MATCH, type Segmento } from "@/lib/perfil-vocacional";
import { formatDate } from "@/lib/format";

interface Props {
  alunoId: string;
}

const SEG_COLORS: Record<string, string> = {
  Administrativo: "bg-blue-100 text-blue-700 border-blue-200",
  Tecnologia: "bg-purple-100 text-purple-700 border-purple-200",
  Saúde: "bg-green-100 text-green-700 border-green-200",
  Beleza: "bg-pink-100 text-pink-700 border-pink-200",
  Diversos: "bg-amber-100 text-amber-700 border-amber-200",
};

export function PerfilVocacionalTab({ alunoId }: Props) {
  const qc = useQueryClient();

  const { data: perfil, isLoading } = useQuery({
    queryKey: ["perfil-vocacional", alunoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("aluno_perfil_vocacional")
        .select("*")
        .eq("aluno_id", alunoId)
        .maybeSingle();
      return data;
    },
  });

  const segmentosRecomendados = (perfil?.segmentos_recomendados ?? []) as Segmento[];

  const { data: cursosSugeridos } = useQuery({
    queryKey: ["cursos-por-segmentos", segmentosRecomendados],
    enabled: segmentosRecomendados.length > 0,
    queryFn: async () => {
      // Buscar segmentos cujo nome casa com os recomendados
      const { data: segs } = await supabase.from("segmentos").select("id, nome");
      const segIds = (segs ?? [])
        .filter((s) =>
          segmentosRecomendados.some((rec) =>
            SEGMENTO_MATCH[rec]?.some((m) => s.nome.toLowerCase().includes(m))
          )
        )
        .map((s) => s.id);
      if (segIds.length === 0) return [];
      const { data: cursos } = await supabase
        .from("cursos")
        .select("id, nome, segmento_id, preco")
        .in("segmento_id", segIds);
      return cursos ?? [];
    },
  });

  const liberarVitrine = useMutation({
    mutationFn: async () => {
      if (!cursosSugeridos || cursosSugeridos.length === 0) {
        throw new Error("Nenhum curso sugerido para liberar");
      }
      // Cursos já na vitrine deste aluno
      const { data: existentes } = await supabase
        .from("cursos_vitrine")
        .select("curso_id")
        .eq("aluno_id", alunoId);
      const jaTem = new Set((existentes ?? []).map((e) => e.curso_id));
      const novos = cursosSugeridos.filter((c) => !jaTem.has(c.id));
      if (novos.length === 0) return 0;
      const payload = novos.map((c) => ({
        aluno_id: alunoId,
        curso_id: c.id,
        ativo: true,
        preco_pix: (c as any).preco ?? null,
        preco_cartao: (c as any).preco ?? null,
        max_parcelas: 12,
      }));
      const { error } = await supabase.from("cursos_vitrine").insert(payload);
      if (error) throw error;
      return novos.length;
    },
    onSuccess: (n) => {
      toast.success(
        n === 0 ? "Todos os cursos sugeridos já estavam na vitrine" : `${n} curso(s) liberado(s) na vitrine do aluno!`
      );
      qc.invalidateQueries({ queryKey: ["aluno-vitrine", alunoId] });
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!perfil) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>Aluno ainda não preencheu o questionário</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-[#1E3A5F] to-[#2D6ADF] text-white border-0">
        <CardContent className="py-8 text-center space-y-2">
          <Sparkles className="h-8 w-8 mx-auto" />
          <p className="text-sm uppercase tracking-wider opacity-80">Perfil identificado</p>
          <h2 className="text-3xl font-bold">{perfil.perfil_identificado}</h2>
          <p className="text-xs opacity-70">
            Preenchido em {formatDate(perfil.created_at as string)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Segmentos recomendados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {segmentosRecomendados.map((s) => (
            <Badge key={s} variant="outline" className={SEG_COLORS[s] ?? ""}>
              {s}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Cursos sugeridos ({cursosSugeridos?.length ?? 0})
          </CardTitle>
          <Button
            onClick={() => liberarVitrine.mutate()}
            disabled={liberarVitrine.isPending || !cursosSugeridos?.length}
            className="bg-green-600 hover:bg-green-700"
          >
            {liberarVitrine.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Liberar cursos recomendados na Vitrine
          </Button>
        </CardHeader>
        <CardContent>
          {cursosSugeridos && cursosSugeridos.length > 0 ? (
            <ul className="divide-y">
              {cursosSugeridos.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                  <span>{c.nome}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum curso encontrado para estes segmentos.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
