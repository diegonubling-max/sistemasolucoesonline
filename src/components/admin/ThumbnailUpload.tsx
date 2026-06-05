import { useState } from "react";
import { Image, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import imageCompression from 'browser-image-compression';

interface ThumbnailUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket: "thumbnails-cursos" | "thumbnails-aulas";
  recommendedSize: string;
  className?: string;
}

export function ThumbnailUpload({
  value,
  onChange,
  bucket,
  recommendedSize,
  className,
}: ThumbnailUploadProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem.");
      return;
    }

    setUploading(true);
    try {
      // Opções de compressão para otimizar o carregamento
      const options = {
        maxSizeMB: 0.2, // Reduz para no máximo 200KB
        maxWidthOrHeight: 800, // Reduz dimensões se forem muito grandes
        useWebWorker: true,
        initialQuality: 0.8,
      };

      const compressedFile = await imageCompression(file, options);
      
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      onChange(data.publicUrl);
      toast.success("Imagem otimizada e enviada com sucesso!");
    } catch (error) {
      console.error("Erro no upload:", error);
      toast.error("Erro ao enviar imagem", {
        description: (error as Error).message,
      });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    onChange(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {value ? (
        <div 
          className={cn(
            "relative group rounded-lg overflow-hidden border bg-[#f5f5f5] flex items-center justify-center",
            bucket === "thumbnails-cursos" ? "w-[150px] aspect-[2/3]" : "w-full aspect-video max-w-[320px]"
          )}
        >
          <img
            src={value}
            alt="Thumbnail preview"
            className="w-full h-full object-contain"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={removeImage}
            >
              <X className="h-4 w-4 mr-2" /> Remover
            </Button>
          </div>
        </div>
      ) : (
        <label 
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer",
            bucket === "thumbnails-cursos" ? "w-[150px] aspect-[2/3]" : "w-full aspect-video max-w-[320px]"
          )}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="p-3 rounded-full bg-primary/10 text-primary mb-3">
                  <Image className="h-6 w-6" />
                </div>
                <p className="text-xs font-medium">Adicionar imagem</p>
                <p className="text-[10px] text-muted-foreground mt-1">({recommendedSize})</p>
              </>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}
