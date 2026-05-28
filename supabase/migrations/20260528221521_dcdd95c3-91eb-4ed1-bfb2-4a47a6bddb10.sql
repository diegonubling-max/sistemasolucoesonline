-- Grant permissions for all tables in the public schema to authenticated and service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Ensure anon has select if needed (e.g. for some public parts, if any)
-- For now, let's assume authenticated is enough for admin panel
GRANT SELECT ON public.configuracoes TO authenticated;
GRANT SELECT ON public.configuracoes TO anon;
