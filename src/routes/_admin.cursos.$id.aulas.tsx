import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Power, GripVertical, Loader2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_admin/cursos/$id/aulas")({
  head: () => ({ meta: [{ title: "Aulas — EduManager" }] }),
  component: AulasManager,
});

type Aula = {
  id: string;
  curso_id: string;
  titulo: string;
  descricao: string | null;
  url_video: string | null;
  ordem: number;
  ativo: boolean;
};

function AulasManager() {
  const { id: cursoId } = Route.useParams();
  const qc = useQueryClient();

  const { data: curso } = useQuery({
    queryKey: ["curso", cursoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cursos").select("*").eq("id", cursoId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: aulas, isLoading, refetch } = useQuery({
    queryKey: ["aulas", cursoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aulas")
        .select("*")
        .eq("curso_id", cursoId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Aula[];
    },
  });

  const [aulaEditando, setAulaEditando] = useState<Aula | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const reorder = useMutation({
    mutationFn: async (items: Aula[]) => {
      await Promise.all(
        items.map((a, idx) =>
          supabase.from("aulas").update({ ordem: idx + 1 }).eq("id", a.id)
        )
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aulas", cursoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (a: Aula) => {
      const { error } = await supabase.from("aulas").update({ ativo: !a.ativo }).eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aulas", cursoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !aulas) return;
    const oldIndex = aulas.findIndex((a) => a.id === active.id);
    const newIndex = aulas.findIndex((a) => a.id === over.id);
    const next = arrayMove(aulas, oldIndex, newIndex);
    qc.setQueryData(["aulas", cursoId], next);
    reorder.mutate(next);
  };

  const handleEdit = (aula: Aula) => {
    setAulaEditando(aula);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setAulaEditando(null);
    setIsModalOpen(true);
  };

  return (
    <div>
      <PageHeader
        title={curso ? `Aulas — ${curso.nome}` : "Aulas"}
        description="Arraste para reordenar."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/cursos">
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Link>
            </Button>
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" /> Nova aula
            </Button>

            <Dialog open={isModalOpen} onOpenChange={(o) => {
              setIsModalOpen(o);
              if (!o) setAulaEditando(null);
            }}>
              <AulaDialog
                cursoId={cursoId}
                aula={aulaEditando}
                nextOrdem={(aulas?.length ?? 0) + 1}
                onSaved={() => {
                  setIsModalOpen(false);
                  setAulaEditando(null);
                  refetch();
                  qc.invalidateQueries({ queryKey: ["cursos"] });
                }}
                onCancel={() => {
                  setIsModalOpen(false);
                  setAulaEditando(null);
                }}
              />
            </Dialog>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{aulas?.length ?? 0} aula(s)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-6">Carregando...</p>
          ) : !aulas || aulas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma aula cadastrada. Clique em "Nova aula" para começar.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={aulas.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2">
                  {aulas.map((a, i) => (
                    <SortableAula
                      key={a.id}
                      aula={a}
                      index={i}
                      onEdit={() => handleEdit(a)}
                      onToggle={() => toggle.mutate(a)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SortableAula({
  aula,
  index,
  onEdit,
  onToggle,
}: {
  aula: Aula;
  index: number;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: aula.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border rounded-md bg-card hover:bg-muted/30"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground p-1"
        {...attributes}
        {...listeners}
        aria-label="Reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{aula.titulo}</p>
          {!aula.ativo && <Badge variant="secondary">Inativa</Badge>}
        </div>
        {aula.descricao && (
          <p className="text-xs text-muted-foreground truncate">{aula.descricao}</p>
        )}
        {aula.url_video && (
          <p className="text-xs text-muted-foreground truncate">🎬 {aula.url_video}</p>
        )}
      </div>
      <Button size="icon" variant="ghost" onClick={onEdit} title="Editar">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onToggle} title={aula.ativo ? "Desativar" : "Ativar"}>
        <Power className="h-4 w-4" />
      </Button>
    </li>
  );
}

function AulaDialog({
  cursoId,
  aula,
  nextOrdem,
  onSaved,
  onCancel,
}: {
  cursoId: string;
  aula: Aula | null;
  nextOrdem: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [aulaEditando, setAulaLocal] = useState<Partial<Aula>>({
    titulo: "",
    descricao: "",
    url_video: "",
    ordem: nextOrdem,
    ativo: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (aula) {
      setAulaLocal(aula);
    } else {
      setAulaLocal({
        titulo: "",
        descricao: "",
        url_video: "",
        ordem: nextOrdem,
        ativo: true,
      });
    }
  }, [aula, nextOrdem]);

  const save = async () => {
    if (!aulaEditando.titulo?.trim()) {
      toast.error("Informe o título");
      return;
    }
    setSaving(true);
    try {
      if (aula) {
        // Snippet requested by user
        const { error } = await supabase
          .from('aulas')
          .update({
            titulo: aulaEditando.titulo,
            descricao: aulaEditando.descricao,
            url_video: aulaEditando.url_video,
            ordem: aulaEditando.ordem,
            ativo: aulaEditando.ativo
          })
          .eq('id', aula.id);

        if (error) throw error;
        toast.success("Aula atualizada com sucesso");
      } else {
        const { error } = await supabase.from("aulas").insert({
          curso_id: cursoId,
          titulo: aulaEditando.titulo,
          descricao: aulaEditando.descricao,
          url_video: aulaEditando.url_video,
          ordem: aulaEditando.ordem,
          ativo: aulaEditando.ativo,
        });
        if (error) throw error;
        toast.success("Aula adicionada com sucesso");
      }
      onSaved();
    } catch (e) {
      toast.error("Erro ao salvar", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{aula ? "Editar Aula" : "Nova Aula"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Título</Label>
          <Input
            value={aulaEditando.titulo || ""}
            onChange={(e) => setAulaLocal({ ...aulaEditando, titulo: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Descrição</Label>
          <Textarea
            rows={3}
            value={aulaEditando.descricao || ""}
            onChange={(e) => setAulaLocal({ ...aulaEditando, descricao: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL do vídeo (embed YouTube / Vimeo / Pandavideo)</Label>
          <Input
            value={aulaEditando.url_video || ""}
            onChange={(e) => setAulaLocal({ ...aulaEditando, url_video: e.target.value })}
            placeholder="https://www.youtube.com/embed/..."
          />
        </div>
        <div className="flex gap-4">
          <div className="space-y-1.5 w-32">
            <Label className="text-xs">Ordem</Label>
            <Input
              type="number"
              min={1}
              value={aulaEditando.ordem || 1}
              onChange={(e) => setAulaLocal({ ...aulaEditando, ordem: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs">Status</Label>
            <Select
              value={aulaEditando.ativo ? "ativo" : "inativo"}
              onValueChange={(v) => setAulaLocal({ ...aulaEditando, ativo: v === "ativo" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
