import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/admin/PageHeader";

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

  const { data: aulas, isLoading } = useQuery({
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

  const [editing, setEditing] = useState<Aula | null>(null);
  const [open, setOpen] = useState(false);

  const reorder = useMutation({
    mutationFn: async (items: Aula[]) => {
      // Update each row's ordem
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
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditing(null)}>
                  <Plus className="h-4 w-4 mr-2" /> Nova aula
                </Button>
              </DialogTrigger>
              <AulaDialog
                cursoId={cursoId}
                aula={editing}
                nextOrdem={(aulas?.length ?? 0) + 1}
                onSaved={() => {
                  setOpen(false);
                  setEditing(null);
                  qc.invalidateQueries({ queryKey: ["aulas", cursoId] });
                  qc.invalidateQueries({ queryKey: ["cursos"] });
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
            <p className="text-muted-foreground">Carregando...</p>
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
                      onEdit={() => {
                        setEditing(a);
                        setOpen(true);
                      }}
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
}: {
  cursoId: string;
  aula: Aula | null;
  nextOrdem: number;
  onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState(aula?.titulo ?? "");
  const [descricao, setDescricao] = useState(aula?.descricao ?? "");
  const [urlVideo, setUrlVideo] = useState(aula?.url_video ?? "");
  const [ordem, setOrdem] = useState<number>(aula?.ordem ?? nextOrdem);
  const [saving, setSaving] = useState(false);


  const save = async () => {
    if (!titulo.trim()) {
      toast.error("Informe o título");
      return;
    }
    setSaving(true);
    try {
      if (aula) {
        const { error } = await supabase
          .from("aulas")
          .update({ titulo, descricao, url_video: urlVideo, ordem })
          .eq("id", aula.id);
        if (error) throw error;
        toast.success("Aula atualizada!");
      } else {
        const { error } = await supabase.from("aulas").insert({
          curso_id: cursoId,
          titulo,
          descricao,
          url_video: urlVideo,
          ordem,
        });
        if (error) throw error;
        toast.success("Aula adicionada!");
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
        <DialogTitle>{aula ? "Editar aula" : "Nova aula"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Título</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Descrição</Label>
          <Textarea rows={3} value={descricao ?? ""} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL do vídeo (embed YouTube / Vimeo / Pandavideo)</Label>
          <Input
            value={urlVideo ?? ""}
            onChange={(e) => setUrlVideo(e.target.value)}
            placeholder="https://www.youtube.com/embed/..."
          />
        </div>
        <div className="space-y-1.5 w-32">
          <Label className="text-xs">Ordem</Label>
          <Input
            type="number"
            min={1}
            value={ordem}
            onChange={(e) => setOrdem(parseInt(e.target.value) || 1)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
