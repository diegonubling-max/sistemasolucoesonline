interface OrigemBadgeProps {
  origem?: string | null;
  className?: string;
}

export function OrigemBadge({ origem, className }: OrigemBadgeProps) {
  if (origem !== "Lançamento") return null;
  return (
    <span
      className={
        "px-2 py-0.5 rounded-full text-[10px] bg-orange-100 text-orange-700 font-semibold whitespace-nowrap " +
        (className ?? "")
      }
      title="Aluno de Aulão"
    >
      🟠 Aulão
    </span>
  );
}
