import { createFileRoute } from "@tanstack/react-router";
import { SetorProvasPage } from "./_admin.setor-provas";

export const Route = createFileRoute("/_admin/documentacao")({
  component: SetorProvasPage,
});
