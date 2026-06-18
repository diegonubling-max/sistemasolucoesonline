ALTER TABLE public.aluno_aulas_assistidas 
ADD COLUMN IF NOT EXISTS duracao_total integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS tempo_assistido integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS percentual_assistido decimal(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ultima_posicao integer DEFAULT 0;