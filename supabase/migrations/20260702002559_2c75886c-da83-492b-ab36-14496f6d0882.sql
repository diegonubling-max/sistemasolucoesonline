
ALTER TABLE public.prova_agendamentos
  ADD COLUMN IF NOT EXISTS docs_solicitados boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS docs_recebidos boolean NOT NULL DEFAULT false;

ALTER TABLE public.colaborador_permissoes
  ADD COLUMN IF NOT EXISTS ver_provas_agendadas boolean NOT NULL DEFAULT false;
