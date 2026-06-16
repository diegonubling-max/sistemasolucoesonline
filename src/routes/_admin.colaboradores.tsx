import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Search, Pencil, Shield, Trash2, Loader2, Users, MoreHorizontal, UserCheck, UserMinus, Wallet } from "lucide-react";
import { ComissoesColaboradorDialog } from "@/components/admin/colaboradores/ComissoesColaboradorDialog";
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
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_admin/colaboradores")({
  component: ColaboradoresList,
});

const formSchema = z.object({
  nome: z.string().min(3, "Mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "Mínimo 6 caracteres").optional().or(z.literal("")),
  polo_id: z.string().uuid("Selecione um polo"),
  setor: z.string().min(1, "Selecione um setor"),
});

const SETORES = ["Vendedor", "Setor de Provas", "Cobrança", "Administrativo", "Admin Polo", "Outros"];

const PERMISSIONS_LIST = [
  { id: 'ver_alunos', label: 'Ver Alunos' },
  { id: 'cadastrar_alunos', label: 'Cadastrar Alunos' },
  { id: 'fazer_matriculas', label: 'Fazer Matrículas' },
  { id: 'ver_financeiro', label: 'Ver Financeiro' },
  { id: 'dar_baixa_pagamentos', label: 'Baixa em Pagamentos' },
  { id: 'agendar_provas', label: 'Agendar Provas' },
  { id: 'gerenciar_prova_final', label: 'Gerenciar Prova Final' },
  { id: 'ver_relatorios', label: 'Ver Relatórios' },
  { id: 'ver_configuracoes', label: 'Ver Configurações' },
];

function ColaboradoresList() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingColab, setEditingColab] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [comissoesVendedora, setComissoesVendedora] = useState<string | null>(null);
  
  const [selectedPoloId, setSelectedPoloId] = useState<string>(() => sessionStorage.getItem("selected_polo_id") || "all");

  useEffect(() => {
    const handlePoloChange = () => {
      setSelectedPoloId(sessionStorage.getItem("selected_polo_id") || "all");
    };
    window.addEventListener("polo-changed", handlePoloChange);
    return () => window.removeEventListener("polo-changed", handlePoloChange);
  }, []);

  const { data: colaborador } = useQuery({
    queryKey: ["current-colaborador", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase.from('colaboradores').select('*, colaborador_permissoes(*)').eq('user_id', session.user.id).maybeSingle();
      return data;
    },
    enabled: !!session?.user?.id
  });
  
  // State for permissions during creation/editing
  const [formPerms, setFormPerms] = useState<Record<string, boolean>>({
    ver_alunos: false,
    cadastrar_alunos: false,
    fazer_matriculas: false,
    ver_financeiro: false,
    dar_baixa_pagamentos: false,
    agendar_provas: false,
    gerenciar_prova_final: false,
    ver_relatorios: false,
    ver_configuracoes: false,
  });
  
  const { data: userRole, isLoading: loadingRole } = useQuery({
    queryKey: ["user-role", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.role;
    },
    enabled: !!session?.user?.id,
  });

  // Access check
  const isSuperAdmin = session?.user?.email === 'diegonubling@gmail.com' || userRole === 'admin';
  const isAdminPolo = (colaborador as any)?.setor === 'Admin Polo' || ((colaborador as any)?.colaborador_permissoes?.[0]?.ver_configuracoes);

  useEffect(() => {
    if (!loadingRole && session?.user) {
      if (!isSuperAdmin && !isAdminPolo) {
        toast.error("Acesso negado. Apenas administradores podem acessar esta página.");
        navigate({ to: "/" });
      }
    }
  }, [session, userRole, loadingRole, navigate, isSuperAdmin, isAdminPolo]);

  const { data: colaboradores, isLoading } = useQuery({
    queryKey: ["colaboradores", selectedPoloId],
    queryFn: async () => {
      let q = supabase
        .from("colaboradores")
        .select("*, polos(nome), colaborador_permissoes(*)")
        .order("nome");
      
      if (!isSuperAdmin && (colaborador as any)?.polo_id) {
        q = q.eq('polo_id', (colaborador as any).polo_id);
      } else if (isSuperAdmin && selectedPoloId && selectedPoloId !== 'all') {
        q = q.eq('polo_id', selectedPoloId);
      }

      const { data, error } = await q;
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

  useEffect(() => {
    if (editingColab) {
      form.reset({
        nome: editingColab.nome,
        email: editingColab.email,
        senha: "",
        polo_id: editingColab.polo_id,
        setor: editingColab.setor,
      });
      
      const perms = editingColab.colaborador_permissoes?.[0] || {};
      const newPerms: Record<string, boolean> = {};
      PERMISSIONS_LIST.forEach(p => {
        newPerms[p.id] = perms[p.id] || false;
      });
      setFormPerms(newPerms);
    } else {
      form.reset({
        nome: "",
        email: "",
        senha: "",
        polo_id: "",
        setor: "",
      });
      setFormPerms({
        ver_alunos: false,
        cadastrar_alunos: false,
        fazer_matriculas: false,
        ver_financeiro: false,
        dar_baixa_pagamentos: false,
        agendar_provas: false,
        gerenciar_prova_final: false,
        ver_relatorios: false,
        ver_configuracoes: false,
      });
    }
  }, [editingColab, form]);

  const manageMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const action = editingColab ? "update_colaborador" : "create_colaborador";
      const payload: any = { 
        action, 
        ...values, 
        permissoes: formPerms 
      };
      
      if (editingColab) {
        payload.id = editingColab.id;
        if (!values.senha) delete payload.senha;
      }

      const { data, error } = await supabase.functions.invoke("manage-colaboradores", {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(editingColab ? "Colaborador atualizado" : "Colaborador cadastrado");
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
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
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("manage-colaboradores", {
        body: { action: "delete_colaborador", id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Colaborador excluído");
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handlePermToggle = (field: string, value: boolean) => {
    setFormPerms(prev => ({ ...prev, [field]: value }));
  };

  const filteredColaboradores = colaboradores?.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Colaboradores"
        description="Gerencie os membros da sua equipe e suas permissões"
        actions={
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingColab(null);
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingColab(null)}>
                <Plus className="h-4 w-4 mr-2" /> Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingColab ? "Editar Colaborador" : "Cadastrar Colaborador"}</DialogTitle>
                <DialogDescription>
                  Preencha as informações do colaborador e defina suas permissões.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => manageMutation.mutate(v))} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo</FormLabel>
                          <FormControl><Input {...field} placeholder="Ex: João Silva" /></FormControl>
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
                          <FormControl><Input {...field} type="email" placeholder="joao@email.com" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="senha"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{editingColab ? "Nova Senha (opcional)" : "Senha"}</FormLabel>
                          <FormControl><Input {...field} type="password" placeholder="******" /></FormControl>
                          <FormDescription>Mínimo 6 caracteres</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="polo_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Polo</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um polo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {polos?.filter(p => {
                                if (isSuperAdmin) return true;
                                return p.id === (colaborador as any)?.polo_id;
                              }).map(p => (
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
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o setor" />
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
                            onCheckedChange={(val) => handlePermToggle(perm.id, val)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={manageMutation.isPending}>
                      {manageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {editingColab ? "Salvar Alterações" : "Cadastrar Colaborador"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou e-mail..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Polo</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : filteredColaboradores?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Nenhum colaborador encontrado.</TableCell></TableRow>
              ) : filteredColaboradores?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{c.polos?.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.setor}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.email}</TableCell>
                  <TableCell>
                    {c.ativo ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-red-50 text-red-700 hover:bg-red-50 border-red-100">
                        Inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => {
                          setEditingColab(c);
                          setIsFormOpen(true);
                        }}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        {c.setor === "Vendedor" && (
                          <DropdownMenuItem onClick={() => setComissoesVendedora(c.nome)}>
                            <Wallet className="h-4 w-4 mr-2 text-emerald-600" /> Comissões
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => statusMutation.mutate({ id: c.id, ativo: !c.ativo })}>
                          {c.ativo ? (
                            <><UserMinus className="h-4 w-4 mr-2 text-red-500" /> Inativar</>
                          ) : (
                            <><UserCheck className="h-4 w-4 mr-2 text-green-500" /> Ativar</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600 focus:text-red-600"
                          onClick={() => {
                            if (confirm(`Deseja realmente excluir o colaborador ${c.nome}? Esta ação também removerá o acesso dele ao sistema.`)) {
                              deleteMutation.mutate(c.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
