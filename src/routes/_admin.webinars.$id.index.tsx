import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Users, LogOut, Loader2, PhoneCall, FileSpreadsheet } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_admin/webinars/$id/")({
  head: () => ({ meta: [{ title: "Monitorar Webinar — Soluções Online" }] }),
  component: WebinarMonitor,
});

function WebinarMonitor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [ultimaSaida, setUltimaSaida] = useState<{ nome: string; telefone: string; hora: string } | null>(null);
  const [onlineAgora, setOnlineAgora] = useState(0);
  const participantesRef = useRef<any[]>([]);

  const { data: webinar } = useQuery({
    queryKey: ["webinar", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("webinars" as any).select("*").eq("id", id).single();
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 15000,
  });

  const { data: participantes, isLoading } = useQuery({
    queryKey: ["webinar-participantes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webinar_participantes" as any)
        .select("*")
        .eq("webinar_id", id)
        .order("entrou_em", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 10000,
  });

  const { data: snapshots } = useQuery({
    queryKey: ["webinar-snapshots", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webinar_snapshots" as any)
        .select("*")
        .eq("webinar_id", id)
        .order("registrado_em", { ascending: true });
      if (error) throw error;
      return (data as any[]).map((s) => ({
        hora: new Date(s.registrado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        online: s.quantidade_online,
      }));
    },
    refetchInterval: 20000,
  });

  // Presença em tempo real: o admin observa o mesmo canal que os alunos usam.
  // Quando alguém sai (fecha a aba, cai a conexão), o Supabase avisa sozinho — sem heartbeat manual.
  useEffect(() => {
    if (!webinar) return;

    const presenceChannel = supabase.channel(`webinar-presence-${id}`, {
      config: { presence: {} },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        setOnlineAgora(Object.keys(state).length);
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        const saidoEm = new Date().toISOString();
        supabase
          .from("webinar_participantes" as any)
          .update({ saiu_em: saidoEm })
          .eq("id", key)
          .is("saiu_em", null)
          .then(() => qc.invalidateQueries({ queryKey: ["webinar-participantes", id] }));

        const info = (leftPresences?.[0] as any) ?? {};
        const participanteLocal = participantesRef.current.find((p: any) => p.id === key);
        setUltimaSaida({
          nome: info.nome || participanteLocal?.nome || "Alguém",
          telefone: participanteLocal?.telefone || "",
          hora: new Date(saidoEm).toLocaleTimeString("pt-BR"),
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, webinar?.id]);

  // Grava um snapshot da quantidade online a cada minuto, enquanto o painel está aberto e a aula ao vivo
  useEffect(() => {
    if (!webinar || webinar.status !== "ao_vivo") return;
    const interval = setInterval(() => {
      supabase.from("webinar_snapshots" as any).insert({ webinar_id: id, quantidade_online: onlineAgora }).then(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [webinar, id, onlineAgora]);

  const saidos = (participantes ?? []).filter((p) => p.saiu_em);
  const bloqueados = (participantes ?? []).filter((p) => p.acesso_liberado === false);
  const liberados = (participantes ?? []).filter((p) => p.acesso_liberado !== false);

  useEffect(() => {
    participantesRef.current = participantes ?? [];
  }, [participantes]);

  const exportarExcel = () => {
    const fmtHora = (v: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

    const linhasLiberados = liberados.map((p: any) => ({
      Nome: p.nome,
      WhatsApp: p.telefone,
      "Entrou às": fmtHora(p.entrou_em),
      "Saiu às": fmtHora(p.saiu_em),
      Status: p.saiu_em ? "Saiu" : "Online",
    }));

    const linhasBloqueados = bloqueados.map((p: any) => ({
      Nome: p.nome,
      WhatsApp: p.telefone,
      "Tentou entrar às": fmtHora(p.created_at),
    }));

    const wb = XLSX.utils.book_new();
    const wsLiberados = XLSX.utils.json_to_sheet(linhasLiberados);
    wsLiberados["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsLiberados, "Conseguiu entrar");

    const wsBloqueados = XLSX.utils.json_to_sheet(linhasBloqueados);
    wsBloqueados["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsBloqueados, "Não conseguiu (atraso)");

    const dataArquivo = webinar?.iniciado_em ? new Date(webinar.iniciado_em) : new Date();
    const nomeArquivo = `webinar-${dataArquivo.toISOString().slice(0, 10)}-${(webinar?.titulo ?? "aula").replace(/[^a-zA-Z0-9]+/g, "-")}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={webinar?.titulo ?? "Webinar"}
        description="Acompanhamento ao vivo de entradas, saídas e presença"
        actions={
          <Button variant="outline" onClick={exportarExcel} disabled={!participantes || participantes.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar Excel
          </Button>
        }
      />

      {ultimaSaida && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 text-sm flex items-center gap-2">
          <LogOut className="h-4 w-4 text-orange-600" />
          <strong>{ultimaSaida.nome}</strong> ({ultimaSaida.telefone}) saiu da aula às {ultimaSaida.hora}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Online agora
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-green-600">{onlineAgora}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Já saíram</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-muted-foreground">{saidos.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total liberados</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{liberados.length}</p></CardContent>
        </Card>
        <Card className={bloqueados.length > 0 ? "border-orange-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <PhoneCall className="h-4 w-4" /> Bloqueados (chegaram tarde)
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-orange-600">{bloqueados.length}</p></CardContent>
        </Card>
      </div>

      {bloqueados.length > 0 && (
        <Card className="border-orange-300">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-orange-700">
              <PhoneCall className="h-4 w-4" /> Chegaram depois dos 10 min — ligar/chamar no WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Tentou entrar às</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bloqueados.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>{p.telefone}</TableCell>
                    <TableCell className="text-sm">{new Date(p.created_at).toLocaleTimeString("pt-BR")}</TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`https://wa.me/55${p.telefone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:underline"
                      >
                        <PhoneCall className="h-3.5 w-3.5" /> Chamar no WhatsApp
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pessoas online ao longo da aula</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={snapshots ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hora" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="online" stroke="#ea580c" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Quedas bruscas na linha indicam momentos em que várias pessoas saíram ao mesmo tempo.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Entrou</TableHead>
                  <TableHead>Saiu</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liberados.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>{p.telefone}</TableCell>
                    <TableCell className="text-sm">{new Date(p.entrou_em).toLocaleTimeString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">
                      {p.saiu_em ? new Date(p.saiu_em).toLocaleTimeString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell>
                      {p.saiu_em ? (
                        <Badge className="bg-gray-100 text-gray-600">Saiu</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700">🟢 Online</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
