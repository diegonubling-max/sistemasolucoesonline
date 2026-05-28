import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Power, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_admin/segmentos")({
  head: () => ({ meta: [{ title: "Segmentos — EduManager" }] }),
  component: SegmentosList,
});

function SegmentosList() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["segmentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("segmentos")
        .select("*, cursos(count)")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (values.id) {
        const { error } = await supabase.from("segmentos").update(values).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("segmentos").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Segmento salvo com sucesso");
      qc.invalidateQueries({ queryKey: ["segmentos"] });
      setIsModalOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("segmentos").update({ ativo: !ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["segmentos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleEdit = (seg: any) => {
    setEditing(seg);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditing({ nome: "", descricao: "", ordem: 0, ativo: true });
    setIsModalOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Segmentos"
        description={`${data?.length ?? 0} segmento(s) cadastrado(s)`}
        actions={
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" /> Novo Segmento
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Nº de cursos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {data?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.ordem}</TableCell>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  <TableCell>{s.cursos?.[0]?.count ?? 0}</TableCell>
                  <TableCell>
                    {s.ativo ? (
                      <Badge className="bg-accent text-accent-foreground hover:bg-accent">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title={s.ativo ? "Desativar" : "Ativar"}
                        onClick={() => toggleStatus.mutate({ id: s.id, ativo: !!s.ativo })}
                      >
                        <Power className={`h-4 w-4 ${s.ativo ? "text-green-600" : "text-gray-400"}`} />
                      </Button>
                      <Button size="icon" variant="ghost" title="Editar" onClick={() => handleEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum segmento cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar Segmento" : "Novo Segmento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={editing?.nome || ""}
                onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                placeholder="Ex: Informática"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                value={editing?.descricao || ""}
                onChange={(e) => setEditing({ ...editing, descricao: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ordem de exibição</Label>
                <Input
                  type="number"
                  value={editing?.ordem || 0}
                  onChange={(e) => setEditing({ ...editing, ordem: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <div className="flex items-center gap-2 pb-2">
                  <Switch
                    checked={!!editing?.ativo}
                    onCheckedChange={(v) => setEditing({ ...editing, ativo: v })}
                  />
                  <span className="text-sm">{editing?.ativo ? "Ativo" : "Inativo"}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate(editing)}
              disabled={!editing?.nome || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
