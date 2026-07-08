import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export const MATERIAS_PADRAO = [
  "Biologia", "Filosofia", "Física", "Geografia", "História",
  "Inglês", "Matemática", "Português", "Química", "Sociologia",
];

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  label?: string;
}

export function MateriasSelector({ value, onChange, label = "Matérias da prova *" }: Props) {
  const toggle = (m: string) => {
    onChange(value.includes(m) ? value.filter(x => x !== m) : [...value, m]);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
            onClick={() => onChange([...MATERIAS_PADRAO])}>Selecionar todas</Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
            onClick={() => onChange([])}>Limpar</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-md border p-3 bg-muted/20">
        {MATERIAS_PADRAO.map(m => (
          <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={value.includes(m)} onCheckedChange={() => toggle(m)} />
            <span>{m}</span>
          </label>
        ))}
      </div>
      {value.length === 0 && (
        <p className="text-xs text-red-600">Selecione pelo menos uma matéria.</p>
      )}
    </div>
  );
}
