
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'aluno');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Alunos
CREATE TABLE public.alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text NOT NULL,
  email text NOT NULL UNIQUE,
  data_nascimento date NOT NULL,
  cpf text NOT NULL UNIQUE,
  endereco text,
  bairro text,
  cidade text,
  estado text,
  menor_de_idade boolean NOT NULL DEFAULT false,
  responsavel_nome text,
  responsavel_telefone text,
  responsavel_cpf text,
  responsavel_email text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.calc_menor_idade()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.menor_de_idade := (NEW.data_nascimento > (CURRENT_DATE - INTERVAL '18 years'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_alunos_menor
BEFORE INSERT OR UPDATE OF data_nascimento ON public.alunos
FOR EACH ROW EXECUTE FUNCTION public.calc_menor_idade();

ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins all alunos" ON public.alunos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Cursos
CREATE TABLE public.cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins all cursos" ON public.cursos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Aulas
CREATE TABLE public.aulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  url_video text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_aulas_curso ON public.aulas(curso_id, ordem);
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins all aulas" ON public.aulas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Matriculas
CREATE TABLE public.matriculas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins all matriculas" ON public.matriculas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.matricula_cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  data_liberacao timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.matricula_cursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins all matricula_cursos" ON public.matricula_cursos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
