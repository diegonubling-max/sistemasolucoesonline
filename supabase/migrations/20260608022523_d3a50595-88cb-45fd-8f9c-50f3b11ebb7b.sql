-- Adicionar política para permitir que colaboradores vejam todos os alunos
-- Isso é necessário para a busca global por CPF funcionar corretamente entre polos
CREATE POLICY "Colaboradores can view all students" ON public.alunos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.colaboradores 
    WHERE colaboradores.user_id = auth.uid()
  )
);

-- Garantir que a política de Admins continue funcionando (já existe, mas por clareza)
-- A política "Admins full access on alunos" já cobre o papel 'admin'

-- Se por algum motivo a tabela alunos estiver com RLS desativado (como vi no check anterior), 
-- vamos ativá-lo para garantir que as novas regras sejam aplicadas corretamente, 
-- mas mantendo o acesso para quem já tinha.
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;

-- Nota: Como ativei o RLS, preciso garantir que as políticas existentes cobrem tudo.
-- Já existem: Admins full access, Students view/update own profile.
-- Agora adicionei: Colaboradores can view all students.
