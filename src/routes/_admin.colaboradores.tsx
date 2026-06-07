import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Pencil, Shield, Trash2, Loader2, Users } from "lucide-react";
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
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

export const Route = createFileRoute("/_admin/colaboradores")({
  component: ColaboradoresList,
});

const formSchema = z.object({
  nome: z.string().min(3, "Mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "Mínimo 6 caracteres"),
  polo_id: z.string().uuid("Selecione um polo"),
  setor: z.string().min(1, "Selecione um setor"),
});

const SETORES = ["Vendedor", "Setor de Provas", "Cobrança", "Administrativo", "Outros"];

function ColaboradoresList() {
  const qc = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedColabPerms, setSelectedColabPerms] = useState<any>(null);

  const { data: colaboradores, isLoading } = useQuery({
    queryKey: ["colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("*, polos(nome), colaborador_permissoes(*)")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: polos } = useQuery({
    queryKey: ["polos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("polos").select("id, nome").eq("ativo", true);
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      email: "",
      senha: "",
      polo_id: "",
      setor: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { data, error } = await supabase.functions.invoke("manage-colaboradores", {
        body: { action: "create_colaborador", ...values },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Colaborador cadastrado com sucesso");
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePermsMutation = useMutation({
    mutationFn: async ({ id, perms }: { id: string; perms: any }) => {
      const { error } = await supabase
        .from("colaborador_permissoes")
        .update(perms)
        .eq("colaborador_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permissões atualizadas");
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handlePermToggle = (colabId: string, field: string, value: boolean) => {
    updatePermsMutation.mutate({
      id: colabId,
      perms: { [field]: value }
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Colaboradores"
        description="Gerencie os membros da sua equipe e suas permissões"
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Colaborador</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl><Input {...field} type="email" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="senha"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl><Input {...field} type="password" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="polo_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Polo</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {polos?.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="setor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Setor</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SETORES.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Salvando..." : "Salvar Colaborador"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Polo</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="text-right">Permissões</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center">Carregando...</TableCell></TableRow>
              ) : colaboradores?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{c.polos?.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.setor}</Badge>
                  </TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Shield className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Permissões: {c.nome}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          {[
                            { id: 'ver_alunos', label: 'Ver Alunos' },
                            { id: 'cadastrar_alunos', label: 'Cadastrar Alunos' },
                            { id: 'fazer_matriculas', label: 'Fazer Matrículas' },
                            { id: 'ver_financeiro', label: 'Ver Financeiro' },
                            { id: 'dar_baixa_pagamentos', label: 'Baixa em Pagamentos' },
                            { id: 'agendar_provas', label: 'Agendar Provas' },
                            { id: 'ver_relatorios', label: 'Ver Relatórios' },
                            { id: 'ver_configuracoes', label: 'Ver Configurações' },
                          ].map(perm => {
                            const permsObj = c.colaborador_permissoes?.[0] as any;
                            return (
                              <div key={perm.id} className="flex items-center justify-between">
                                <span className="text-sm font-medium">{perm.label}</span>
                                <Switch 
                                  checked={permsObj?.[perm.id] ?? false} 
                                  onCheckedChange={(val) => handlePermToggle(c.id, perm.id, val)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </DialogContent>
                    </Dialog>
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
