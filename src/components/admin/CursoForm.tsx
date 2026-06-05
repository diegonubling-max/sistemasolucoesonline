import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbnailUpload } from "./ThumbnailUpload";
import { PdfUpload } from "./PdfUpload";

const schema = z.object({
  nome: z.string().min(2, "Informe o nome"),
  segmento_id: z.string().min(1, "Selecione um segmento"),
  descricao: z.string().optional().nullable(),
  thumbnail_url: z.string().optional().nullable(),
  material_pdf_url: z.string().optional().nullable(),
  ativo: z.boolean(),
});
export type CursoFormValues = z.infer<typeof schema>;

export function CursoForm({
  initialValues,
  onSubmit,
  submitting,
  submitLabel = "Salvar",
}: {
  initialValues?: Partial<CursoFormValues>;
  onSubmit: (v: CursoFormValues) => Promise<void> | void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const { data: segmentos } = useQuery({
    queryKey: ["segmentos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("segmentos")
        .select("id, nome")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const form = useForm<CursoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", segmento_id: "", descricao: "", thumbnail_url: null, material_pdf_url: null, ativo: true, ...initialValues },
  });
  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Dados do curso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Nome</Label>
            <Input {...form.register("nome")} />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Segmento</Label>
            <Select 
              value={form.watch("segmento_id") || ""} 
              onValueChange={(v) => form.setValue("segmento_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um segmento..." />
              </SelectTrigger>
              <SelectContent>
                {segmentos?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.segmento_id && <p className="text-xs text-destructive">{errors.segmento_id.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Thumbnail do Curso</Label>
            <ThumbnailUpload
              value={form.watch("thumbnail_url")}
              onChange={(url) => form.setValue("thumbnail_url", url)}
              bucket="thumbnails-cursos"
              recommendedSize="300x450px"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Material do Aluno (PDF)</Label>
            <PdfUpload
              value={form.watch("material_pdf_url")}
              onChange={(url) => form.setValue("material_pdf_url", url)}
            />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Descrição</Label>
            <Textarea rows={4} {...form.register("descricao")} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.watch("ativo")} onCheckedChange={(v) => form.setValue("ativo", v)} />
            <span className="text-sm">{form.watch("ativo") ? "Ativo" : "Inativo"}</span>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
