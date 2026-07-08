import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { ProvaFluxo } from "@/components/prova/ProvaFluxo";

export const Route = createFileRoute("/externo/prova")({
  component: ExternoProvaPage,
});

const MATERIAS_DEFAULT = [
  "Biologia", "Filosofia", "Física", "Geografia", "História",
  "Inglês", "Matemática", "Português", "Química", "Sociologia",
];

function ExternoProvaPage() {
  const navigate = useNavigate();
  const [ctr, setCtr] = useState<string | null>(null);
  const [externoId, setExternoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [iniciada, setIniciada] = useState(false);

  useEffect(() => {
    const c = sessionStorage.getItem("externo_ctr");
    const id = sessionStorage.getItem("externo_id");
    const n = sessionStorage.getItem("externo_nome");
    if (!c || !id) {
      navigate({ to: "/aluno/login" });
      return;
    }
    setCtr(c);
    setExternoId(id);
    setNome(n ?? "");
  }, [navigate]);

  const hojeStr = new Date().toISOString().slice(0, 10);

  const { data: agendamento, isLoading, refetch } = useQuery({
    queryKey: ["externo-agendamento", ctr, hojeStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prova_agendamentos")
        .select("id, status, data_prova, hora_prova")
        .eq("ctr", ctr!)
        .eq("data_prova", hojeStr)
        .is("resultado", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!ctr,
  });

  const handleSair = () => {
    sessionStorage.removeItem("externo_ctr");
    sessionStorage.removeItem("externo_id");
    sessionStorage.removeItem("externo_nome");
    navigate({ to: "/aluno/login" });
  };

  const handleIniciar = async () => {
    if (!agendamento) return;
    const { error } = await supabase
      .from("prova_agendamentos")
      .update({ status: "iniciado" })
      .eq("id", agendamento.id);
    if (error) {
      toast.error("Erro ao iniciar", { description: error.message });
      return;
    }
    setIniciada(true);
    refetch();
  };

  if (!ctr || isLoading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline" /></div>;

  if (!agendamento) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 space-y-4">
            <h2 className="text-xl font-bold">Nenhuma prova disponível hoje</h2>
            <p className="text-muted-foreground">Procure a secretaria para reagendar.</p>
            <Button onClick={handleSair} className="w-full">Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const jaComecou = iniciada || agendamento.status === "iniciado" || agendamento.status === "concluido";

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="max-w-5xl mx-auto flex justify-between items-center py-4 mb-6 border-b">
        <div>
          <h1 className="text-lg font-bold text-primary">Olá, {nome}!</h1>
          <p className="text-xs text-muted-foreground">Prova do dia {new Date(hojeStr + "T00:00:00").toLocaleDateString("pt-BR")}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSair}>Sair</Button>
      </header>

      {!jaComecou ? (
        <div className="flex items-center justify-center">
          <Card className="max-w-lg w-full">
            <CardHeader className="text-center">
              <div className="mx-auto bg-primary/10 p-4 rounded-2xl w-fit mb-4">
                <GraduationCap className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="text-2xl">Sua prova está pronta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                {MATERIAS.length} matérias, 10 questões cada. Cada resposta é salva automaticamente e você pode retomar de onde parou se cair a conexão. Você tem até 4 horas.
              </div>
              <Button size="lg" className="w-full h-14 text-lg font-bold" onClick={handleIniciar}>
                Iniciar Prova <ArrowRight className="ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <ProvaFluxo
          alunoId={externoId!}
          agendamentoId={agendamento.id}
          materias={MATERIAS}
          onSair={handleSair}
        />
      )}
    </div>
  );
}
