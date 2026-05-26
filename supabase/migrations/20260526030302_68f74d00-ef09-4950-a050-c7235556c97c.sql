-- Resetar a sequência para 1627
ALTER SEQUENCE alunos_ctr_seq RESTART WITH 1627;

-- Limpar a tabela de alunos (testes)
DELETE FROM public.alunos;