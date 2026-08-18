import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, KeyRound, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GerarAcessoAulaoModal({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [gerandoId, setGerandoId] = useState<string | null>(null);
  const [acessoGerado, setAcessoGerado] = useState<{ nome: string; ctr: number; senha: string } | null>(null);

  const { data: pendentes, isLoading } = useQuery({
    queryKey: ["matriculas-aulao-sem-acesso"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas_aulao" as any)
        .select("id, nome, telefone, status, pagamento_status, created_at")
        .is("aluno_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const gerarAcesso = async (m: any) => {
    setGerandoId(m.id);
    setAcessoGerado(null);
    try {
      // Identifica quem clicou em "Gerar acesso" — mesma lógica usada no cadastro manual
      // (MatriculaFlow.tsx), pra ficar registrado no perfil do aluno quem liberou o acesso.
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      let cadastradoPorNome: string | null = null;
      const cadastradoPorId: string | null = currentUser?.id ?? null;
      if (currentUser) {
        if (currentUser.email === 'diegonubling@gmail.com') {
          cadastradoPorNome = 'Diego (Admin)';
        } else {
          const { data: colab } = await supabase
            .from('colaboradores')
            .select('nome')
            .eq('user_id', currentUser.id)
            .maybeSingle();
          cadastradoPorNome = colab?.nome ?? currentUser.email ?? null;
        }
      }

      const res = await fetch("/api/public/hooks/converter-matricula-aulao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula_aulao_id: m.id,
          force: true,
          cadastrado_por: cadastradoPorNome,
          cadastrado_por_id: cadastradoPorId,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || "Erro ao gerar acesso");
        return;
      }
      setAcessoGerado({ nome: m.nome, ctr: data.ctr, senha: data.senha });
      toast.success("Acesso criado com sucesso!");
      qc.invalidateQueries({ queryKey: ["matriculas-aulao-sem-acesso"] });
      qc.invalidateQueries({ queryKey: ["alunos"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar acesso");
    } finally {
      setGerandoId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Gerar acesso — alunos do Aulão
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Alunos que preencheram os dados no link do <code>/matricula</code> mas ainda não têm login e senha.
        </p>

        {acessoGerado && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-1">
            <p className="text-sm font-medium text-green-800">
              Acesso de <strong>{acessoGerado.nome}</strong> criado:
            </p>
            <div className="flex items-center gap-4 text-sm font-mono">
              <span>Login: <strong>{acessoGerado.ctr}</strong></span>
              <span>Senha: <strong>{acessoGerado.senha}</strong></span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => {
                  navigator.clipboard.writeText(`Login: ${acessoGerado.ctr}\nSenha: ${acessoGerado.senha}`);
                  toast.success("Copiado!");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (pendentes ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum cadastro do Aulão pendente de acesso no momento.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pendentes ?? []).map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell>{m.telefone}</TableCell>
                    <TableCell>
                      {m.pagamento_status === "confirmado" ? (
                        <Badge className="bg-green-100 text-green-700">Pago</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600">Não pago</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => gerarAcesso(m)}
                        disabled={gerandoId === m.id}
                      >
                        {gerandoId === m.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>Gerar acesso</>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
