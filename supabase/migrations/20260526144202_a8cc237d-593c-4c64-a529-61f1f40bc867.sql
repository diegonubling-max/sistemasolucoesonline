ALTER TABLE public.parcelas 
ADD COLUMN valor_bruto NUMERIC,
ADD COLUMN valor_taxa NUMERIC,
ADD COLUMN valor_liquido NUMERIC,
ADD COLUMN cartao_parcelas INTEGER;

-- Update RLS policies is not needed if we are just adding columns to an existing table with RLS enabled.
-- But let's ensure the grants are there for these new columns (though standard GRANT SELECT, UPDATE usually covers all columns).
