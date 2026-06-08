import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { maskCPF, maskPhone, isValidCPF, calcAge } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

const ORIGENS = ["Google", "Meta", "Indicação", "Outros"] as const;
const VENDEDORAS = ["Gislaine", "Vera", "Gabrielly", "Maria Eduarda"] as const;
const SEXOS = ["Masculino", "Feminino"] as const;

const schema = z
  .object({
    nome: z.string().min(2, "O nome é obrigatório"),
    sexo: z.string().min(1, "O sexo é obrigatório"),
    telefone: z.string().min(14, "Telefone obrigatório"),
    email: z.string().email("E-mail inválido").optional().or(z.literal("")),
    data_nascimento: z.string().min(1, "Data de nascimento obrigatória"),
    cpf: z.string().refine((v) => isValidCPF(v), "CPF inválido ou obrigatório"),
    ativo: z.string().optional(),
    origem: z.string().min(1, "Selecione como nos conheceu"),
    origem_detalhe: z.string().optional().nullable(),
    vendedora: z.string().min(1, "Selecione a vendedora"),
    observacao: z.string().optional().nullable(),
    responsavel_nome: z.string().optional().nullable(),
    responsavel_telefone: z.string().optional().nullable(),
    responsavel_cpf: z.string().optional().nullable(),
    responsavel_email: z.string().optional().nullable().or(z.literal("")),
    dias_prova_final: z.coerce.number().min(0).optional(),
    materias_prova: z.array(z.string()).optional().nullable(),
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

export type AlunoFormValues = any;

export const defaultValues: any = {
  nome: "",
  sexo: "",
  telefone: "",
  email: "",
  data_nascimento: "",
  cpf: "",
  ativo: "Ativo",
  origem: "",
  origem_detalhe: "",
  vendedora: "",
  observacao: "",
  responsavel_nome: "",
  responsavel_telefone: "",
  responsavel_cpf: "",
  responsavel_email: "",
  dias_prova_final: 60,
};

export function AlunoForm({
  initialValues,
  onSubmit,
  submitting,
  submitLabel = "Salvar",
  isEdit,
}: {
  initialValues?: any;
  onSubmit: (values: any) => Promise<void> | void;
  submitting?: boolean;
  submitLabel?: string;
  isEdit?: boolean;
}) {
  const [vendedoras, setVendedoras] = useState<string[]>(["Gislaine", "Vera", "Gabrielly", "Maria Eduarda"]);
  const [polos, setPolos] = useState<any[]>([]);
  const { session } = useAuth();
  const [userPoloId, setUserPoloId] = useState<string | null>(null);

  const { data: userRole } = useQuery({
    queryKey: ["user-role", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).maybeSingle();
      return data?.role;
    },
    enabled: !!session?.user?.id
  });

  const isSuperAdmin = session?.user?.email === 'diegonubling@gmail.com' || userRole === 'admin';

  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...defaultValues,
      ...initialValues,
      ativo: initialValues?.ativo === undefined ? "Ativo" : (initialValues.ativo ? "Ativo" : "Inativo")
    },
  });

  useEffect(() => {
    async function loadOptions() {
      const { data: colabs } = await supabase
        .from('colaboradores')
        .select('nome, polo_id, setor')
        .eq('setor', 'Vendedor');
      
      if (colabs && colabs.length > 0) {
        const nomes = colabs.map(c => c.nome);
        setVendedoras(prev => [...new Set([...prev, ...nomes])]);
      }

      const { data: listPolos } = await supabase.from('polos').select('id, nome').eq('ativo', true);
      if (listPolos) setPolos(listPolos);

      if (session?.user?.id) {
        const { data: colab } = await supabase.from('colaboradores').select('polo_id').eq('user_id', session.user.id).maybeSingle();
        if (colab?.polo_id) {
          setUserPoloId(colab.polo_id);
          if (!isEdit && !form.getValues("polo_id")) {
            form.setValue("polo_id", colab.polo_id);
          }
        }
      }
    }
    loadOptions();
  }, [session, isEdit]);

  const onLocalSubmit = (values: any) => {
    const finalValues = {
      ...values,
      ativo: values.ativo === "Ativo"
    };
    onSubmit(finalValues);
  };

  useEffect(() => {
    if (initialValues) {
      form.reset({
        ...defaultValues,
        ...initialValues,
        ativo: initialValues.ativo === undefined ? "Ativo" : (initialValues.ativo ? "Ativo" : "Inativo")
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialValues)]);

  const dob = form.watch("data_nascimento");
  const menor = dob ? calcAge(dob) < 18 : false;
  const errors = form.formState.errors;
  const diasProvaFinal = form.watch("dias_prova_final") || 0;
  
  // Calculate preview of release date
  const enrollmentDate = initialValues?.created_at ? new Date(initialValues.created_at) : new Date();
  const calculatedReleaseDate = new Date(enrollmentDate);
  calculatedReleaseDate.setDate(calculatedReleaseDate.getDate() + diasProvaFinal);


  // Scroll to first error
  useEffect(() => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0 && form.formState.submitCount > 0) {
      const firstErrorKey = errorKeys[0];
      const element = document.querySelector(`[name="${firstErrorKey}"]`) || 
                      document.querySelector(`[data-name="${firstErrorKey}"]`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [errors, form.formState.submitCount]);

  return (
    <form onSubmit={form.handleSubmit(onLocalSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Nome */}
          <Field label="Nome completo *" error={errors.nome?.message as string}>
            <Input {...form.register("nome")} />
          </Field>

          {/* 2. Telefone */}
          <Field label="Telefone *" error={errors.telefone?.message as string}>
            <Input
              value={form.watch("telefone")}
              onChange={(e) => form.setValue("telefone", maskPhone(e.target.value), { shouldValidate: true })}
              placeholder="(00) 00000-0000"
            />
          </Field>

          {/* 3. Email */}
          <Field label="E-mail (opcional)" error={errors.email?.message as string}>
            <Input type="email" {...form.register("email")} />
          </Field>

          {/* 4. CPF */}
          <Field label="CPF *" error={errors.cpf?.message as string}>
            <Input
              value={form.watch("cpf")}
              onChange={(e) => form.setValue("cpf", maskCPF(e.target.value), { shouldValidate: true })}
              placeholder="000.000.000-00"
            />
          </Field>

          {/* 5. Data de nascimento */}
          <Field label="Data de nascimento *" error={errors.data_nascimento?.message as string}>
            <Input type="date" {...form.register("data_nascimento")} />
            {dob && (
              <p className="text-xs text-muted-foreground mt-1">
                Idade: {calcAge(dob)} anos {menor && "• Menor de idade"}
              </p>
            )}
          </Field>

          {/* 6. Como nos conheceu */}
          <div className="space-y-4">
            <Field label="Como nos conheceu? *" error={errors.origem?.message as string}>
              <Select
                value={form.watch("origem")}
                onValueChange={(v: any) => form.setValue("origem", v, { shouldValidate: true })}
              >
                <SelectTrigger data-name="origem">
                  <SelectValue placeholder="selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_placeholder" disabled>selecione...</SelectItem>
                  {ORIGENS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {(form.watch("origem") === "Indicação" || form.watch("origem") === "Outros") && (
              <Field label="Detalhe" error={errors.origem_detalhe?.message as string}>
                <Input
                  {...form.register("origem_detalhe")}
                  placeholder={form.watch("origem") === "Indicação" ? "Nome de quem indicou" : "Especifique"}
                />
              </Field>
            )}
          </div>

          {/* 7. Sexo */}
          <Field label="Sexo *" error={errors.sexo?.message as string}>
            <Select
              value={form.watch("sexo")}
              onValueChange={(v: any) => form.setValue("sexo", v, { shouldValidate: true })}
            >
              <SelectTrigger data-name="sexo">
                <SelectValue placeholder="selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_placeholder" disabled>selecione...</SelectItem>
                {SEXOS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* 8. Vendedora responsável */}
          <Field label="Vendedora responsável *" error={errors.vendedora?.message as string}>
            <Select
              value={form.watch("vendedora")}
              onValueChange={(v) => form.setValue("vendedora", v, { shouldValidate: true })}
            >
              <SelectTrigger data-name="vendedora">
                <SelectValue placeholder="selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_placeholder" disabled>selecione...</SelectItem>
                {VENDEDORAS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* 8.1 Polo */}
          <Field label="Polo *" error={errors.polo_id?.message as string}>
            <Select
              disabled={!isSuperAdmin && !!userPoloId}
              value={form.watch("polo_id")}
              onValueChange={(v) => form.setValue("polo_id", v, { shouldValidate: true })}
            >
              <SelectTrigger data-name="polo_id">
                <SelectValue placeholder="selecione..." />
              </SelectTrigger>
              <SelectContent>
                {polos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isSuperAdmin && userPoloId && (
              <p className="text-[10px] text-muted-foreground mt-1 italic">
                Vinculado ao seu polo de origem.
              </p>
            )}
          </Field>

          {/* 9. Status (Only on Edit) */}
          {isEdit && (
            <Field label="Status *" error={errors.ativo?.message as string}>
              <Select
                value={form.watch("ativo")}
                onValueChange={(v) => form.setValue("ativo", v, { shouldValidate: true })}
              >
                <SelectTrigger data-name="ativo">
                  <SelectValue placeholder="selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </CardContent>
      </Card>

      {menor && (
        <Card className="border-accent/50">
          <CardHeader>
            <CardTitle>Dados do responsável</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome do responsável *" error={errors.responsavel_nome?.message as string}>
              <Input {...form.register("responsavel_nome")} />
            </Field>
            <Field label="Telefone *" error={errors.responsavel_telefone?.message as string}>
              <Input
                value={form.watch("responsavel_telefone") ?? ""}
                onChange={(e) =>
                  form.setValue("responsavel_telefone", maskPhone(e.target.value), { shouldValidate: true })
                }
                placeholder="(00) 00000-0000"
              />
            </Field>
            <Field label="CPF *" error={errors.responsavel_cpf?.message as string}>
              <Input
                value={form.watch("responsavel_cpf") ?? ""}
                onChange={(e) =>
                  form.setValue("responsavel_cpf", maskCPF(e.target.value), { shouldValidate: true })
                }
                placeholder="000.000.000-00"
              />
            </Field>
            <Field label="E-mail do responsável (opcional)" error={errors.responsavel_email?.message as string}>
              <Input type="email" {...form.register("responsavel_email")} />
            </Field>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Informações adicionais (opcional)">
            <Textarea
              {...form.register("observacao")}
              placeholder="Adicione aqui informações relevantes sobre o aluno..."
              className="min-h-[120px] resize-y"
            />
          </Field>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="text-blue-800">Prova Final</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Field label="Prazo em dias" error={errors.dias_prova_final?.message as string}>
              <Input 
                type="number" 
                {...form.register("dias_prova_final")} 
                placeholder="Ex: 60"
              />
            </Field>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Data da Matrícula</Label>
              <div className="p-2 bg-white rounded-md border text-sm">
                {initialValues?.created_at ? format(new Date(initialValues.created_at), "dd/MM/yyyy") : "—"}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Liberação Estimada</Label>
              <div className="p-2 bg-white rounded-md border text-sm font-bold text-blue-700">
                {format(calculatedReleaseDate, "dd/MM/yyyy")}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-semibold">Matérias Disponíveis</Label>
            <p className="text-xs text-muted-foreground">Se nenhuma for marcada, todas as 10 serão liberadas automaticamente.</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                "Geografia", "História", "Filosofia", "Sociologia", "Português", 
                "Inglês", "Biologia", "Química", "Física", "Matemática"
              ].map((m) => {
                const currentMaterias = form.watch("materias_prova") || [];
                const isSelected = currentMaterias.includes(m);
                return (
                  <div 
                    key={m} 
                    className={cn(
                      "flex items-center space-x-2 p-2 rounded border cursor-pointer transition-colors bg-white",
                      isSelected && "bg-blue-50 border-blue-300"
                    )}
                    onClick={() => {
                      const prev = form.getValues("materias_prova") || [];
                      const next = prev.includes(m) ? prev.filter((i: string) => i !== m) : [...prev, m];
                      form.setValue("materias_prova", next, { shouldDirty: true });
                    }}
                  >
                    <Checkbox checked={isSelected} onCheckedChange={() => {}} />
                    <span className="text-xs font-medium">{m}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

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
    <div className={cn("space-y-1.5", className)}>
      <Label className={cn("text-xs font-medium", error && "text-destructive")}>{label}</Label>
      <div className={cn(error && "[&_input]:border-destructive [&_button]:border-destructive")}>
        {children}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
