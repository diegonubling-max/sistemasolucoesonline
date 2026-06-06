CREATE OR REPLACE FUNCTION public.registrar_aula_assistida(
    p_aluno_id UUID,
    p_aula_id UUID,
    p_curso_id UUID
) RETURNS VOID AS $$
BEGIN
    -- Só insere se não houver um registro recente (últimos 5 minutos) para a mesma aula
    -- Isso evita duplicatas por re-renderizações ou re-seleção rápida
    IF NOT EXISTS (
        SELECT 1 FROM public.aluno_aulas_assistidas 
        WHERE aluno_id = p_aluno_id 
        AND aula_id = p_aula_id 
        AND created_at > (NOW() - INTERVAL '5 minutes')
    ) THEN
        INSERT INTO public.aluno_aulas_assistidas (aluno_id, aula_id, curso_id, assistida_em)
        VALUES (p_aluno_id, p_aula_id, p_curso_id, NOW());
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.registrar_aula_assistida(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_aula_assistida(UUID, UUID, UUID) TO service_role;