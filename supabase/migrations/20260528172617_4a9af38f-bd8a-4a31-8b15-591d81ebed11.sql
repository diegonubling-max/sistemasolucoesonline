-- Create segments table
CREATE TABLE public.segmentos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    ordem INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add column to courses
ALTER TABLE public.cursos 
ADD COLUMN segmento_id UUID REFERENCES public.segmentos(id);

-- Insert default segments
INSERT INTO public.segmentos (nome, ordem) VALUES
('Curso Preparatório', 1),
('Informática', 2),
('Administrativo', 3),
('Área da Beleza', 4),
('Tecnologia', 5),
('Área da Saúde', 6),
('Outros', 7);

-- Grants
GRANT SELECT ON public.segmentos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.segmentos TO authenticated;
GRANT ALL ON public.segmentos TO service_role;

-- Enable RLS
ALTER TABLE public.segmentos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public segments are viewable by everyone" 
ON public.segmentos 
FOR SELECT 
USING (ativo = true);

CREATE POLICY "Admins can manage segments" 
ON public.segmentos 
USING (true)
WITH CHECK (true);
