import { createFileRoute } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Settings, Save, Loader2, MessageSquare, School, Phone, 
  Link2, FileText, Copy, ShieldPlus, Bell, Plus, Trash2,
  Eye, EyeOff, Upload, Image as ImageIcon
} from "lucide-react";
import { BannersPoloManager } from "@/components/admin/BannersPoloManager";


import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useAuth } from "@/hooks/use-auth";
import { usePushNotifications } from "@/hooks/use-push-notifications";



export const Route = createFileRoute("/_admin/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Painel Admin" }] }),
  component: AdminSettings,
});

function AdminSettings() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  
  const [selectedPoloId, setSelectedPoloId] = useState<string>(() => sessionStorage.getItem("selected_polo_id") || "all");
  const [polos, setPolos] = useState<any[]>([]);
  const [isLoadingPolos, setIsLoadingPolos] = useState(true);

  const { data: userRole } = useQuery({
    queryKey: ["user-role", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).maybeSingle();
      return data?.role;
    },
    enabled: !!session?.user?.id
  });

  const isSuperAdmin = session?.user?.email === 'diegonubling@gmail.com' || userRole === 'admin';

  useEffect(() => {
    async function fetchPolos() {
      const { data } = await supabase.from("polos").select("*").eq("ativo", true).order("nome");
      if (data) setPolos(data);
      setIsLoadingPolos(false);
    }
    fetchPolos();
  }, []);

  useEffect(() => {
    const handlePoloChange = () => {
      setSelectedPoloId(sessionStorage.getItem("selected_polo_id") || "all");
    };
    window.addEventListener("polo-changed", handlePoloChange);
    return () => window.removeEventListener("polo-changed", handlePoloChange);
  }, []);

  const currentPoloId = isSuperAdmin ? (selectedPoloId === 'all' ? null : selectedPoloId) : null;

  const { data: poloData, isLoading: isLoadingPoloConfig } = useQuery({
    queryKey: ["polo-config", currentPoloId],
    queryFn: async () => {
      if (!currentPoloId && isSuperAdmin) return null;
      
      let targetId = currentPoloId;
      
      if (!isSuperAdmin) {
        const { data: colab } = await supabase.from('colaboradores').select('polo_id').eq('user_id', session?.user?.id || "").maybeSingle();
        targetId = colab?.polo_id || null;
      }

      if (!targetId) return null;

      const { data, error } = await supabase
        .from("polos")
        .select("*")
        .eq("id", targetId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const { data: modelos, isLoading: isModelosLoading } = useQuery({
    queryKey: ["modelos-contrato"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modelos_contrato" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isLoading = isLoadingPoloConfig || isModelosLoading || isLoadingPolos;

  const [whatsappSuporte, setWhatsappSuporte] = useState("");
  const [nomeEscola, setNomeEscola] = useState("");
  const [asaasApiKey, setAsaasApiKey] = useState("");
  const [asaasAmbiente, setAsaasAmbiente] = useState("producao");
  const [asaasWebhookToken, setAsaasWebhookToken] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  
  const [modeloContrato, setModeloContrato] = useState("");
  const [nomeModelo, setNomeModelo] = useState("");
  const [editingModeloId, setEditingModeloId] = useState<string | null>(null);
  const [isEditingModelo, setIsEditingModelo] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookToken, setShowWebhookToken] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [activeTab, setActiveTab] = useState("geral");

  useEffect(() => {
    if (poloData) {
      setWhatsappSuporte(poloData.whatsapp || "");
      setNomeEscola(poloData.nome_escola || "");
      setAsaasApiKey(poloData.asaas_api_key || "");
      setAsaasAmbiente(poloData.asaas_ambiente || "producao");
      setAsaasWebhookToken(poloData.asaas_webhook_token || "");
      setLogoUrl(poloData.logo_url || "");
    }
  }, [poloData]);

  const updatePoloConfig = useMutation({
    mutationFn: async (values: any) => {
      let targetId = currentPoloId;
      if (!isSuperAdmin) {
        const { data: colab } = await supabase.from('colaboradores').select('polo_id').eq('user_id', session?.user?.id || "").maybeSingle();
        targetId = colab?.polo_id || null;
      }

      if (!targetId) throw new Error("Polo não identificado");

      const { error } = await supabase
        .from("polos")
        .update(values)
        .eq("id", targetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polo-config"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar: " + error.message);
    },
  });


  const saveModeloMutation = useMutation({
    mutationFn: async () => {
      const processedContent = modeloContrato
        .replace(/\$nome\$/g, "[NOME_ALUNO]")
        .replace(/\$cpf\$/g, "[CPF_ALUNO]")
        .replace(/\$fone\$/g, "[TELEFONE_ALUNO]")
        .replace(/\$entrada\$/g, "[VALOR_ENTRADA]")
        .replace(/\$quant_parcelas\$/g, "[NUMERO_PARCELAS]")
        .replace(/\$valor_parcela_normal\$/g, "[VALOR_PARCELA]")
        .replace(/\$dataprimeira_parcela\$/g, "[DATA_MATRICULA]")
        .replace(/\$bairro\$/g, "")
        .replace(/\$cidade\$/g, "")
        .replace(/\$estado\$/g, "");

      if (editingModeloId) {
        const { error } = await supabase
          .from("modelos_contrato" as any)
          .update({
            nome: nomeModelo,
            conteudo_html: processedContent
          } as any)
          .eq("id", editingModeloId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("modelos_contrato" as any)
          .insert({
            nome: nomeModelo,
            conteudo_html: processedContent
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modelos-contrato"] });
      toast.success("Modelo de contrato salvo com sucesso!");
      setIsEditingModelo(false);
      setEditingModeloId(null);
      setNomeModelo("");
      setModeloContrato("");
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar modelo: " + error.message);
    },
  });

  const deleteModeloMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("modelos_contrato" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modelos-contrato"] });
      toast.success("Modelo excluído com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir modelo: " + error.message);
    },
  });

  const updateMultipleConfigs = useMutation({
    mutationFn: async (items: { chave: string, valor: string }[]) => {
      const promises = items.map(item => 
        supabase
          .from("configuracoes")
          .update({ valor: item.valor })
          .eq("chave", item.chave)
      );
      const results = await Promise.all(promises);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-configs"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar configurações: " + error.message);
    },
  });

  const createAdminMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-student-access", {
        body: { 
          action: "create_admin",
          email: newAdminEmail,
          password: newAdminPassword
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Novo administrador criado com sucesso!");
      setNewAdminEmail("");
      setNewAdminPassword("");
    },
    onError: (error: any) => {
      toast.error("Erro ao criar administrador: " + error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-gray-500">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "geral", label: "Geral", icon: School },
    { id: "asaas", label: "Integração Asaas", icon: Link2 },
    { id: "contrato", label: "Modelo de Contrato", icon: FileText },
    { id: "webhook", label: "Webhook", icon: Bell },
    { id: "banners", label: "Banners dos Polos", icon: ImageIcon },
    ...(isSuperAdmin ? [{ id: "notificacoes", label: "Notificações", icon: Bell }] : []),
    ...(isSuperAdmin ? [{ id: "admins", label: "Administradores", icon: ShieldPlus }] : []),
  ];

  const { permission: pushPermission, isWorking: pushWorking, requestAndRegister: enablePush } =
    usePushNotifications(isSuperAdmin, session?.user?.id);
  const pushStatusLabel =
    pushPermission === "granted" ? "Ativada"
    : pushPermission === "denied" ? "Desativada"
    : pushPermission === "unsupported" ? "Não suportado"
    : "Pendente";
  const pushStatusColor =
    pushPermission === "granted" ? "text-green-600"
    : pushPermission === "denied" ? "text-red-600"
    : "text-amber-600";



  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-3 border-b pb-6 mb-8">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Configurações</h1>
          <p className="text-gray-500">Gerencie as informações globais do sistema</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Menu */}
        <aside className="w-full md:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </aside>

        {/* Content Area */}
        <div className="flex-1 max-w-4xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
          </div>

          <div className="space-y-8">
            {activeTab === 'geral' && (
              <div className="space-y-8 animate-in slide-in-from-right-2 duration-300">
                {isSuperAdmin && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        Seletor de Polo
                      </CardTitle>
                      <CardDescription>
                        Como Super Admin, você deve selecionar um polo para visualizar e editar suas configurações específicas.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Select 
                        value={selectedPoloId} 
                        onValueChange={(val) => {
                          setSelectedPoloId(val);
                          sessionStorage.setItem("selected_polo_id", val);
                          window.dispatchEvent(new Event("polo-changed"));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um polo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Selecione um polo para configurar...</SelectItem>
                          {polos.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                )}

                {(!currentPoloId && isSuperAdmin) ? (
                  <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
                    <School className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground font-medium">Por favor, selecione um polo no seletor acima para gerenciar as configurações.</p>
                  </div>
                ) : (
                  <>
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <School className="h-5 w-5 text-primary" />
                        <h3 className="text-xl font-semibold text-gray-800">Informações da Unidade</h3>
                      </div>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Nome e Logo</CardTitle>
                          <CardDescription>Configure como esta unidade aparece para os alunos</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="space-y-2">
                            <Label htmlFor="school-name">Nome da escola neste polo</Label>
                            <Input
                              id="school-name"
                              value={nomeEscola}
                              onChange={(e) => setNomeEscola(e.target.value)}
                              placeholder="Ex: Soluções Online - Unidade Matriz"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="logo-url">URL da Logotipo</Label>
                            <div className="flex gap-2">
                              <Input
                                id="logo-url"
                                value={logoUrl}
                                onChange={(e) => setLogoUrl(e.target.value)}
                                placeholder="https://..."
                              />
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <Button 
                              onClick={() => updatePoloConfig.mutate({ nome_escola: nomeEscola, logo_url: logoUrl })}
                              disabled={updatePoloConfig.isPending}
                            >
                              {updatePoloConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                              Salvar Identidade
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        <h3 className="text-xl font-semibold text-gray-800">Contato e Suporte</h3>
                      </div>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">WhatsApp de Suporte</CardTitle>
                          <CardDescription>Configure o número de WhatsApp que os alunos deste polo verão.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="space-y-2">
                            <Label htmlFor="whatsapp-number">Número do WhatsApp (com DDI e DDD)</Label>
                            <div className="relative">
                              <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input
                                id="whatsapp-number"
                                placeholder="Ex: 5551999999999"
                                className="pl-9"
                                value={whatsappSuporte}
                                onChange={(e) => setWhatsappSuporte(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <Button 
                              onClick={() => updatePoloConfig.mutate({ whatsapp: whatsappSuporte })}
                              disabled={updatePoloConfig.isPending}
                              className="w-full sm:w-auto"
                            >
                              {updatePoloConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                              Salvar WhatsApp
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </section>
                  </>
                )}
              </div>
            )}

            {activeTab === 'asaas' && (
              <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Chave API Asaas</CardTitle>
                    <CardDescription>Insira sua chave de API para integração de pagamentos</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="asaas-key">Chave API</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="asaas-key"
                            type={showApiKey ? "text" : "password"}
                            placeholder="$aact_prod_..."
                            value={asaasApiKey}
                            onChange={(e) => setAsaasApiKey(e.target.value)}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <Button 
                          onClick={() => updatePoloConfig.mutate({ asaas_api_key: asaasApiKey })}
                          disabled={updatePoloConfig.isPending}
                        >
                          {updatePoloConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Ambiente</CardTitle>
                    <CardDescription>Selecione entre o ambiente de testes ou produção</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="asaas-env">Ambiente do Asaas</Label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Select 
                            value={asaasAmbiente} 
                            onValueChange={(value) => setAsaasAmbiente(value)}
                          >
                            <SelectTrigger id="asaas-env">
                              <SelectValue placeholder="Selecione o ambiente" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="producao">Produção</SelectItem>
                              <SelectItem value="sandbox">Sandbox/Testes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button 
                          onClick={() => updatePoloConfig.mutate({ asaas_ambiente: asaasAmbiente })}
                          disabled={updatePoloConfig.isPending}
                        >
                          {updatePoloConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'webhook' && (
              <div className="animate-in slide-in-from-right-2 duration-300">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Token do Webhook Asaas</CardTitle>
                    <CardDescription>Insira o token de segurança para validar notificações do Asaas</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="asaas-webhook">Token do Webhook</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="asaas-webhook"
                            type={showWebhookToken ? "text" : "password"}
                            placeholder="whsec_..."
                            value={asaasWebhookToken}
                            onChange={(e) => setAsaasWebhookToken(e.target.value)}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowWebhookToken(!showWebhookToken)}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {showWebhookToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <Button 
                          onClick={() => updatePoloConfig.mutate({ asaas_webhook_token: asaasWebhookToken })}
                          disabled={updatePoloConfig.isPending}
                        >
                          {updatePoloConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Salvar
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Dica: Encontre em Integrações → Webhooks no painel do Asaas
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'contrato' && (
              <div className="animate-in slide-in-from-right-2 duration-300 space-y-6">
                {!isEditingModelo ? (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Modelos de Contrato</CardTitle>
                        <CardDescription>Gerencie seus templates de contrato</CardDescription>
                      </div>
                      <Button onClick={() => {
                        setIsEditingModelo(true);
                        setEditingModeloId(null);
                        setNomeModelo("");
                        setModeloContrato("");
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Modelo
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {modelos?.map((m: any) => (
                          <div key={m.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-primary" />
                              <span className="font-medium text-gray-900">{m.nome}</span>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => {
                                setEditingModeloId(m.id);
                                setNomeModelo(m.nome);
                                setModeloContrato(m.conteudo_html);
                                setIsEditingModelo(true);
                              }}>
                                Editar
                              </Button>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => {
                                if (confirm("Tem certeza que deseja excluir este modelo?")) {
                                  deleteModeloMutation.mutate(m.id);
                                }
                              }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {(!modelos || modelos.length === 0) && (
                          <div className="text-center py-8 text-gray-500 italic">
                            Nenhum modelo cadastrado.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{editingModeloId ? 'Editar Modelo' : 'Novo Modelo'}</CardTitle>
                        <CardDescription>Configure o nome e o conteúdo do template</CardDescription>
                      </div>
                      <Button variant="outline" onClick={() => setIsEditingModelo(false)}>
                        Cancelar
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="modelo-nome">Nome do Modelo</Label>
                        <Input
                          id="modelo-nome"
                          value={nomeModelo}
                          onChange={(e) => setNomeModelo(e.target.value)}
                          placeholder="Ex: Contrato de Matrícula Padrão"
                        />
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                        <div className="xl:col-span-3 space-y-4">
                          <Label>Conteúdo do Contrato</Label>
                          <div className="flex flex-col min-h-[500px]">
                            <RichTextEditor
                              content={modeloContrato}
                              onChange={setModeloContrato}
                              className="flex-1"
                            />
                          </div>

                          <div className="flex justify-end">
                            <Button 
                              onClick={() => saveModeloMutation.mutate()}
                              disabled={saveModeloMutation.isPending || !nomeModelo}
                            >
                              {saveModeloMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                              Salvar Modelo
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <h4 className="font-semibold text-sm">Variáveis Disponíveis</h4>
                          <p className="text-xs text-muted-foreground italic">Clique para copiar e cole no editor</p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              "[NOME_ALUNO]", "[CPF_ALUNO]", "[EMAIL_ALUNO]", "[TELEFONE_ALUNO]", 
                              "[DATA_NASCIMENTO]", "[PACOTE_NOME]", "[FORMA_PAGAMENTO]", 
                              "[VALOR_ENTRADA]", "[VALOR_PARCELA]", "[NUMERO_PARCELAS]", 
                              "[VALOR_TOTAL]", "[DATA_MATRICULA]", "[NOME_ESCOLA]", "[DATA_HOJE]", "[DATA_PRIMEIRA_PARCELA]"
                            ].map((variable) => (
                              <Button
                                key={variable}
                                variant="outline"
                                size="sm"
                                className="text-[10px] h-7"
                                onClick={() => {
                                  navigator.clipboard.writeText(variable);
                                  toast.success(`Copiado: ${variable}`);
                                }}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                {variable}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'banners' && (
              <div className="animate-in slide-in-from-right-2 duration-300">
                <BannersPoloManager isSuperAdmin={isSuperAdmin} />
              </div>
            )}

            {activeTab === 'admins' && (
              <div className="animate-in slide-in-from-right-2 duration-300">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Criar conta Admin</CardTitle>
                    <CardDescription>Crie um novo usuário com permissões de administrador</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="admin-email">E-mail do Administrador</Label>
                        <Input
                          id="admin-email"
                          type="email"
                          placeholder="exemplo@email.com"
                          value={newAdminEmail}
                          onChange={(e) => setNewAdminEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-password">Senha</Label>
                        <Input
                          id="admin-password"
                          type="password"
                          placeholder="Senha desejada"
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button 
                        onClick={() => {
                          if (!newAdminEmail || !newAdminPassword) {
                            toast.error("Preencha e-mail e senha");
                            return;
                          }
                          createAdminMutation.mutate();
                        }}
                        disabled={createAdminMutation.isPending}
                        className="w-full sm:w-auto"
                      >
                        {createAdminMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldPlus className="h-4 w-4 mr-2" />}
                        Criar Administrador
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
