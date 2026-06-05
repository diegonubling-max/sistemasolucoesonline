import { useState } from "react";
import { FileText, X, Loader2, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PdfUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  className?: string;
}

export function PdfUpload({
  value,
  onChange,
  className,
}: PdfUploadProps) {
  const [uploading, setUploading] = useState(false);

  // Extrair nome do arquivo da URL para exibição
  const getFileName = (url: string) => {
    try {
      const parts = url.split("/");
      const fileName = parts[parts.length - 1];
      // Remover o hash aleatório se houver (opcional)
      return decodeURIComponent(fileName);
    } catch (e) {
      return "arquivo.pdf";
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Por favor, selecione um arquivo PDF.");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Usaremos o bucket 'documentos' que geralmente existe ou deve ser criado
      // Como não tenho certeza do bucket, vou tentar usar um genérico ou pedir para criar
      // Por padrão em Lovable, costumamos ter 'thumbnails-cursos', vou assumir um bucket 'documentos'
      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(filePath, file);

      if (uploadError) {
        if (uploadError.message.includes("bucket not found")) {
           throw new Error("O bucket 'documentos' não foi encontrado. Por favor, crie-o no painel do Supabase.");
        }
        throw uploadError;
      }

      const { data } = supabase.storage.from("documentos").getPublicUrl(filePath);
      onChange(data.publicUrl);
      toast.success("PDF enviado com sucesso!");
    } catch (error) {
      console.error("Erro no upload:", error);
      toast.error("Erro ao enviar PDF", {
        description: (error as Error).message,
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    onChange(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {value ? (
        <div className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50 group transition-colors hover:bg-white hover:border-primary/30">
          <div className="p-2 rounded-lg bg-red-100 text-red-600">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {getFileName(value)}
            </p>
            <p className="text-xs text-muted-foreground">PDF cadastrado</p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={removeFile}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
          <div className="flex flex-col items-center justify-center text-center">
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="p-3 rounded-full bg-primary/10 text-primary mb-2">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium">Fazer upload do PDF</p>
                <p className="text-xs text-muted-foreground mt-1">Material do aluno</p>
              </>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            accept=".pdf"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}
