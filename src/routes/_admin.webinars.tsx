import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Radio, Users, Copy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_admin/webinars")({
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
      const { error } = await supabase.from("webinars" as any).insert({ titulo, youtube_url: youtubeUrl });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Webinar criado!");
      qc.invalidateQueries({ queryKey: ["webinars"] });
      setNovoAberto(false);
      setTitulo("");
      setYoutubeUrl("");
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

  const excluirMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webinars" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Webinar excluído");
      qc.invalidateQueries({ queryKey: ["webinars"] });
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
                    <TableCell className="font-medium">{w.titulo}</TableCell>
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
                      <Button size="icon" variant="ghost" title="Excluir" onClick={() => excluirMutation.mutate(w.id)}>
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
    </div>
  );
}
