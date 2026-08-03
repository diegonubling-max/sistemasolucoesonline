import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_admin/webinars/$id/depoimentos")({
  head: () => ({ meta: [{ title: "Depoimentos da Aula — Soluções Online" }] }),
  component: WebinarDepoimentos,
});

function formatarTempo(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Aceita "3:45", "03:45" ou só segundos "225"
function parseTempo(texto: string): number | null {
  const t = texto.trim();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  const m = t.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function WebinarDepoimentos() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [novoAberto, setNovoAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");
  const [tempo, setTempo] = useState("");

  const { data: webinar } = useQuery({
    queryKey: ["webinar", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("webinars" as any).select("*").eq("id", id).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: depoimentos, isLoading } = useQuery({
    queryKey: ["webinar-depoimentos-replay", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webinar_depoimentos_replay" as any)
        .select("*")
        .eq("webinar_id", id)
        .order("timestamp_segundos", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      const segundos = parseTempo(tempo);
      if (!nome.trim() || !texto.trim() || segundos === null) {
        throw new Error("Preencha nome, depoimento e o tempo (ex: 3:45)");
      }
      const { error } = await supabase.from("webinar_depoimentos_replay" as any).insert({
        webinar_id: id,
        nome: nome.trim(),
        texto: texto.trim(),
        timestamp_segundos: segundos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Depoimento adicionado!");
      qc.invalidateQueries({ queryKey: ["webinar-depoimentos-replay", id] });
      setNovoAberto(false);
      setNome("");
      setTexto("");
      setTempo("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluirMutation = useMutation({
    mutationFn: async (depoimentoId: string) => {
      const { error } = await supabase.from("webinar_depoimentos_replay" as any).delete().eq("id", depoimentoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Depoimento removido");
      qc.invalidateQueries({ queryKey: ["webinar-depoimentos-replay", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={`Depoimentos — ${webinar?.titulo ?? "Aula"}`}
        description="Mensagens reais da aula ao vivo, reproduzidas no minuto exato conforme o aluno assiste a gravação"
        actions={
          <div className="flex gap-2">
            <Link to="/webinars/$id" params={{ id }}>
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
            </Link>
            <Button onClick={() => setNovoAberto(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Depoimento
            </Button>
          </div>
        }
      />

      {!webinar?.gravado && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-800">
          Esse webinar ainda não está marcado como "Aula gravada" — marque essa opção na listagem de Webinars
          pra que os depoimentos abaixo sejam reproduzidos automaticamente pros alunos.
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (depoimentos ?? []).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nenhum depoimento cadastrado ainda. Clique em "Novo Depoimento" pra adicionar as mensagens reais da aula.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Tempo</TableHead>
                  <TableHead className="w-40">Nome</TableHead>
                  <TableHead>Depoimento</TableHead>
                  <TableHead className="text-right w-16">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(depoimentos ?? []).map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-sm">{formatarTempo(d.timestamp_segundos)}</TableCell>
                    <TableCell className="font-medium">{d.nome}</TableCell>
                    <TableCell className="text-sm">{d.texto}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => excluirMutation.mutate(d.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Depoimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Tempo do vídeo (minuto:segundo)</Label>
              <Input value={tempo} onChange={(e) => setTempo(e.target.value)} placeholder="Ex: 3:45" />
            </div>
            <div>
              <Label>Nome de quem comentou</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Maria S." />
            </div>
            <div>
              <Label>Depoimento (mensagem real que a pessoa mandou)</Label>
              <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex: Nossa, muito bom esse conteúdo!" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoAberto(false)}>Cancelar</Button>
            <Button onClick={() => criarMutation.mutate()} disabled={criarMutation.isPending}>
              {criarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
