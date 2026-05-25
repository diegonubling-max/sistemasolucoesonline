import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { maskCPF, maskPhone, isValidCPF, calcAge } from "@/lib/format";

const ORIGENS = ["Google", "Meta", "Indicação", "Outros"] as const;
const VENDEDORAS = ["Eduarda", "Julia", "Dandara", "Gaby", "Outros"] as const;

const schema = z
  .object({
    nome: z.string().min(2, "Informe o nome"),
    telefone: z.string().min(14, "Telefone inválido"),
    email: z.string().email("E-mail inválido"),
    data_nascimento: z.string().min(1, "Informe a data"),
    cpf: z.string().refine((v) => isValidCPF(v), "CPF inválido"),
    endereco: z.string().optional().nullable(),
    bairro: z.string().optional().nullable(),
    cidade: z.string().optional().nullable(),
    estado: z.string().optional().nullable(),
    ativo: z.boolean(),
    origem: z.enum(ORIGENS),
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

export const defaultValues: AlunoFormValues = {
  nome: "",
  telefone: "",
  email: "",
  data_nascimento: "",
  cpf: "",
  endereco: "",
  bairro: "",
  cidade: "",
  estado: "",
  ativo: true,
  origem: "Google",
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
  initialValues?: Partial<AlunoFormValues>;
  onSubmit: (values: AlunoFormValues) => Promise<void> | void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const form = useForm<AlunoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...defaultValues, ...initialValues },
  });

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
          <Field label="Nome completo" error={errors.nome?.message}>
            <Input {...form.register("nome")} />
          </Field>
          <Field label="E-mail" error={errors.email?.message}>
            <Input type="email" {...form.register("email")} />
          </Field>
          <Field label="Telefone" error={errors.telefone?.message}>
            <Input
              value={form.watch("telefone")}
              onChange={(e) => form.setValue("telefone", maskPhone(e.target.value), { shouldValidate: true })}
              placeholder="(00) 00000-0000"
            />
          </Field>
          <Field label="CPF" error={errors.cpf?.message}>
            <Input
              value={form.watch("cpf")}
              onChange={(e) => form.setValue("cpf", maskCPF(e.target.value), { shouldValidate: true })}
              placeholder="000.000.000-00"
            />
          </Field>
          <Field label="Data de nascimento" error={errors.data_nascimento?.message}>
            <Input type="date" {...form.register("data_nascimento")} />
            {dob && (
              <p className="text-xs text-muted-foreground mt-1">
                Idade: {calcAge(dob)} anos {menor && "• Menor de idade"}
              </p>
            )}
          </Field>
          <Field label="Status">
            <div className="flex items-center gap-2 h-9">
              <Switch
                checked={form.watch("ativo")}
                onCheckedChange={(v) => form.setValue("ativo", v)}
              />
              <span className="text-sm">{form.watch("ativo") ? "Ativo" : "Inativo"}</span>
            </div>
          </Field>
          <Field label="Como nos conheceu?" error={errors.origem?.message}>
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

      <Card>
        <CardHeader>
          <CardTitle>Endereço</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Endereço" className="md:col-span-2">
            <Input {...form.register("endereco")} />
          </Field>
          <Field label="Bairro">
            <Input {...form.register("bairro")} />
          </Field>
          <Field label="Cidade">
            <Input {...form.register("cidade")} />
          </Field>
          <Field label="Estado">
            <Input maxLength={2} {...form.register("estado")} />
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
