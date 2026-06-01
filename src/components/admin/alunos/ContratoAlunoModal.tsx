import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Copy, MessageSquare, Printer, ShieldCheck, AlertCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";


interface ContratoAlunoModalProps {
  aluno: any;
  isOpen: boolean;
  onClose: () => void;
}

export function ContratoAlunoModal({ aluno, isOpen, onClose }: ContratoAlunoModalProps) {
  const qc = useQueryClient();
  const [selectedModeloId, setSelectedModeloId] = useState<string | null>(null);
  const [contractContent, setContractContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Editor for preview/editing
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
    content: contractContent,
    onUpdate: ({ editor }) => {
      setContractContent(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && contractContent && editor.getHTML() !== contractContent) {
      editor.commands.setContent(contractContent);
    }
  }, [contractContent, editor]);

  // Fetch models
  const { data: modelos } = useQuery({
    queryKey: ["modelos-contrato"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modelos_contrato" as any)
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  // Fetch student's latest contract
  const { data: currentContrato, isLoading: isLoadingContrato, refetch: refetchContrato } = useQuery({
    queryKey: ["aluno-contrato", aluno?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("*")
        .eq("aluno_id", aluno.id)
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!aluno?.id && isOpen,
  });

  // Fetch latest matricula and related data for variable replacement
  const { data: matriculaData } = useQuery({
    queryKey: ["aluno-matricula-data", aluno?.id],
    queryFn: async () => {
      // Get latest matricula
      const { data: matricula, error: mError } = await supabase
        .from("matriculas")
        .select("id, created_at")
        .eq("aluno_id", aluno.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      if (mError) return null;

      // Get package
      const { data: mp, error: mpError } = await supabase
        .from("matricula_pacotes")
        .select("pacote_id, pacotes(*)")
        .eq("matricula_id", matricula.id)
        .maybeSingle();
      
      // Get parcelas
      const { data: parcelas, error: pError } = await supabase
        .from("parcelas")
        .select("*")
        .eq("matricula_id", matricula.id)
        .order("data_vencimento", { ascending: true });

      return {
        matricula,
        pacote: mp?.pacotes,
        parcelas: parcelas || []
      };
    },
    enabled: !!aluno?.id && isOpen && !currentContrato,
  });

  const handleGeneratePreview = async (modeloId: string) => {
    const modelo = modelos?.find((m: any) => m.id === modeloId);
    if (!modelo) return;

    let template = (modelo as any).conteudo_html;
    
    // Calculate variables
    const pacote = matriculaData?.pacote;
    const parcelas = matriculaData?.parcelas || [];
    const parcelaNormal = parcelas.find(p => p.tipo === 'parcela');
    const primeiraParcela = parcelas[0];

    const variables: Record<string, string> = {
      "[NOME_ALUNO]": aluno.nome,
      "[CPF_ALUNO]": aluno.cpf || "N/A",
      "[EMAIL_ALUNO]": aluno.email || "N/A",
      "[TELEFONE_ALUNO]": aluno.telefone || "N/A",
      "[DATA_NASCIMENTO]": aluno.data_nascimento ? format(new Date(aluno.data_nascimento), "dd/MM/yyyy") : "N/A",
      "[PACOTE_NOME]": (pacote as any)?.nome || "N/A",
      "[FORMA_PAGAMENTO]": (pacote as any)?.tipo || "N/A",
      "[VALOR_ENTRADA]": (pacote as any)?.valor_matricula?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
      "[VALOR_PARCELA]": parcelaNormal?.valor?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
      "[NUMERO_PARCELAS]": ((pacote as any)?.numero_parcelas || 0).toString(),
      "[VALOR_TOTAL]": (pacote as any)?.valor_total?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "N/A",
      "[DATA_MATRICULA]": matriculaData?.matricula ? format(new Date(matriculaData.matricula.created_at), "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy"),
      "[NOME_ESCOLA]": "Soluções Online",
      "[DATA_CONTRATO]": format(new Date(), "dd/MM/yyyy"),
      "[DATA_HOJE]": format(new Date(), "dd/MM/yyyy"),
      "[DATA_PRIMEIRA_PARCELA]": primeiraParcela && primeiraParcela.data_vencimento ? format(new Date(primeiraParcela.data_vencimento), "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy")
    };

    Object.entries(variables).forEach(([key, value]) => {
      template = template.replaceAll(key, value);
    });

    setContractContent(template);
  };

  const createContractMutation = useMutation({
    mutationFn: async () => {
      if (!aluno?.id || !contractContent) throw new Error("Dados incompletos");

      const { data, error } = await supabase
        .from('contratos')
        .insert({
          aluno_id: aluno.id,
          matricula_id: matriculaData?.matricula?.id || null,
          conteudo_html: contractContent,
          status: 'pendente'
        })
        .select('token_unico')
        .single();

      if (error) throw error;
      return data.token_unico;
    },
    onSuccess: () => {
      toast.success("Contrato gerado com sucesso!");
      refetchContrato();
      qc.invalidateQueries({ queryKey: ["alunos"] });
    },
    onError: (e: any) => toast.error("Erro ao gerar contrato: " + e.message)
  });

  const handleCopyLink = (token: string) => {
    const link = `${window.location.origin}/contrato/${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const handleWhatsApp = (token: string) => {
    const link = `${window.location.origin}/contrato/${token}`;
    const text = `Olá ${aluno.nome}! Segue o link para assinatura do seu contrato de matrícula: ${link}`;
    window.open(`https://wa.me/${aluno.telefone?.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Contrato - ${aluno.nome}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; line-height: 1.5; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            table, th, td { border: 1px solid #ddd; }
            th, td { padding: 12px; text-align: left; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${currentContrato?.conteudo_html || contractContent}
          ${currentContrato?.status === 'assinado' ? `
            <div style="margin-top: 50px; padding: 20px; border: 2px solid #10b981; background: #f0fdf4; border-radius: 8px;">
              <h3 style="margin-top: 0; color: #065f46;">Assinado Digitalmente</h3>
              <p><strong>Nome:</strong> ${currentContrato.nome_confirmacao}</p>
              <p><strong>Data/Hora:</strong> ${currentContrato.data_assinatura ? format(new Date(currentContrato.data_assinatura), "dd/MM/yyyy HH:mm") : 'N/A'}</p>
              <p><strong>IP:</strong> ${currentContrato.ip_assinatura}</p>
              <p><strong>ID de Autenticidade:</strong> ${currentContrato.id}</p>
            </div>
          ` : ''}
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!aluno) return null;

  const renderContent = () => {
    if (isLoadingContrato) {
      return (
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando dados do contrato...</p>
        </div>
      );
    }

    // CASE 3: Signed
    if (currentContrato?.status === 'assinado') {
      return (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-bold text-green-800">Contrato Assinado</h4>
              <p className="text-sm text-green-700">
                Assinado por <strong>{currentContrato.nome_confirmacao}</strong> em {currentContrato.data_assinatura ? format(new Date(currentContrato.data_assinatura), "dd/MM/yyyy 'às' HH:mm") : 'N/A'}
              </p>
              <p className="text-xs text-green-600 mt-1 font-mono">IP: {currentContrato.ip_assinatura}</p>
            </div>
          </div>

          <div className="border rounded-lg bg-white p-6 max-h-[400px] overflow-y-auto prose prose-sm max-w-none shadow-inner" dangerouslySetInnerHTML={{ __html: currentContrato.conteudo_html }} />

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" /> Imprimir / PDF
            </Button>
            <Button onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </div>
      );
    }

    // CASE 2: Pending
    if (currentContrato?.status === 'pendente') {
      return (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-800">Contrato Pendente de Assinatura</h4>
              <p className="text-sm text-amber-700">
                Gerado em {currentContrato.created_at ? format(new Date(currentContrato.created_at), "dd/MM/yyyy 'às' HH:mm") : 'N/A'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-gray-50 flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Link para Assinatura</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-white border rounded px-3 py-2 text-sm truncate font-mono">
                  {`${window.location.origin}/contrato/${currentContrato.token_unico}`}
                </div>
                <Button size="icon" variant="outline" onClick={() => handleCopyLink(currentContrato.token_unico)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white" onClick={() => handleWhatsApp(currentContrato.token_unico)}>
                <MessageSquare className="h-4 w-4 mr-2" /> Reenviar por WhatsApp
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" /> Imprimir
              </Button>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <h4 className="text-sm font-semibold mb-2">Visualização do Conteúdo</h4>
            <div className="border rounded-lg bg-white p-6 max-h-[300px] overflow-y-auto prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: currentContrato.conteudo_html }} />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </div>
      );
    }

    // CASE 1: No contract
    return (
      <div className="space-y-6">
        {!contractContent ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selecione o Modelo de Contrato</label>
              <Select onValueChange={(val) => {
                setSelectedModeloId(val);
                handleGeneratePreview(val);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um modelo..." />
                </SelectTrigger>
                <SelectContent>
                  {modelos?.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {!matriculaData?.matricula && (
              <div className="p-3 bg-red-50 border border-red-100 rounded text-xs text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>Este aluno não possui matrícula ativa. Algumas variáveis podem não ser preenchidas.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Preview do Contrato</h4>
              <Button variant="ghost" size="sm" onClick={() => setContractContent("")} className="text-xs h-8">
                Mudar modelo
              </Button>
            </div>
            
            <div className="border rounded-lg overflow-hidden bg-white shadow-inner">
              <div className="border-b bg-gray-50 px-3 py-2 flex items-center gap-2 overflow-x-auto no-print">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor?.chain().focus().toggleBold().run()}>
                  <span className="font-bold">B</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor?.chain().focus().toggleItalic().run()}>
                  <span className="italic">I</span>
                </Button>
                <div className="w-px h-4 bg-gray-300 mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
                  <TextAlignLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
                  <TextAlignCenter className="h-4 w-4" />
                </Button>
              </div>
              <EditorContent editor={editor} className="p-6 prose prose-sm max-w-none max-h-[400px] overflow-y-auto" />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button onClick={() => createContractMutation.mutate()} disabled={createContractMutation.isPending}>
                {createContractMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Gerar Link de Assinatura
              </Button>
            </DialogFooter>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <DialogTitle>Gestão de Contrato — {aluno?.nome}</DialogTitle>
          </div>
          <DialogDescription>
            Visualize, gere ou envie o contrato de matrícula do aluno.
          </DialogDescription>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}

function TextAlignLeft({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="17" y1="10" x2="3" y2="10"></line>
      <line x1="21" y1="6" x2="3" y2="6"></line>
      <line x1="21" y1="14" x2="3" y2="14"></line>
      <line x1="17" y1="18" x2="3" y2="18"></line>
    </svg>
  );
}

function TextAlignCenter({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="10" x2="6" y2="10"></line>
      <line x1="21" y1="6" x2="3" y2="6"></line>
      <line x1="21" y1="14" x2="3" y2="14"></line>
      <line x1="18" y1="18" x2="6" y2="18"></line>
    </svg>
  );
}
