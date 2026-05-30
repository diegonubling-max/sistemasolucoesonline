import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/contrato/$token")({
  component: PublicContractPage,
});

function PublicContractPage() {
  const { token } = Route.useParams();
  const [nomeConfirmacao, setNomeConfirmacao] = useState("");
  const [isSigning, setIsSigning] = useState(false);

  const { data: contrato, isLoading, refetch } = useQuery({
    queryKey: ["public-contract", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("*, alunos(nome)")
        .eq("token_unico", token)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const signContract = useMutation({
    mutationFn: async () => {
      if (!nomeConfirmacao) throw new Error("Digite seu nome completo para confirmar");
      
      // Get client IP (approximate via public API or just record it's a web signature)
      let ip = "0.0.0.0";
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        ip = data.ip;
      } catch (e) {
        console.error("IP fetch failed", e);
      }

      const { error } = await supabase
        .from("contratos")
        .update({
          status: 'assinado',
          data_assinatura: new Date().toISOString(),
          ip_assinatura: ip,
          nome_confirmacao: nomeConfirmacao
        })
        .eq("token_unico", token);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrato assinado com sucesso!");
      refetch();
    },
    onError: (e: any) => toast.error(e.message)
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!contrato) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center p-8">
          <h1 className="text-2xl font-bold text-destructive mb-2">Contrato não encontrado</h1>
          <p className="text-muted-foreground">O link acessado é inválido ou o contrato expirou.</p>
        </Card>
      </div>
    );
  }

  if (contrato.status === 'assinado') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-2xl w-full space-y-6">
          <Card className="border-green-100 bg-green-50/30 overflow-hidden">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-green-800">Assinatura Confirmada!</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-green-700">
                O contrato foi assinado digitalmente com sucesso por <strong>{contrato.nome_confirmacao}</strong>.
              </p>
              <div className="bg-white p-4 rounded-lg border border-green-100 text-left text-xs space-y-1">
                <p><strong>Data/Hora:</strong> {contrato.data_assinatura ? new Date(contrato.data_assinatura).toLocaleString('pt-BR') : 'N/A'}</p>
                <p><strong>IP de Registro:</strong> {contrato.ip_assinatura}</p>
                <p><strong>Autenticidade:</strong> {contrato.id}</p>
              </div>
            </CardContent>
          </Card>
          <div className="text-center">
             <p className="text-sm text-muted-foreground">Você pode fechar esta aba agora.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Contrato de Matrícula</h1>
              <p className="text-xs text-muted-foreground">Assinatura Eletrônica</p>
            </div>
          </div>
          <div className="hidden sm:block">
            <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5">
              Aguardando Assinatura
            </Badge>
          </div>
        </header>

        <Card className="shadow-md border-none overflow-hidden">
          <CardContent className="p-0">
             <div 
               className="p-8 prose prose-sm sm:prose-base max-w-none bg-white min-h-[600px]"
               dangerouslySetInnerHTML={{ __html: contrato.conteudo_html }}
             />
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-white shadow-lg sticky bottom-6 z-10">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Assinar Documento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ao digitar seu nome abaixo e clicar no botão, você declara que leu e concorda com todos os termos deste contrato.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2 w-full">
                <label className="text-xs font-bold uppercase text-gray-500">Nome Completo</label>
                <Input 
                  placeholder="Digite seu nome completo conforme documento"
                  value={nomeConfirmacao}
                  onChange={(e) => setNomeConfirmacao(e.target.value)}
                  className="h-12 text-lg"
                />
              </div>
              <Button 
                size="lg" 
                className="h-12 px-8 font-bold w-full sm:w-auto"
                disabled={!nomeConfirmacao || signContract.isPending}
                onClick={() => signContract.mutate()}
              >
                {signContract.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Li e aceito o contrato
              </Button>
            </div>
          </CardContent>
        </Card>

        <footer className="text-center py-4 text-[10px] text-muted-foreground">
          Assinatura digital válida para fins de matrícula escolar conforme as diretrizes da escola.
        </footer>
      </div>
    </div>
  );
}

function Badge({ children, variant, className }: any) {
  return (
    <span className={cn(
      "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
      variant === "outline" ? "border" : "bg-primary text-white",
      className
    )}>
      {children}
    </span>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
