import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, Trash2, Edit2, Plus } from "lucide-react";

const VENDEDORAS = ["Gislaine", "Vera", "Gabrielly", "Maria Eduarda"];
const ORIGENS = ["Google", "Meta", "Indicação", "Outros"];

export function LeadsRegistration() {
  const queryClient = useQueryClient();
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [vendedora, setVendedora] = useState("");
  const [quantidades, setQuantidades] = useState<Record<string, number>>({
    Google: 0,
    Meta: 0,
    Indicação: 0,
    Outros: 0,
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads_diarios")
        .select("*")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!vendedora) throw new Error("Selecione uma vendedora");
      
      const entries = Object.entries(quantidades)
        .filter(([_, qty]) => qty > 0)
        .map(([origem, quantidade]) => ({
          data,
          vendedora,
          origem,
          quantidade,
        }));

      if (entries.length === 0) throw new Error("Informe a quantidade de pelo menos uma origem");

      if (editingId) {
        const { error } = await supabase
          .from("leads_diarios")
          .update({
            data,
            vendedora,
            origem: Object.keys(quantidades).find(k => quantidades[k] > 0),
            quantidade: Object.values(quantidades).find(v => v > 0),
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const entries = Object.entries(quantidades)
          .filter(([_, qty]) => qty > 0)
          .map(([origem, quantidade]) => ({
            data,
            vendedora,
            origem,
            quantidade,
          }));

        if (entries.length === 0) throw new Error("Informe a quantidade de pelo menos uma origem");

        const { error } = await supabase.from("leads_diarios").insert(entries);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Registro atualizado!" : "Leads registrados com sucesso!");
      setQuantidades({ Google: 0, Meta: 0, Indicação: 0, Outros: 0 });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["leads-historico"] });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads_diarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído");
      queryClient.invalidateQueries({ queryKey: ["leads-historico"] });
    },
  });

  const handleQtyChange = (origem: string, val: string) => {
    setQuantidades(prev => ({ ...prev, [origem]: parseInt(val) || 0 }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Registrar Leads Recebidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input 
                type="date" 
                value={data} 
                onChange={(e) => setData(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Vendedora</Label>
              <Select value={vendedora} onValueChange={setVendedora}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a vendedora" />
                </SelectTrigger>
                <SelectContent>
                  {VENDEDORAS.map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {ORIGENS.map(origem => (
              <div key={origem} className="space-y-2">
                <Label>{origem}</Label>
                <Input 
                  type="number" 
                  min="0"
                  value={quantidades[origem]} 
                  onChange={(e) => handleQtyChange(origem, e.target.value)} 
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button 
              className="w-full md:w-auto" 
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {editingId ? "Atualizar Lançamento" : "Salvar Lançamentos"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={() => {
                setEditingId(null);
                setQuantidades({ Google: 0, Meta: 0, Indicação: 0, Outros: 0 });
              }}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Vendedora</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">Carregando...</TableCell>
                </TableRow>
              ) : leads?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Nenhum registro encontrado</TableCell>
                </TableRow>
              ) : leads?.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>{format(new Date(lead.data + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{lead.vendedora}</TableCell>
                  <TableCell>{lead.origem}</TableCell>
                  <TableCell>{lead.quantidade}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setEditingId(lead.id);
                          setData(lead.data);
                          setVendedora(lead.vendedora);
                          setQuantidades({
                            Google: 0,
                            Meta: 0,
                            Indicação: 0,
                            Outros: 0,
                            [lead.origem]: lead.quantidade
                          });
                        }}
                      >
                        <Edit2 className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          if (confirm("Deseja excluir este registro?")) {
                            deleteMutation.mutate(lead.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
