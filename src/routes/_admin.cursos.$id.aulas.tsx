import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Power, GripVertical, Loader2, Trash2, AlertTriangle, Image, CheckCircle2, Download } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThumbnailUpload } from "@/components/admin/ThumbnailUpload";

export const Route = createFileRoute("/_admin/cursos/$id/aulas")({
  head: () => ({ meta: [{ title: "Aulas — Soluções Online" }] }),
  component: AulasManager,
});

type Aula = {
  id: string;
  curso_id: string;
  titulo: string;
  descricao: string | null;
  url_video: string | null;
  thumbnail_url: string | null;
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
  const [aulaToDelete, setAulaToDelete] = useState<Aula | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aulas", cursoId] });
      qc.invalidateQueries({ queryKey: ["cursos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("aulas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aula excluída com sucesso");
      qc.invalidateQueries({ queryKey: ["aulas", cursoId] });
      qc.invalidateQueries({ queryKey: ["cursos"] });
      setAulaToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyToAll = useMutation({
    mutationFn: async () => {
      if (!curso?.thumbnail_url) throw new Error("O curso não possui thumbnail");
      
      const { error } = await supabase
        .from("aulas")
        .update({ thumbnail_url: curso.thumbnail_url })
        .eq("curso_id", cursoId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Thumbnail aplicada em ${aulas?.length ?? 0} aulas com sucesso!`, {
        icon: <CheckCircle2 className="h-4 w-4 text-green-500" />
      });
      qc.invalidateQueries({ queryKey: ["aulas", cursoId] });
      setIsConfirmOpen(false);
    },
    onError: (e: Error) => toast.error("Erro ao aplicar thumbnail", { description: e.message }),
  });

  const updateCourseThumbnail = useMutation({
    mutationFn: async (url: string | null) => {
      const { error } = await supabase
        .from("cursos")
        .update({ thumbnail_url: url })
        .eq("id", cursoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thumbnail do curso atualizada!");
      qc.invalidateQueries({ queryKey: ["curso", cursoId] });
      qc.invalidateQueries({ queryKey: ["cursos"] });
    },
    onError: (e: Error) => toast.error("Erro ao atualizar curso", { description: e.message }),
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Image className="h-4 w-4 text-primary" /> Thumbnail do Curso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ThumbnailUpload
              value={curso?.thumbnail_url}
              onChange={(url) => updateCourseThumbnail.mutate(url)}
              bucket="thumbnails-cursos"
              recommendedSize="300x450px"
            />
            {curso?.thumbnail_url && (
              <Button 
                variant="outline" 
                size="sm"
                className="w-full text-xs"
                onClick={() => setIsConfirmOpen(true)}
                disabled={applyToAll.isPending}
              >
                {applyToAll.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 mr-2" />
                )}
                Aplicar em todas as aulas
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
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
                        onDelete={() => setAulaToDelete(a)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar em todas as aulas?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja aplicar esta thumbnail em todas as {aulas?.length ?? 0} aulas deste curso?
              Esta ação substituirá as thumbnails atuais de cada aula.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                applyToAll.mutate();
              }}
              disabled={applyToAll.isPending}
            >
              {applyToAll.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!aulaToDelete} onOpenChange={(open) => !open && setAulaToDelete(null)}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader className="items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-2">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-xl font-bold">Excluir aula?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Você está prestes a excluir a aula <span className="font-bold text-foreground">[{aulaToDelete?.titulo}]</span>. 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2 mt-4">
            <AlertDialogCancel disabled={deleteMutation.isPending} className="mt-0 sm:flex-1">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (aulaToDelete) deleteMutation.mutate(aulaToDelete.id);
              }}
              className="bg-[#DC2626] hover:bg-red-700 text-white sm:flex-1"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Excluindo...
                </>
              ) : (
                "Sim, excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableAula({
  aula,
  index,
  onEdit,
  onToggle,
  onDelete,
}: {
  aula: Aula;
  index: number;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
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
        <Power className={`h-4 w-4 ${aula.ativo ? "text-green-600" : "text-gray-400"}`} />
      </Button>
      <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete} title="Excluir">
        <Trash2 className="h-4 w-4" />
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
    thumbnail_url: null,
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
        thumbnail_url: null,
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
            thumbnail_url: aulaEditando.thumbnail_url,
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
          thumbnail_url: aulaEditando.thumbnail_url,
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
          <Label className="text-xs font-medium">Thumbnail da Aula</Label>
          <ThumbnailUpload
            value={aulaEditando.thumbnail_url}
            onChange={(url) => setAulaLocal({ ...aulaEditando, thumbnail_url: url })}
            bucket="thumbnails-aulas"
            recommendedSize="1280x720px"
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
