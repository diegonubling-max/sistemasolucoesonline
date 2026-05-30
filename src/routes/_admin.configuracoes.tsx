import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Save, Loader2, MessageSquare, School, Phone, Eye, EyeOff, Link2, FileText, Copy, ShieldPlus } from "lucide-react";
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
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export const Route = createFileRoute("/_admin/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Painel Admin" }] }),
  component: AdminSettings,
});

function AdminSettings() {
  const queryClient = useQueryClient();
  
  const { data: configs, isLoading } = useQuery({
    queryKey: ["admin-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("*");
      if (error) throw error;
      return data;
    },
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

  const updateConfig = useMutation({
    mutationFn: async ({ chave, valor }: { chave: string, valor: string }) => {
      const { error } = await supabase
        .from("configuracoes")
        .update({ valor })
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 border-b pb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Configurações</h1>
          <p className="text-gray-500">Gerencie as informações globais do sistema</p>
        </div>
      </div>

      <div className="grid gap-8 max-w-4xl">
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-gray-800">Contato e Suporte</h2>
          </div>
          
          <div className="grid gap-6">
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
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <School className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-gray-800">Informações da Escola</h2>
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

        <section className="space-y-4 pb-12">
          <div className="flex items-center gap-2 px-1">
            <Link2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-gray-800">Integração Asaas</h2>
          </div>
          
          <div className="grid gap-6">
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
        </section>

        <section className="space-y-4 pb-12">
          <div className="flex items-center gap-2 px-1">
            <ShieldPlus className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-gray-800">Novo Administrador</h2>
          </div>
          
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
        </section>

          <div className="flex items-center gap-2 px-1">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-gray-800">Modelo de Contrato</h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Editor de Contrato</CardTitle>
              <CardDescription>Configure o texto padrão do contrato que os alunos assinarão</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3 space-y-4">
                  <div className="bg-white border rounded-md overflow-hidden">
                    <ReactQuill 
                      theme="snow" 
                      value={modeloContrato} 
                      onChange={setModeloContrato}
                      modules={{
                        toolbar: [
                          [{ 'header': [1, 2, 3, false] }],
                          ['bold', 'italic', 'underline', 'strike'],
                          [{'list': 'ordered'}, {'list': 'bullet'}],
                          [{ 'align': [] }],
                          ['clean']
                        ],
                      }}
                      className="min-h-[400px]"
                    />
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
                  <h3 className="font-semibold text-sm">Variáveis Disponíveis</h3>
                  <p className="text-xs text-muted-foreground">Clique para copiar e cole no editor</p>
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
        </section>
      </div>
    </div>
  );
}
