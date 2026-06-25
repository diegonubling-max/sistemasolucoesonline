import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, Eye, Loader2 } from "lucide-react";
import { format } from "date-fns";

const TIPO_LABEL: Record<string, string> = {
  boas_vindas: "Boas-vindas",
  confirmacao_pagamento: "Confirmação de Pagamento",
  lembrete_vencimento: "Lembrete de Vencimento",
  aviso_atraso: "Aviso de Atraso",
  motivacional_primeiro_login: "Motivacional 1º Login",
  reenvio_acesso: "Reenvio de Acesso",
  redefinicao_senha: "Redefinição de Senha",
  nunca_acessou: "Nunca Acessou",
  "4_dias_sem_acessar": "4 dias sem acessar",
  sabado: "Sábado",
  domingo: "Domingo",
  outro: "Outro",
};

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export function MensagensTab({ alunoId }: { alunoId: string }) {
  const [tipo, setTipo] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [appliedFilters, setAppliedFilters] = useState({
    tipo: "todos",
    status: "todos",
    dataInicio: "",
    dataFim: "",
  });
  const [viewMsg, setViewMsg] = useState<string | null>(null);

  const { data: mensagens, isLoading } = useQuery({
    queryKey: ["zapi-mensagens", alunoId, appliedFilters],
    queryFn: async () => {
      let q = supabase
        .from("zapi_mensagens_log")
        .select("id, tipo, mensagem, status, erro_detalhe, enviado_em")
        .eq("aluno_id", alunoId)
        .order("enviado_em", { ascending: false })
        .limit(500);
      if (appliedFilters.tipo !== "todos") q = q.eq("tipo", appliedFilters.tipo);
      if (appliedFilters.status !== "todos") q = q.eq("status", appliedFilters.status);
      if (appliedFilters.dataInicio) q = q.gte("enviado_em", `${appliedFilters.dataInicio}T00:00:00`);
      if (appliedFilters.dataFim) q = q.lte("enviado_em", `${appliedFilters.dataFim}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" /> Mensagens WhatsApp (Z-API)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(TIPO_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data início</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <Label>Data fim</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div>
            <Button
              className="w-full"
              onClick={() => setAppliedFilters({ tipo, status, dataInicio, dataFim })}
            >
              Filtrar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : !mensagens || mensagens.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma mensagem encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mensagens.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(m.enviado_em as string), "dd/MM/yyyy 'às' HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm">{TIPO_LABEL[m.tipo] ?? m.tipo}</TableCell>
                    <TableCell className="text-sm max-w-md">
                      <div className="flex items-start gap-2">
                        <span className="whitespace-pre-wrap break-words">{truncate(m.mensagem, 80)}</span>
                        {m.mensagem.length > 80 && (
                          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setViewMsg(m.mensagem)}>
                            <Eye className="h-3 w-3 mr-1" /> Ver
                          </Button>
                        )}
                      </div>
                      {m.status === "erro" && m.erro_detalhe && (
                        <div className="text-xs text-red-600 mt-1">⚠ {m.erro_detalhe}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.status === "enviado" ? (
                        <Badge className="bg-green-600 hover:bg-green-600">Enviado</Badge>
                      ) : (
                        <Badge variant="destructive">Erro</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={!!viewMsg} onOpenChange={(o) => !o && setViewMsg(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Mensagem completa</DialogTitle>
            </DialogHeader>
            <div className="whitespace-pre-wrap text-sm bg-muted p-3 rounded">{viewMsg}</div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
