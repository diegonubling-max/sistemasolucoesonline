import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_student/aluno/financeiro")({
  component: () => (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Financeiro</h1>
      <p className="text-muted-foreground mt-2">Esta página está em desenvolvimento.</p>
    </div>
  ),
});
