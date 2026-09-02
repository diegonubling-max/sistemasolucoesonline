import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Radio, Users, Copy, Trash2, MessageSquareText, CopyPlus, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_admin/webinars/")({
  head: () => ({ meta: [{ title: "Webinars — Soluções Online" }] }),
  component: WebinarsList,
});

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  agendado: { label: "Agendado", className: "bg-gray-100 text-gray-700" },
  ao_vivo: { label: "🔴 Ao Vivo", className: "bg-red-100 text-red-700" },
  encerrado: { label: "Encerrado", className: "bg-gray-200 text-gray-500" },
};

function WebinarsList() {
  const qc = useQueryClient();
  const [novoAberto, setNovoAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [gravado, setGravado] = useState(false);
  const [modoAcesso, setModoAcesso] = useState<"youtube" | "interno">("youtube");
  const [excluirAlvo, setExcluirAlvo] = useState<{ id: string; titulo: string } | null>(null);
  const [duplicarAlvo, setDuplicarAlvo] = useState<any | null>(null);
  const [tituloDuplicado, setTituloDuplicado] = useState("");

  const { data: webinars, isLoading } = useQuery({
    queryKey: ["webinars"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webinars" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 15000,
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("webinars" as any).insert({ titulo, youtube_url: youtubeUrl, gravado, modo_acesso: modoAcesso });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Webinar criado!");
      qc.invalidateQueries({ queryKey: ["webinars"] });
      setNovoAberto(false);
      setTitulo("");
      setYoutubeUrl("");
      setGravado(false);
      setModoAcesso("youtube");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "ao_vivo") patch.iniciado_em = new Date().toISOString();
      if (status === "encerrado") patch.encerrado_em = new Date().toISOString();
      const { error } = await supabase.from("webinars" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webinars"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const gravadoMutation = useMutation({
    mutationFn: async ({ id, gravado }: { id: string; gravado: boolean }) => {
      const { error } = await supabase.from("webinars" as any).update({ gravado }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webinars"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const modoAcessoMutation = useMutation({
    mutationFn: async ({ id, modo_acesso }: { id: string; modo_acesso: "youtube" | "interno" }) => {
      const { error } = await supabase.from("webinars" as any).update({ modo_acesso }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webinars"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const excluirMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webinars" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Webinar excluído");
      qc.invalidateQueries({ queryKey: ["webinars"] });
      setExcluirAlvo(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Duplicar (01/09/2026) — o Diego mantém um webinar "molde" pronto (link do vídeo certo +
  // depoimentos já importados) e nunca clica em Iniciar nele. Toda vez que precisa de um novo
  // pra usar/testar, duplica esse molde — cria um webinar novo com o mesmo link/config e copia
  // todos os depoimentos, sem precisar recriar nada nem pedir ajuda.
  const duplicarMutation = useMutation({
    mutationFn: async ({ original, novoTitulo }: { original: any; novoTitulo: string }) => {
      const { data: novo, error } = await supabase
        .from("webinars" as any)
        .insert({
          titulo: novoTitulo,
          youtube_url: original.youtube_url,
          gravado: original.gravado,
          modo_acesso: original.modo_acesso,
          status: "agendado",
        })
        .select("id")
        .single();
      if (error) throw error;

      const { data: depoimentos, error: depError } = await supabase
        .from("webinar_depoimentos_replay" as any)
        .select("nome, texto, timestamp_segundos")
        .eq("webinar_id", original.id);
      if (depError) throw depError;

      if (depoimentos && depoimentos.length > 0) {
        const linhas = (depoimentos as any[]).map((d) => ({ ...d, webinar_id: (novo as any).id }));
        const { error: insertError } = await supabase.from("webinar_depoimentos_replay" as any).insert(linhas);
        if (insertError) throw insertError;
      }
      return { total: depoimentos?.length ?? 0 };
    },
    onSuccess: ({ total }) => {
      toast.success(`Webinar duplicado! ${total} depoimentos copiados.`);
      qc.invalidateQueries({ queryKey: ["webinars"] });
      setDuplicarAlvo(null);
      setTituloDuplicado("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const copiarLink = (id: string) => {
    const link = `${window.location.origin}/webinar/${id}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Webinars"
        description="Aulas ao vivo com chat, contador de presença e monitoramento em tempo real"
        actions={
          <Button onClick={() => setNovoAberto(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Webinar
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(webinars ?? []).map((w: any) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">
                      {w.titulo}
                      {w.protegido && (
                        <Badge className="ml-2 align-middle bg-gray-700 text-white" title="Molde protegido — duplique em vez de excluir ou editar">
                          🔒 Molde
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (w.gravado && !window.confirm(
                            `Desmarcar "${w.titulo}" como gravado desliga TODA a simulação de aula ao vivo (depoimentos, contador de espectadores, salto pro minuto certo). Tem certeza?`
                          )) return;
                          gravadoMutation.mutate({ id: w.id, gravado: !w.gravado });
                        }}
                        title={w.gravado ? "Clique pra desmarcar como gravada" : "Clique pra marcar como aula gravada"}
                      >
                        <Badge className={`ml-2 align-middle cursor-pointer ${w.gravado ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
                          🎥 {w.gravado ? "Gravado" : "Marcar como gravado"}
                        </Badge>
                      </button>
                      <button
                        type="button"
                        onClick={() => modoAcessoMutation.mutate({ id: w.id, modo_acesso: w.modo_acesso === "interno" ? "youtube" : "interno" })}
                        title="Clique pra trocar entre app do YouTube e player interno do sistema"
                      >
                        <Badge className={`ml-2 align-middle cursor-pointer ${w.modo_acesso === "interno" ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"}`}>
                          {w.modo_acesso === "interno" ? "💻 Sistema" : "📺 App YouTube"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_LABEL[w.status]?.className}>
                        {STATUS_LABEL[w.status]?.label ?? w.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(w.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" title="Copiar link pro aluno" onClick={() => copiarLink(w.id)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Link to="/webinars/$id" params={{ id: w.id }}>
                        <Button size="icon" variant="ghost" title="Monitorar ao vivo">
                          <Users className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link to="/webinars/$id/depoimentos" params={{ id: w.id }}>
                        <Button size="icon" variant="ghost" title="Depoimentos da aula (replay)">
                          <MessageSquareText className="h-4 w-4" />
                        </Button>
                      </Link>
                      {w.status === "agendado" && (
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => statusMutation.mutate({ id: w.id, status: "ao_vivo" })}
                        >
                          <Radio className="h-4 w-4 mr-1" /> Iniciar
                        </Button>
                      )}
                      {w.status === "ao_vivo" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => statusMutation.mutate({ id: w.id, status: "encerrado" })}
                        >
                          Encerrar
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Duplicar (cria um novo com o mesmo vídeo e os mesmos depoimentos)"
                        onClick={() => {
                          setDuplicarAlvo(w);
                          setTituloDuplicado(`${w.titulo} - Cópia`);
                        }}
                      >
                        <CopyPlus className="h-4 w-4" />
                      </Button>
                      {w.protegido ? (
                        <Button size="icon" variant="ghost" disabled title="Protegido contra exclusão (é o webinar molde)">
                          <Lock className="h-4 w-4 text-gray-300" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" title="Excluir" onClick={() => setExcluirAlvo({ id: w.id, titulo: w.titulo })}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
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
            <DialogTitle>Novo Webinar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título da aula</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Aula ao vivo — Matemática" />
            </div>
            <div>
              <Label>Link do YouTube (ao vivo, não listado)</Label>
              <Input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="gravado" checked={gravado} onCheckedChange={(v) => setGravado(!!v)} />
              <Label htmlFor="gravado" className="cursor-pointer font-normal">
                Essa é uma aula gravada (não é ao vivo de verdade) — habilita os depoimentos sincronizados por tempo
              </Label>
            </div>
            <div>
              <Label>Depois de colocar nome e telefone, o aluno vai para:</Label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setModoAcesso("youtube")}
                  className={`flex-1 border rounded-lg p-3 text-left text-sm transition ${modoAcesso === "youtube" ? "border-orange-500 bg-orange-50 ring-2 ring-orange-500" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <div className="font-semibold">📺 App do YouTube</div>
                  <div className="text-xs text-muted-foreground">Abre direto no app (Android e iPhone)</div>
                </button>
                <button
                  type="button"
                  onClick={() => setModoAcesso("interno")}
                  className={`flex-1 border rounded-lg p-3 text-left text-sm transition ${modoAcesso === "interno" ? "border-orange-500 bg-orange-50 ring-2 ring-orange-500" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <div className="font-semibold">💻 Dentro do sistema</div>
                  <div className="text-xs text-muted-foreground">Vídeo + chat na própria página</div>
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoAberto(false)}>Cancelar</Button>
            <Button onClick={() => criarMutation.mutate()} disabled={!titulo.trim() || criarMutation.isPending}>
              {criarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!duplicarAlvo} onOpenChange={(v) => !v && setDuplicarAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicar webinar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Cria um webinar novo com o mesmo vídeo e copia todos os depoimentos de{" "}
              <strong>{duplicarAlvo?.titulo}</strong>. O original continua intacto.
            </p>
            <div>
              <Label>Nome do novo webinar</Label>
              <Input
                autoFocus
                value={tituloDuplicado}
                onChange={(e) => setTituloDuplicado(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicarAlvo(null)}>Cancelar</Button>
            <Button
              onClick={() => duplicarAlvo && duplicarMutation.mutate({ original: duplicarAlvo, novoTitulo: tituloDuplicado })}
              disabled={!tituloDuplicado.trim() || duplicarMutation.isPending}
            >
              {duplicarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Duplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!excluirAlvo} onOpenChange={(v) => !v && setExcluirAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir webinar?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Tem certeza que deseja excluir <strong>{excluirAlvo?.titulo}</strong>? Isso apaga também todo o histórico de
            participantes, chat e presença dessa aula. Essa ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirAlvo(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => excluirAlvo && excluirMutation.mutate(excluirAlvo.id)}
              disabled={excluirMutation.isPending}
            >
              {excluirMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
