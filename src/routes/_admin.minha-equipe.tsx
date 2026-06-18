import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Search, Pencil, Shield, Loader2, MoreHorizontal, UserCheck, UserMinus, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_admin/minha-equipe")({
  component: MinhaEquipe,
});

const SETORES = ["Vendedor", "Setor de Provas", "Cobrança", "Administrativo", "Outros"];

const PERMISSIONS_LIST = [
  { id: 'ver_alunos', label: 'Ver Alunos' },
  { id: 'cadastrar_alunos', label: 'Cadastrar Alunos' },
  { id: 'fazer_matriculas', label: 'Fazer Matrículas' },
  { id: 'ver_financeiro', label: 'Ver Financeiro' },
  { id: 'dar_baixa_pagamentos', label: 'Baixa em Pagamentos' },
  { id: 'agendar_provas', label: 'Agendar Provas' },
  { id: 'gerenciar_prova_final', label: 'Gerenciar Prova Final' },
  { id: 'ver_setor_provas', label: 'Ver Setor de Provas' },
  { id: 'ver_relatorios', label: 'Ver Relatórios' },
  { id: 'ver_configuracoes', label: 'Ver Configurações' },
];

const formSchema = z.object({
  nome: z.string().min(3, "Mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "Mínimo 6 caracteres").optional().or(z.literal("")),
  setor: z.string().min(1, "Selecione um setor"),
});

function MinhaEquipe() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingColab, setEditingColab] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: meColab, isLoading: loadingMe } = useQuery({
    queryKey: ["me-colaborador", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase
        .from('colaboradores')
        .select('*, polos(nome)')
        .eq('user_id', session.user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const isResponsavel = !!(meColab as any)?.responsavel_polo;
  const meuPoloId = (meColab as any)?.polo_id;
  const meuPoloNome = (meColab as any)?.polos?.nome;

  useEffect(() => {
    if (!loadingMe && meColab && !isResponsavel) {
      toast.error("Acesso restrito a responsáveis de polo.");
      navigate({ to: "/" });
    }
  }, [loadingMe, meColab, isResponsavel, navigate]);

  const [formPerms, setFormPerms] = useState<Record<string, boolean>>(
    Object.fromEntries(PERMISSIONS_LIST.map(p => [p.id, false]))
  );

  const { data: colaboradores, isLoading } = useQuery({
    queryKey: ["minha-equipe", meuPoloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("*, colaborador_permissoes(*)")
        .eq('polo_id', meuPoloId)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!meuPoloId && isResponsavel,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { nome: "", email: "", senha: "", setor: "" },
  });

  useEffect(() => {
    if (editingColab) {
      form.reset({
        nome: editingColab.nome,
        email: editingColab.email,
        senha: "",
        setor: editingColab.setor,
      });
      const perms = editingColab.colaborador_permissoes?.[0] || {};
      const newPerms: Record<string, boolean> = {};
      PERMISSIONS_LIST.forEach(p => { newPerms[p.id] = perms[p.id] || false; });
      setFormPerms(newPerms);
    } else {
      form.reset({ nome: "", email: "", senha: "", setor: "" });
      setFormPerms(Object.fromEntries(PERMISSIONS_LIST.map(p => [p.id, false])));
    }
  }, [editingColab, form]);

  const manageMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const action = editingColab ? "update_colaborador" : "create_colaborador";
      const payload: any = {
        action,
        ...values,
        polo_id: meuPoloId,
        permissoes: formPerms,
      };
      if (editingColab) {
        payload.id = editingColab.id;
        if (!values.senha) delete payload.senha;
      }
      const { data, error } = await supabase.functions.invoke("manage-colaboradores", { body: payload });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(editingColab ? "Colaborador atualizado" : "Colaborador cadastrado");
      qc.invalidateQueries({ queryKey: ["minha-equipe"] });
      setIsFormOpen(false);
      setEditingColab(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { data, error } = await supabase.functions.invoke("manage-colaboradores", {
        body: { action: "update_colaborador", id, ativo },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["minha-equipe"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = colaboradores?.filter(c =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loadingMe) {
    return <div className="flex items-center justify-center h-[40vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minha Equipe"
        description={meuPoloNome ? `Gerencie a equipe do polo ${meuPoloNome}` : "Gerencie sua equipe"}
        actions={
          <Dialog open={isFormOpen} onOpenChange={(o) => { setIsFormOpen(o); if (!o) setEditingColab(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingColab(null)}>
                <Plus className="h-4 w-4 mr-2" /> Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingColab ? "Editar Colaborador" : "Cadastrar Colaborador"}</DialogTitle>
                <DialogDescription>O colaborador será vinculado automaticamente ao polo {meuPoloNome}.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => manageMutation.mutate(v))} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="nome" render={({ field }) => (
                      <FormItem><FormLabel>Nome Completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="senha" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{editingColab ? "Nova Senha (opcional)" : "Senha provisória"}</FormLabel>
                        <FormControl><Input {...field} type="password" placeholder="******" /></FormControl>
                        <FormDescription>Mínimo 6 caracteres</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="setor" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Setor</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4" /> Permissões
                    </h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4 p-4 border rounded-lg bg-muted/30">
                      {PERMISSIONS_LIST.map(perm => (
                        <div key={perm.id} className="flex items-center justify-between">
                          <span className="text-sm font-medium">{perm.label}</span>
                          <Switch
                            checked={formPerms[perm.id] || false}
                            onCheckedChange={(val) => setFormPerms(prev => ({ ...prev, [perm.id]: val }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={manageMutation.isPending}>
                      {manageMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {editingColab ? "Salvar" : "Cadastrar"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou e-mail..." className="pl-9"
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Nenhum colaborador encontrado.</TableCell></TableRow>
              ) : filtered?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{c.nome}</span>
                      {c.responsavel_polo && (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100 gap-1">
                          <Crown className="h-3 w-3" /> Responsável
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{c.setor}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.email}</TableCell>
                  <TableCell>
                    {c.ativo
                      ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Ativo</Badge>
                      : <Badge variant="secondary" className="bg-red-50 text-red-700 hover:bg-red-50 border-red-100">Inativo</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {c.responsavel_polo ? (
                      <span className="text-xs text-muted-foreground italic">Sem ações</span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => { setEditingColab(c); setIsFormOpen(true); }}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => statusMutation.mutate({ id: c.id, ativo: !c.ativo })}>
                            {c.ativo
                              ? <><UserMinus className="h-4 w-4 mr-2 text-red-500" /> Inativar</>
                              : <><UserCheck className="h-4 w-4 mr-2 text-green-500" /> Ativar</>}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
