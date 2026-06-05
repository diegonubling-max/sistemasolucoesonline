ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS dias_prova_final INTEGER DEFAULT 60;
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS data_liberacao_prova DATE;

ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS is_prova_final BOOLEAN DEFAULT false;

-- Create the course "Prova Final" if it doesn't exist
-- First find the segment ID for "Curso Preparatório"
DO $$
DECLARE
    v_segmento_id UUID;
BEGIN
    SELECT id INTO v_segmento_id FROM public.segmentos WHERE nome = 'Curso Preparatório' LIMIT 1;
    
    IF v_segmento_id IS NOT NULL THEN
        INSERT INTO public.cursos (nome, descricao, segmento_id, is_prova_final, ativo)
        VALUES ('Prova Final', 'Prova Final do Curso Preparatório', v_segmento_id, true, true)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Function to calculate data_liberacao_prova
CREATE OR REPLACE FUNCTION public.calculate_prova_final_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_liberacao_prova := (COALESCE(NEW.created_at, now()) + (NEW.dias_prova_final || ' days')::interval)::date;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to calculate data_liberacao_prova on insert or update
DROP TRIGGER IF EXISTS tr_calculate_prova_final_date ON public.alunos;
CREATE TRIGGER tr_calculate_prova_final_date
BEFORE INSERT OR UPDATE OF created_at, dias_prova_final ON public.alunos
FOR EACH ROW EXECUTE FUNCTION public.calculate_prova_final_date();

-- Update existing data
UPDATE public.alunos 
SET data_liberacao_prova = (created_at + (dias_prova_final || ' days')::interval)::date 
WHERE data_liberacao_prova IS NULL;