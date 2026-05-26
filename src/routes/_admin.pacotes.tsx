import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Power, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";

export const Route = createFileRoute("/_admin/pacotes")({
  head: () => ({ meta: [{ title: "Pacotes — EduManager" }] }),
  component: PacotesList,
});

type Pacote = {
  id: string;
  nome: string;
  tipo: "boleto" | "cartao" | "pix";
  valor_matricula: number;
  valor_parcela: number;
  numero_parcelas: number;
  valor_total: number;
  descricao: string | null;
  ativo: boolean;
};

function PacotesList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPacote, setEditingPacote] = useState<Pacote | null>(null);
  const [pacoteToDelete, setPacoteToDelete] = useState<Pacote | null>(null);

  const { data: pacotes, isLoading } = useQuery({
    queryKey: ["pacotes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pacotes").select("*").order("nome");
      if (error) throw error;
      return data as Pacote[];
    },
  });

  const upsertMut = useMutation({
    mutationFn: async (values: any) => {
      if (editingPacote) {
        const { error } = await supabase.from("pacotes").update(values).eq("id", editingPacote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pacotes").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingPacote ? "Pacote atualizado" : "Pacote criado");
      qc.invalidateQueries({ queryKey: ["pacotes"] });
      setIsModalOpen(false);
      setEditingPacote(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("pacotes").update({ ativo: !ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["pacotes"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_pacote', { 
        p_pacote_id: id 
      });

      if (error) {
        if (error.message.includes('vinculado')) {
          throw new Error('Este pacote não pode ser excluído pois está vinculado a matrículas existentes');
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Pacote excluído com sucesso');
      qc.invalidateQueries({ queryKey: ["pacotes"] });
      setPacoteToDelete(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Pacotes Financeiros"
        description="Gerencie os planos de pagamento para matrículas"
        actions={
          <Button onClick={() => { setEditingPacote(null); setIsModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo Pacote
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Taxa de Matrícula</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              )}
              {pacotes?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{p.tipo}</Badge>
                  </TableCell>
                  <TableCell>R$ {p.valor_matricula.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{p.numero_parcelas}x R$ {p.valor_parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="font-bold text-primary">R$ {p.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    {p.ativo ? (
                      <Badge className="bg-accent text-accent-foreground hover:bg-accent">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditingPacote(p); setIsModalOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => toggleMut.mutate({ id: p.id, ativo: p.ativo })}>
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-[#DC2626] hover:text-[#DC2626] hover:bg-red-50"
                        onClick={() => setPacoteToDelete(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && pacotes?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum pacote cadastrado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PacoteFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        pacote={editingPacote}
        onSubmit={(v: any) => upsertMut.mutate(v)}
        submitting={upsertMut.isPending}
      />

      <AlertDialog open={!!pacoteToDelete} onOpenChange={(open) => !open && setPacoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-6 w-6 text-[#DC2626]" />
              <AlertDialogTitle>Excluir pacote?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Você está prestes a excluir o pacote{" "}
              <span className="font-bold text-foreground">[{pacoteToDelete?.nome}]</span>. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#DC2626] hover:bg-[#B91C1C] text-white"
              disabled={deleteMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pacoteToDelete) deleteMut.mutate(pacoteToDelete.id);
              }}
            >
              {deleteMut.isPending ? "Excluindo..." : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PacoteFormModal({ open, onOpenChange, pacote, onSubmit, submitting }: any) {
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    defaultValues: {
      nome: "",
      tipo: "boleto",
      valor_matricula: 0,
      valor_parcela: 0,
      numero_parcelas: 1,
      valor_total: 0,
      descricao: "",
      ativo: true,
    }
  });

  const entry = watch("valor_matricula") || 0;
  const installments = watch("numero_parcelas") || 0;
  const value = watch("valor_parcela") || 0;

  useEffect(() => {
    if (open) {
      if (pacote) {
        reset(pacote);
      } else {
        reset({
          nome: "",
          tipo: "boleto",
          valor_matricula: 0,
          valor_parcela: 0,
          numero_parcelas: 1,
          valor_total: 0,
          descricao: "",
          ativo: true,
        });
      }
    }
  }, [open, pacote, reset]);

  // Effect to calculate total
  const total = Number(entry) + (Number(installments) * Number(value));
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pacote ? "Editar Pacote" : "Novo Pacote"}</DialogTitle>
          <DialogDescription>Preencha os dados do plano financeiro.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => onSubmit({ ...data, valor_total: total }))} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome do pacote</Label>
            <Input {...register("nome", { required: true })} placeholder="Ex: Boleto 1+9 de R$ 159,90" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={watch("tipo")} onValueChange={(v) => setValue("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Taxa de Matrícula</Label>
              <Input type="number" step="0.01" {...register("valor_matricula", { valueAsNumber: true })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nº Parcelas</Label>
              <Input type="number" {...register("numero_parcelas", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor por parcela</Label>
              <Input type="number" step="0.01" {...register("valor_parcela", { valueAsNumber: true })} />
            </div>
          </div>
          <div className="p-3 bg-muted rounded-lg border flex justify-between items-center">
            <span className="text-sm font-medium">Valor Total:</span>
            <span className="text-lg font-bold text-primary">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea {...register("descricao")} placeholder="Detalhes do pacote..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>Salvar Pacote</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
