CREATE TABLE public.leads_diarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    vendedora TEXT NOT NULL,
    origem TEXT NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads_diarios TO authenticated;
GRANT ALL ON public.leads_diarios TO service_role;

-- Enable RLS
ALTER TABLE public.leads_diarios ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can manage leads_diarios
CREATE POLICY "Manage leads_diarios" ON public.leads_diarios
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Index for performance
CREATE INDEX idx_leads_diarios_data ON public.leads_diarios(data);
CREATE INDEX idx_leads_diarios_vendedora ON public.leads_diarios(vendedora);
CREATE INDEX idx_leads_diarios_origem ON public.leads_diarios(origem);