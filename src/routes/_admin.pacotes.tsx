import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Power, AlertTriangle } from "lucide-react";
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
  const qc = useQueryClient();
  const [pacoteEditando, setPacoteEditando] = useState<Partial<Pacote> | null>(null);
  const [isNovoModalOpen, setIsNovoModalOpen] = useState(false);
  const [pacoteToDelete, setPacoteToDelete] = useState<Pacote | null>(null);

  const { data: pacotes, isLoading, refetch } = useQuery({
    queryKey: ["pacotes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pacotes").select("*").order("nome");
      if (error) throw error;
      return data as Pacote[];
    },
  });

  const salvarEdicao = async () => {
    if (!pacoteEditando?.id) return;

    const { error } = await supabase
      .from('pacotes')
      .update({
        nome: pacoteEditando.nome,
        tipo: pacoteEditando.tipo,
        valor_matricula: pacoteEditando.valor_matricula,
        numero_parcelas: pacoteEditando.numero_parcelas,
        valor_parcela: pacoteEditando.valor_parcela,
        valor_total: pacoteEditando.valor_total,
        descricao: pacoteEditando.descricao,
        ativo: pacoteEditando.ativo
      })
      .eq('id', pacoteEditando.id);

    if (error) {
      toast.error('Erro ao atualizar: ' + error.message);
      return;
    }

    toast.success('Pacote atualizado com sucesso!');
    setPacoteEditando(null);
    refetch();
  };

  const salvarNovo = async (formData: any) => {
    const { error } = await supabase.from('pacotes').insert(formData);
    if (error) {
      toast.error('Erro ao criar: ' + error.message);
      return;
    }
    toast.success('Pacote criado com sucesso!');
    setIsNovoModalOpen(false);
    refetch();
  };

  const toggleAtivo = async (p: Pacote) => {
    const { error } = await supabase.from("pacotes").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Status atualizado");
    refetch();
  };

  const deletarPacote = async (id: string) => {
    const { error } = await supabase.rpc('delete_pacote', { p_pacote_id: id });
    if (error) {
      toast.error(error.message.includes('vinculado') 
        ? 'Este pacote não pode ser excluído pois está vinculado a matrículas' 
        : error.message);
      return;
    }
    toast.success('Pacote excluído');
    setPacoteToDelete(null);
    refetch();
  };

  return (
    <div>
      <PageHeader
        title="Pacotes Financeiros"
        description="Gerencie os planos de pagamento para matrículas"
        actions={
          <Button onClick={() => setIsNovoModalOpen(true)}>
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
                  <TableCell><Badge variant="outline" className="capitalize">{p.tipo}</Badge></TableCell>
                  <TableCell>R$ {p.valor_matricula.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{p.numero_parcelas}x R$ {p.valor_parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="font-bold text-primary">R$ {p.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    {p.ativo ? (
                      <Badge className="bg-accent text-accent-foreground">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setPacoteEditando(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => toggleAtivo(p)}>
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-[#DC2626]" onClick={() => setPacoteToDelete(p)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL DE EDIÇÃO */}
      <Dialog open={!!pacoteEditando} onOpenChange={(open) => !open && setPacoteEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pacote</DialogTitle>
          </DialogHeader>
          {pacoteEditando && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Nome do pacote</Label>
                <Input 
                  value={pacoteEditando.nome || ""} 
                  onChange={(e) => setPacoteEditando({...pacoteEditando, nome: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select 
                    value={pacoteEditando.tipo} 
                    onValueChange={(v: any) => setPacoteEditando({...pacoteEditando, tipo: v})}
                  >
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
                  <Input 
                    type="number" 
                    value={pacoteEditando.valor_matricula || 0} 
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const total = val + (Number(pacoteEditando.numero_parcelas || 0) * Number(pacoteEditando.valor_parcela || 0));
                      setPacoteEditando({...pacoteEditando, valor_matricula: val, valor_total: total});
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nº Parcelas</Label>
                  <Input 
                    type="number" 
                    value={pacoteEditando.numero_parcelas || 0} 
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const total = Number(pacoteEditando.valor_matricula || 0) + (val * Number(pacoteEditando.valor_parcela || 0));
                      setPacoteEditando({...pacoteEditando, numero_parcelas: val, valor_total: total});
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor por parcela</Label>
                  <Input 
                    type="number" 
                    value={pacoteEditando.valor_parcela || 0} 
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const total = Number(pacoteEditando.valor_matricula || 0) + (Number(pacoteEditando.numero_parcelas || 0) * val);
                      setPacoteEditando({...pacoteEditando, valor_parcela: val, valor_total: total});
                    }}
                  />
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg border flex justify-between items-center">
                <span className="text-sm font-medium">Valor Total:</span>
                <span className="text-lg font-bold text-primary">
                  R$ {(pacoteEditando.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea 
                  value={pacoteEditando.descricao || ""} 
                  onChange={(e) => setPacoteEditando({...pacoteEditando, descricao: e.target.value})} 
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select 
                  value={pacoteEditando.ativo ? "ativo" : "inativo"} 
                  onValueChange={(v) => setPacoteEditando({...pacoteEditando, ativo: v === "ativo"})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPacoteEditando(null)}>Cancelar</Button>
                <Button onClick={salvarEdicao}>Salvar alterações</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL NOVO PACOTE (MANTENDO SIMPLICIDADE) */}
      <NovoPacoteModal 
        open={isNovoModalOpen} 
        onOpenChange={setIsNovoModalOpen} 
        onSave={salvarNovo} 
      />

      <AlertDialog open={!!pacoteToDelete} onOpenChange={(open) => !open && setPacoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-6 w-6 text-[#DC2626]" />
              <AlertDialogTitle>Excluir pacote?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Você está prestes a excluir o pacote <span className="font-bold text-foreground">[{pacoteToDelete?.nome}]</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-[#DC2626]" onClick={() => pacoteToDelete && deletarPacote(pacoteToDelete.id)}>
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NovoPacoteModal({ open, onOpenChange, onSave }: any) {
  const [novo, setNovo] = useState({
    nome: "", tipo: "boleto", valor_matricula: 0, numero_parcelas: 1, valor_parcela: 0, valor_total: 0, descricao: "", ativo: true
  });

  const total = Number(novo.valor_matricula) + (Number(novo.numero_parcelas) * Number(novo.valor_parcela));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Pacote</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome do pacote</Label>
            <Input onChange={(e) => setNovo({...novo, nome: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={novo.tipo} onValueChange={(v: any) => setNovo({...novo, tipo: v})}>
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
              <Input type="number" onChange={(e) => setNovo({...novo, valor_matricula: Number(e.target.value)})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nº Parcelas</Label>
              <Input type="number" onChange={(e) => setNovo({...novo, numero_parcelas: Number(e.target.value)})} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor por parcela</Label>
              <Input type="number" onChange={(e) => setNovo({...novo, valor_parcela: Number(e.target.value)})} />
            </div>
          </div>
          <div className="p-3 bg-muted rounded-lg border flex justify-between items-center">
            <span className="text-sm font-medium">Valor Total:</span>
            <span className="text-lg font-bold text-primary">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => onSave({...novo, valor_total: total})}>Salvar</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
