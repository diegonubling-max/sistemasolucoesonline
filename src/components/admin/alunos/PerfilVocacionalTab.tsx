import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, CheckCircle2, BookOpen, Star } from "lucide-react";
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

const MAX_SEL = 5;
const MIN_SEL = 3;

export function PerfilVocacionalTab({ alunoId }: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
      const { data: segs } = await supabase.from("segmentos").select("id, nome");
      const segsRel = (segs ?? []).filter((s) =>
        segmentosRecomendados.some((rec) =>
          SEGMENTO_MATCH[rec]?.some((m) => s.nome.toLowerCase().includes(m))
        )
      );
      const segIds = segsRel.map((s) => s.id);
      if (segIds.length === 0) return [] as any[];
      // segmento prioritário = primeiro recomendado
      const primaria = segmentosRecomendados[0];
      const idsPrim = new Set(
        segsRel
          .filter((s) =>
            SEGMENTO_MATCH[primaria]?.some((m) => s.nome.toLowerCase().includes(m))
          )
          .map((s) => s.id)
      );
      const { data: cursos } = await supabase
        .from("cursos")
        .select("id, nome, segmento_id")
        .in("segmento_id", segIds);
      const list = (cursos ?? []).map((c) => ({
        ...c,
        prioritario: idsPrim.has(c.segmento_id),
      }));
      // ordenar prioritários primeiro
      list.sort((a, b) => Number(b.prioritario) - Number(a.prioritario));
      return list;
    },
  });

  const { data: jaLiberados } = useQuery({
    queryKey: ["aluno-vitrine-ids", alunoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cursos_vitrine")
        .select("curso_id")
        .eq("aluno_id", alunoId);
      return new Set((data ?? []).map((d) => d.curso_id));
    },
  });

  // Top 3 destacados ⭐ = 3 primeiros prioritários
  const top3Ids = useMemo(() => {
    const ids = (cursosSugeridos ?? [])
      .filter((c: any) => c.prioritario)
      .slice(0, 3)
      .map((c: any) => c.id);
    // se faltar, completa com os primeiros não prioritários
    if (ids.length < 3) {
      for (const c of cursosSugeridos ?? []) {
        if (ids.length >= 3) break;
        if (!ids.includes(c.id)) ids.push(c.id);
      }
    }
    return new Set(ids);
  }, [cursosSugeridos]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_SEL) {
          toast.warning("Máximo de 5 cursos por aluno");
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const liberarVitrine = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected).filter((id) => !jaLiberados?.has(id));
      if (ids.length === 0) return 0;
      const payload = ids.map((curso_id) => ({
        aluno_id: alunoId,
        curso_id,
        ativo: true,
        max_parcelas: 12,
      }));
      const { error } = await supabase.from("cursos_vitrine").insert(payload);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(
        n === 0 ? "Cursos selecionados já estavam na vitrine" : `${n} curso(s) liberado(s) na vitrine!`
      );
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["aluno-vitrine-ids", alunoId] });
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

  const canLiberar = selected.size >= MIN_SEL && selected.size <= MAX_SEL;

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
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Cursos sugeridos ({cursosSugeridos?.length ?? 0})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Selecione de {MIN_SEL} a {MAX_SEL} cursos. ⭐ = mais indicados.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {selected.size}/{MAX_SEL} selecionados
            </span>
            <Button
              onClick={() => liberarVitrine.mutate()}
              disabled={liberarVitrine.isPending || !canLiberar}
              className="bg-green-600 hover:bg-green-700"
            >
              {liberarVitrine.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Liberar cursos selecionados na Vitrine
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {cursosSugeridos && cursosSugeridos.length > 0 ? (
            <ul className="divide-y">
              {cursosSugeridos.map((c: any) => {
                const isTop = top3Ids.has(c.id);
                const liberado = jaLiberados?.has(c.id);
                const checked = selected.has(c.id);
                return (
                  <li key={c.id} className="py-2 flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={checked}
                      disabled={liberado}
                      onCheckedChange={() => toggle(c.id)}
                    />
                    {isTop && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />}
                    <span className={`flex-1 ${liberado ? "text-muted-foreground" : ""}`}>
                      {c.nome}
                    </span>
                    {liberado && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Já liberado
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum curso encontrado para estes segmentos.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
