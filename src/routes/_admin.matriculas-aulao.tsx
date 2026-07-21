import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Loader2, FileText, CheckCircle2, XCircle, Trash2 } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { maskCPF, maskPhone } from "@/lib/format";

export const Route = createFileRoute("/_admin/matriculas-aulao")({
  head: () => ({ meta: [{ title: "Matrículas Aulão — Soluções Online" }] }),
  component: MatriculasAulaoList,
});

const FORMA_LABEL: Record<string, string> = {
  boleto: "Boleto",
  cartao: "Cartão",
  pix: "À Vista (PIX)",
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  matriculado: { label: "Matriculado", className: "bg-accent text-accent-foreground hover:bg-accent" },
  editado: { label: "Editado", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  cancelado: { label: "Cancelado", className: "bg-red-100 text-red-800 hover:bg-red-100" },
};

function MatriculasAulaoList() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [contratoAberto, setContratoAberto] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["matriculas-aulao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas_aulao" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filtrados = (data ?? []).filter((m) => {
    if (!busca.trim()) return true;
    const q = busca.trim().toLowerCase();
    return (
      m.nome?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.telefone?.includes(q) ||
      m.cpf?.includes(q)
    );
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      const { id, nome, email, telefone, cpf, data_nascimento, sexo, forma_pagamento, status, observacoes, contrato_html } = values;
      const { error } = await supabase
        .from("matriculas_aulao" as any)
        .update({
          nome,
          email,
          telefone,
          cpf,
          data_nascimento,
          sexo,
          forma_pagamento,
          status,
          observacoes,
          contrato_html,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matrícula atualizada com sucesso");
      qc.invalidateQueries({ queryKey: ["matriculas-aulao"] });
      setIsModalOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("matriculas_aulao" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matrícula excluída com sucesso");
      qc.invalidateQueries({ queryKey: ["matriculas-aulao"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDelete = (m: any) => {
    if (window.confirm(`Tem certeza que deseja excluir a matrícula de ${m.nome}?`)) {
      deleteMutation.mutate(m.id);
    }
  };

  const handleEdit = (m: any) => {
    setEditing({ ...m });
    setIsModalOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Matrículas Aulão"
        description={`${data?.length ?? 0} matrícula(s) recebida(s) pelo link público`}
      />

      <div className="mb-4">
        <Input
          placeholder="Buscar por nome, e-mail, telefone ou CPF..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Forma Pgto</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {filtrados.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap">
                    {m.created_at ? new Date(m.created_at).toLocaleDateString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell className="font-medium">{m.nome}</TableCell>
                  <TableCell>{m.telefone}</TableCell>
                  <TableCell>{FORMA_LABEL[m.forma_pagamento] ?? m.forma_pagamento}</TableCell>
                  <TableCell>
                    {m.assinatura_nome ? (
                      <button
                        className="inline-flex items-center gap-1 text-green-700 hover:underline"
                        onClick={() => setContratoAberto(m.id)}
                        title="Ver contrato assinado"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Assinado
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <XCircle className="h-4 w-4" /> Não assinado
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {m.pagamento_status === "confirmado" ? (
                      <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                        <CheckCircle2 className="h-4 w-4" /> Pago
                        {m.pagamento_valor && <span className="text-xs text-muted-foreground ml-1">(R$ {Number(m.pagamento_valor).toFixed(2).replace(".", ",")})</span>}
                      </span>
                    ) : m.asaas_payment_id ? (
                      <span className="inline-flex items-center gap-1 text-orange-600">
                        ⏳ Aguardando
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_LABEL[m.status]?.className}>
                      {STATUS_LABEL[m.status]?.label ?? m.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {m.assinatura_nome && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Ver contrato"
                          onClick={() => setContratoAberto(m.id)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" title="Editar" onClick={() => handleEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Excluir" onClick={() => handleDelete(m)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && filtrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma matrícula encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Matrícula</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                value={editing?.nome || ""}
                onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                value={editing?.email || ""}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={editing?.telefone || ""}
                  onChange={(e) => setEditing({ ...editing, telefone: maskPhone(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input
                  value={editing?.cpf || ""}
                  onChange={(e) => setEditing({ ...editing, cpf: maskCPF(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data de nascimento</Label>
                <Input
                  type="date"
                  value={editing?.data_nascimento || ""}
                  onChange={(e) => setEditing({ ...editing, data_nascimento: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sexo</Label>
                <Select
                  value={editing?.sexo || ""}
                  onValueChange={(v) => setEditing({ ...editing, sexo: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select
                value={editing?.forma_pagamento || ""}
                onValueChange={(v) => setEditing({ ...editing, forma_pagamento: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="pix">À Vista (PIX)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={editing?.status || ""}
                onValueChange={(v) => setEditing({ ...editing, status: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="matriculado">Matriculado</SelectItem>
                  <SelectItem value="editado">Editado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observações internas</Label>
              <Textarea
                value={editing?.observacoes || ""}
                onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })}
                placeholder="Anotações da equipe (não visível ao aluno)"
              />
            </div>
            {editing?.contrato_html && (
              <div className="space-y-1.5">
                <Label>Contrato (HTML — editar com cuidado)</Label>
                <Textarea
                  className="font-mono text-xs h-32"
                  value={editing?.contrato_html || ""}
                  onChange={(e) => setEditing({ ...editing, contrato_html: e.target.value })}
                />
              </div>
            )}
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

      {/* Visualização do contrato assinado */}
      <Dialog open={!!contratoAberto} onOpenChange={(v) => !v && setContratoAberto(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contrato Assinado</DialogTitle>
          </DialogHeader>
          {(() => {
            const m = filtrados.find((x) => x.id === contratoAberto) || data?.find((x) => x.id === contratoAberto);
            if (!m) return null;
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Assinado por <strong>{m.assinatura_nome}</strong> em{" "}
                  {m.assinado_em ? new Date(m.assinado_em).toLocaleString("pt-BR") : "-"}
                </p>
                <div
                  className="border rounded p-4 text-sm bg-gray-50 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: m.contrato_html || "<p>Contrato não disponível.</p>" }}
                />
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
