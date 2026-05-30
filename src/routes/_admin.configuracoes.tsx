import { createFileRoute } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Settings, Save, Loader2, MessageSquare, School, Phone, Eye, EyeOff, 
  Link2, FileText, Copy, ShieldPlus, Bell, Bold, Italic, 
  Underline as UnderlineIcon, List, ListOrdered, AlignLeft, 
  AlignCenter, AlignRight, AlignJustify, Table as TableIcon
} from "lucide-react";
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
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Gapcursor } from '@tiptap/extension-gapcursor';


export const Route = createFileRoute("/_admin/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Painel Admin" }] }),
  component: AdminSettings,
});

function AdminSettings() {
  const queryClient = useQueryClient();
  
  const { data: configs, isLoading, isError, error: fetchError } = useQuery({
    queryKey: ["admin-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("*");
      if (error) {
        console.error("Erro ao buscar configurações:", error);
        throw error;
      }
      return data;
    },
    retry: 1,
  });


  const [whatsappSuporte, setWhatsappSuporte] = useState("");
  const [mensagemWhatsapp, setMensagemWhatsapp] = useState("");
  const [nomeEscola, setNomeEscola] = useState("");
  const [asaasApiKey, setAsaasApiKey] = useState("");
  const [asaasAmbiente, setAsaasAmbiente] = useState("producao");
  const [asaasWebhookToken, setAsaasWebhookToken] = useState("");
  const [modeloContrato, setModeloContrato] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookToken, setShowWebhookToken] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [activeTab, setActiveTab] = useState("geral");

  const tabs = [
    { id: "geral", label: "Geral", icon: School },
    { id: "asaas", label: "Integração Asaas", icon: Link2 },
    { id: "contrato", label: "Modelo de Contrato", icon: FileText },
    { id: "webhook", label: "Webhook", icon: Bell },
    { id: "admins", label: "Administradores", icon: ShieldPlus },
  ];


  useEffect(() => {
    if (configs) {
      setWhatsappSuporte(configs.find(c => c.chave === "whatsapp_suporte")?.valor || "");
      setMensagemWhatsapp(configs.find(c => c.chave === "mensagem_whatsapp")?.valor || "");
      setNomeEscola(configs.find(c => c.chave === "nome_escola")?.valor || "");
      setAsaasApiKey(configs.find(c => c.chave === "asaas_api_key")?.valor || "");
      setAsaasAmbiente(configs.find(c => c.chave === "asaas_ambiente")?.valor || "producao");
      setAsaasWebhookToken(configs.find(c => c.chave === "asaas_webhook_token")?.valor || "");
      setModeloContrato(configs.find(c => c.chave === "modelo_contrato")?.valor || "");
    }
  }, [configs]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Gapcursor,
    ],
    content: modeloContrato,
    onUpdate: ({ editor }) => {
      setModeloContrato(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && modeloContrato && editor.getHTML() !== modeloContrato) {
      editor.commands.setContent(modeloContrato);
    }
  }, [modeloContrato, editor]);


  const updateConfig = useMutation({
    mutationFn: async ({ chave, valor }: { chave: string, valor: string }) => {
      // Clean up variables format before saving
      let processedValue = valor;
      if (chave === "modelo_contrato") {
        processedValue = processedValue
          .replace(/\$nome\$/g, "[NOME_ALUNO]")
          .replace(/\$cpf\$/g, "[CPF_ALUNO]")
          .replace(/\$fone\$/g, "[TELEFONE_ALUNO]")
          .replace(/\$entrada\$/g, "[VALOR_ENTRADA]")
          .replace(/\$quant_parcelas\$/g, "[NUMERO_PARCELAS]")
          .replace(/\$valor_parcela_normal\$/g, "[VALOR_PARCELA]")
          .replace(/\$dataprimeira_parcela\$/g, "[DATA_MATRICULA]")
          // Remove non-existent fields
          .replace(/\$bairro\$/g, "")
          .replace(/\$cidade\$/g, "")
          .replace(/\$estado\$/g, "");
      }

      const { error } = await supabase
        .from("configuracoes")
        .update({ valor: processedValue })
        .eq("chave", chave);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-configs"] });
      toast.success("Configuração salva com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar configuração: " + error.message);
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

  if (isError) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <Settings className="h-5 w-5" />
              <CardTitle>Erro ao carregar configurações</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-red-700">
              Não foi possível carregar as configurações do sistema. Isso pode ser um problema de permissão ou conexão.
            </p>
            <div className="bg-white/50 p-3 rounded border border-red-100 font-mono text-xs text-red-800 overflow-auto">
              {(fetchError as any)?.message || "Erro desconhecido"}
            </div>
            <Button 
              variant="outline" 
              className="border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-configs"] })}
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


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
                <section className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <School className="h-5 w-5 text-primary" />
                    <h3 className="text-xl font-semibold text-gray-800">Informações da Escola</h3>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Nome da escola</CardTitle>
                      <CardDescription>Este nome será exibido em várias partes do sistema</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="school-name">Nome da escola</Label>
                        <div className="flex gap-2">
                          <Input
                            id="school-name"
                            value={nomeEscola}
                            onChange={(e) => setNomeEscola(e.target.value)}
                            placeholder="Nome da sua escola"
                          />
                          <Button 
                            onClick={() => updateConfig.mutate({ chave: "nome_escola", valor: nomeEscola })}
                            disabled={updateConfig.isPending}
                          >
                            {updateConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Salvar
                          </Button>
                        </div>
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
                      <CardDescription>Configure o número e a mensagem padrão para o atendimento</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="whatsapp-number">Número do WhatsApp</Label>
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
                        <p className="text-xs text-muted-foreground">
                          Digite o número com DDI e DDD sem espaços ou símbolos. Ex: 5551999999999
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="whatsapp-message">Mensagem pré-definida</Label>
                        <Textarea
                          id="whatsapp-message"
                          rows={4}
                          placeholder="Olá! Preciso de ajuda..."
                          value={mensagemWhatsapp}
                          onChange={(e) => setMensagemWhatsapp(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Use <code className="bg-muted px-1 rounded text-primary">[nome]</code> e <code className="bg-muted px-1 rounded text-primary">[ctr]</code> para incluir os dados do aluno automaticamente
                        </p>
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button 
                          onClick={() => updateMultipleConfigs.mutate([
                            { chave: "whatsapp_suporte", valor: whatsappSuporte },
                            { chave: "mensagem_whatsapp", valor: mensagemWhatsapp }
                          ])}
                          disabled={updateMultipleConfigs.isPending}
                          className="w-full sm:w-auto"
                        >
                          {updateMultipleConfigs.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Salvar Alterações do WhatsApp
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </section>
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
                          onClick={() => updateConfig.mutate({ chave: "asaas_api_key", valor: asaasApiKey })}
                          disabled={updateConfig.isPending}
                        >
                          {updateConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
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
                          onClick={() => updateConfig.mutate({ chave: "asaas_ambiente", valor: asaasAmbiente })}
                          disabled={updateConfig.isPending}
                        >
                          {updateConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
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
                          onClick={() => updateConfig.mutate({ chave: "asaas_webhook_token", valor: asaasWebhookToken })}
                          disabled={updateConfig.isPending}
                        >
                          {updateConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
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
              <div className="animate-in slide-in-from-right-2 duration-300">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Editor de Contrato</CardTitle>
                    <CardDescription>Configure o texto padrão do contrato que os alunos assinarão</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                      <div className="xl:col-span-3 space-y-4">
                        <div className="bg-white border rounded-md overflow-hidden flex flex-col min-h-[500px]">
                          {editor && (
                            <div className="border-b bg-gray-50 p-2 flex flex-wrap gap-1 sticky top-0 z-10">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleBold().run()}
                                className={editor.isActive('bold') ? 'bg-gray-200' : ''}
                              >
                                <Bold className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleItalic().run()}
                                className={editor.isActive('italic') ? 'bg-gray-200' : ''}
                              >
                                <Italic className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleUnderline().run()}
                                className={editor.isActive('underline') ? 'bg-gray-200' : ''}
                              >
                                <UnderlineIcon className="h-4 w-4" />
                              </Button>
                              <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                                className={editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200' : ''}
                              >
                                <AlignLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                                className={editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200' : ''}
                              >
                                <AlignCenter className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                                className={editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200' : ''}
                              >
                                <AlignRight className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                                className={editor.isActive({ textAlign: 'justify' }) ? 'bg-gray-200' : ''}
                              >
                                <AlignJustify className="h-4 w-4" />
                              </Button>
                              <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleBulletList().run()}
                                className={editor.isActive('bulletList') ? 'bg-gray-200' : ''}
                              >
                                <List className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                                className={editor.isActive('orderedList') ? 'bg-gray-200' : ''}
                              >
                                <ListOrdered className="h-4 w-4" />
                              </Button>
                              <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                                title="Inserir Tabela"
                              >
                                <TableIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().deleteTable().run()}
                                disabled={!editor.isActive('table')}
                                title="Excluir Tabela"
                                className={!editor.isActive('table') ? 'opacity-50' : 'text-red-500'}
                              >
                                <TableIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          <div className="flex-1 p-4 prose prose-sm max-w-none focus:outline-none overflow-y-auto">
                            <EditorContent editor={editor} />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button 
                            onClick={() => updateConfig.mutate({ chave: "modelo_contrato", valor: modeloContrato })}
                            disabled={updateConfig.isPending}
                          >
                            {updateConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Salvar Modelo de Contrato
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
                            "[VALOR_TOTAL]", "[DATA_MATRICULA]", "[NOME_ESCOLA]", "[DATA_CONTRATO]"
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
