import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Upload, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

interface BannersPoloManagerProps {
  isSuperAdmin: boolean;
}

type Banner = {
  id: string;
  polo_id: string;
  titulo: string | null;
  imagem_url: string;
  ordem: number;
  ativo: boolean;
};

const BUCKET = "thumbnails";

export function BannersPoloManager({ isSuperAdmin }: BannersPoloManagerProps) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [selectedPoloId, setSelectedPoloId] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState({
    titulo: "",
    ordem: 1 as 1 | 2 | 3,
    ativo: true,
    file: null as File | null,
  });
  const [uploading, setUploading] = useState(false);

  // Florianópolis fixo (dropdown removido)
  const { data: polos } = useQuery({
    queryKey: ["banners-polo-florianopolis"],
    queryFn: async () => {
      const { data } = await supabase
        .from("polos")
        .select("id, nome")
        .ilike("nome", "%florian%")
        .eq("ativo", true)
        .limit(1);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!selectedPoloId && polos && polos.length > 0) {
      setSelectedPoloId(polos[0].id);
    }
  }, [polos, selectedPoloId]);


  // Banners do polo
  const { data: banners, isLoading } = useQuery({
    queryKey: ["banners-polo", selectedPoloId],
    queryFn: async () => {
      if (!selectedPoloId) return [];
      const { data, error } = await supabase
        .from("banners_polo")
        .select("*")
        .eq("polo_id", selectedPoloId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Banner[];
    },
    enabled: !!selectedPoloId,
  });

  const activeCount = (banners ?? []).filter((b) => b.ativo).length;
  const limitReached = activeCount >= 3 && !editing;

  const openCreate = () => {
    setEditing(null);
    setForm({ titulo: "", ordem: 1, ativo: true, file: null });
    setModalOpen(true);
  };

  const openEdit = (b: Banner) => {
    setEditing(b);
    setForm({
      titulo: b.titulo ?? "",
      ordem: (b.ordem as 1 | 2 | 3) ?? 1,
      ativo: b.ativo,
      file: null,
    });
    setModalOpen(true);
  };

  const uploadFile = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `banners/${selectedPoloId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const extractStoragePath = (url: string): string | null => {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const i = url.indexOf(marker);
    if (i === -1) return null;
    return url.substring(i + marker.length);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPoloId) throw new Error("Selecione um polo");
      let imagem_url = editing?.imagem_url ?? "";
      if (form.file) {
        setUploading(true);
        try {
          imagem_url = await uploadFile(form.file);
        } finally {
          setUploading(false);
        }
      }
      if (!imagem_url) throw new Error("Selecione uma imagem");

      if (editing) {
        const { error } = await supabase
          .from("banners_polo")
          .update({
            titulo: form.titulo || null,
            ordem: form.ordem,
            ativo: form.ativo,
            imagem_url,
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("banners_polo").insert({
          polo_id: selectedPoloId,
          titulo: form.titulo || null,
          ordem: form.ordem,
          ativo: form.ativo,
          imagem_url,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Banner atualizado" : "Banner criado");
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["banners-polo", selectedPoloId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (b: Banner) => {
      const path = extractStoragePath(b.imagem_url);
      if (path) {
        await supabase.storage.from(BUCKET).remove([path]);
      }
      const { error } = await supabase.from("banners_polo").delete().eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Banner excluído");
      queryClient.invalidateQueries({ queryKey: ["banners-polo", selectedPoloId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate} disabled={!selectedPoloId || limitReached}>
          <Plus className="h-4 w-4 mr-2" /> Adicionar Banner
        </Button>
      </div>


      {limitReached && (
        <p className="text-sm text-amber-600">Limite de 3 banners ativos atingido. Desative um para adicionar outro.</p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !banners || banners.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
            Nenhum banner cadastrado para este polo.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {banners.map((b) => (
            <Card key={b.id} className="overflow-hidden">
              <div className="aspect-video bg-muted relative">
                <img src={b.imagem_url} alt={b.titulo || "Banner"} className="w-full h-full object-cover" />
                <div className={`absolute top-2 right-2 text-xs px-2 py-1 rounded-full ${b.ativo ? "bg-green-500 text-white" : "bg-gray-400 text-white"}`}>
                  {b.ativo ? "Ativo" : "Inativo"}
                </div>
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{b.titulo || <span className="text-muted-foreground italic">Sem título</span>}</p>
                    <p className="text-xs text-muted-foreground">Ordem {b.ordem}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(b)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Excluir este banner?")) deleteMutation.mutate(b);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar banner" : "Novo banner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Imagem (JPG, PNG, WEBP)</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
              />
              {editing && !form.file && (
                <img src={editing.imagem_url} alt="Atual" className="h-24 rounded border object-cover" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Título (opcional)</Label>
              <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Select
                value={String(form.ordem)}
                onValueChange={(v) => setForm((f) => ({ ...f, ordem: Number(v) as 1 | 2 | 3 }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || uploading}>
              {(saveMutation.isPending || uploading) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
