import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbnailUpload } from "./ThumbnailUpload";

const schema = z.object({
  nome: z.string().min(2, "Informe o nome"),
  descricao: z.string().optional().nullable(),
  thumbnail_url: z.string().optional().nullable(),
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
  const form = useForm<CursoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", descricao: "", thumbnail_url: null, ativo: true, ...initialValues },
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
            <Label className="text-xs font-medium">Thumbnail do Curso</Label>
            <ThumbnailUpload
              value={form.watch("thumbnail_url")}
              onChange={(url) => form.setValue("thumbnail_url", url)}
              bucket="thumbnails-cursos"
              recommendedSize="400x225px"
            />
          </div>
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
