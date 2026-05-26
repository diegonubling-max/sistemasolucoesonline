import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { maskCPF, maskPhone, isValidCPF, calcAge } from "@/lib/format";
import { cn } from "@/lib/utils";

const ORIGENS = ["Google", "Meta", "Indicação", "Outros"] as const;
const VENDEDORAS = ["Vera", "Gislaine", "Mônica", "Sabrina", "Bruna", "Juliana", "Outros"] as const;
const SEXOS = ["Masculino", "Feminino"] as const;

const schema = z
  .object({
    nome: z.string().min(2, "O nome é obrigatório"),
    sexo: z.string().min(1, "O sexo é obrigatório"),
    telefone: z.string().min(14, "Telefone obrigatório"),
    email: z.string().email("E-mail inválido").min(1, "O e-mail é obrigatório"),
    data_nascimento: z.string().min(1, "Data de nascimento obrigatória"),
    cpf: z.string().refine((v) => isValidCPF(v), "CPF inválido ou obrigatório"),
    ativo: z.string().min(1, "O status é obrigatório"),
    origem: z.string().min(1, "Selecione como nos conheceu"),
    origem_detalhe: z.string().optional().nullable(),
    vendedora: z.string().min(1, "Selecione a vendedora"),
    observacao: z.string().optional().nullable(),
    responsavel_nome: z.string().optional().nullable(),
    responsavel_telefone: z.string().optional().nullable(),
    responsavel_cpf: z.string().optional().nullable(),
    responsavel_email: z.string().optional().nullable().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const menor = calcAge(data.data_nascimento) < 18;
    if (menor) {
      if (!data.responsavel_nome || data.responsavel_nome.length < 2)
        ctx.addIssue({ code: "custom", message: "Obrigatório para menores", path: ["responsavel_nome"] });
      if (!data.responsavel_telefone || data.responsavel_telefone.length < 14)
        ctx.addIssue({ code: "custom", message: "Telefone obrigatório", path: ["responsavel_telefone"] });
      if (!data.responsavel_cpf || !isValidCPF(data.responsavel_cpf))
        ctx.addIssue({ code: "custom", message: "CPF inválido", path: ["responsavel_cpf"] });
    }
    if (data.responsavel_email && data.responsavel_email !== "") {
      if (!z.string().email().safeParse(data.responsavel_email).success)
        ctx.addIssue({ code: "custom", message: "E-mail inválido", path: ["responsavel_email"] });
    }
  });

export type AlunoFormValues = z.infer<typeof schema>;

export const defaultValues: any = {
  nome: "",
  sexo: "",
  telefone: "",
  email: "",
  data_nascimento: "",
  cpf: "",
  ativo: "",
  origem: "",
  origem_detalhe: "",
  vendedora: "",
  observacao: "",
  responsavel_nome: "",
  responsavel_telefone: "",
  responsavel_cpf: "",
  responsavel_email: "",
};

export function AlunoForm({
  initialValues,
  onSubmit,
  submitting,
  submitLabel = "Salvar",
}: {
  initialValues?: any;
  onSubmit: (values: any) => Promise<void> | void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...defaultValues,
      ...initialValues,
      ativo: initialValues?.ativo === undefined ? "" : (initialValues.ativo ? "Ativo" : "Inativo")
    },
  });

  const handleSubmit = (values: any) => {
    const finalValues = {
      ...values,
      ativo: values.ativo === "Ativo"
    };
    onSubmit(finalValues);
  };

  useEffect(() => {
    if (initialValues) form.reset({ ...defaultValues, ...initialValues });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialValues)]);

  const dob = form.watch("data_nascimento");
  const menor = dob ? calcAge(dob) < 18 : false;

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome completo *" error={errors.nome?.message}>
            <Input {...form.register("nome")} />
          </Field>
          <Field label="Telefone *" error={errors.telefone?.message}>
            <Input
              value={form.watch("telefone")}
              onChange={(e) => form.setValue("telefone", maskPhone(e.target.value), { shouldValidate: true })}
              placeholder="(00) 00000-0000"
            />
          </Field>
          <Field label="E-mail" error={errors.email?.message}>
            <Input type="email" {...form.register("email")} />
          </Field>
          <Field label="CPF *" error={errors.cpf?.message}>
            <Input
              value={form.watch("cpf")}
              onChange={(e) => form.setValue("cpf", maskCPF(e.target.value), { shouldValidate: true })}
              placeholder="000.000.000-00"
            />
          </Field>
          <Field label="Data de nascimento *" error={errors.data_nascimento?.message}>
            <Input type="date" {...form.register("data_nascimento")} />
            {dob && (
              <p className="text-xs text-muted-foreground mt-1">
                Idade: {calcAge(dob)} anos {menor && "• Menor de idade"}
              </p>
            )}
          </Field>
          <Field label="Como nos conheceu? *" error={errors.origem?.message}>
            <Select
              value={form.watch("origem")}
              onValueChange={(v: any) => form.setValue("origem", v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma opção" />
              </SelectTrigger>
              <SelectContent>
                {ORIGENS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {(form.watch("origem") === "Indicação" || form.watch("origem") === "Outros") && (
            <Field label="Detalhe" error={errors.origem_detalhe?.message}>
              <Input
                {...form.register("origem_detalhe")}
                placeholder={form.watch("origem") === "Indicação" ? "Nome de quem indicou" : "Especifique"}
              />
            </Field>
          )}

          <Field label="Sexo" error={errors.sexo?.message}>
            <Select
              value={form.watch("sexo")}
              onValueChange={(v: any) => form.setValue("sexo", v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o sexo" />
              </SelectTrigger>
              <SelectContent>
                {SEXOS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Vendedora responsável" error={errors.vendedora?.message}>
            <Select
              value={form.watch("vendedora")}
              onValueChange={(v) => form.setValue("vendedora", v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a vendedora" />
              </SelectTrigger>
              <SelectContent>
                {VENDEDORAS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Status">
            <Select
              value={form.watch("ativo") ? "Ativo" : "Inativo"}
              onValueChange={(v) => form.setValue("ativo", v === "Ativo")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Informações adicionais">
            <Textarea
              {...form.register("observacao")}
              placeholder="Adicione aqui informações relevantes sobre o aluno..."
              className="min-h-[120px] resize-y"
            />
          </Field>
        </CardContent>
      </Card>

      {menor && (
        <Card className="border-accent/50">
          <CardHeader>
            <CardTitle>Dados do responsável</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome do responsável" error={errors.responsavel_nome?.message}>
              <Input {...form.register("responsavel_nome")} />
            </Field>
            <Field label="Telefone" error={errors.responsavel_telefone?.message}>
              <Input
                value={form.watch("responsavel_telefone") ?? ""}
                onChange={(e) =>
                  form.setValue("responsavel_telefone", maskPhone(e.target.value), { shouldValidate: true })
                }
                placeholder="(00) 00000-0000"
              />
            </Field>
            <Field label="CPF" error={errors.responsavel_cpf?.message}>
              <Input
                value={form.watch("responsavel_cpf") ?? ""}
                onChange={(e) =>
                  form.setValue("responsavel_cpf", maskCPF(e.target.value), { shouldValidate: true })
                }
                placeholder="000.000.000-00"
              />
            </Field>
            <Field label="E-mail (opcional)" error={errors.responsavel_email?.message}>
              <Input type="email" {...form.register("responsavel_email")} />
            </Field>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
