import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  forced?: boolean;
  colaboradorId?: string;
  onSuccess?: () => void;
}

export function ChangePasswordModal({ open, onOpenChange, forced, colaboradorId, onSuccess }: Props) {
  const [senha, setSenha] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (senha.length < 6) return toast.error("A senha deve ter no mínimo 6 caracteres.");
    if (senha !== confirm) return toast.error("As senhas não coincidem.");
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      if (forced && colaboradorId) {
        await supabase.from("colaboradores").update({ primeiro_acesso: false } as any).eq("id", colaboradorId);
      }
      toast.success("Senha alterada com sucesso!");
      setSenha("");
      setConfirm("");
      onSuccess?.();
      onOpenChange?.(false);
    } catch (e: any) {
      toast.error("Erro ao alterar senha", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={forced ? undefined : onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => forced && e.preventDefault()}
        onEscapeKeyDown={(e) => forced && e.preventDefault()}
        onInteractOutside={(e) => forced && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{forced ? "Bem-vindo! Defina sua senha pessoal" : "Alterar Senha"}</DialogTitle>
          {forced && (
            <DialogDescription>Por segurança, troque a senha provisória antes de continuar.</DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Nova senha</Label>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <Label>Confirmar nova senha</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          {!forced && (
            <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={saving}>
              Cancelar
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {forced ? "Salvar e Entrar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
