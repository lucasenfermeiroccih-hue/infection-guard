
-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('ccih', 'diretoria', 'assistencial');
CREATE TYPE public.action_status AS ENUM ('planejado', 'em_andamento', 'concluido');
CREATE TYPE public.recurrence_type AS ENUM ('none', 'daily', 'weekly', 'monthly');

-- Função genérica de updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "CCIH manages roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'ccih'))
  WITH CHECK (public.has_role(auth.uid(), 'ccih'));

-- actions (5W2H)
CREATE TABLE public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  what TEXT NOT NULL,
  why TEXT NOT NULL,
  where_sector TEXT NOT NULL,
  who TEXT NOT NULL,
  when_date DATE NOT NULL,
  how TEXT NOT NULL,
  how_much TEXT,
  status public.action_status NOT NULL DEFAULT 'planejado',
  infection_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own actions" ON public.actions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own actions" ON public.actions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own actions" ON public.actions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own actions" ON public.actions FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_actions_updated BEFORE UPDATE ON public.actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- kanban_columns
CREATE TABLE public.kanban_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own columns" ON public.kanban_columns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- kanban_tasks
CREATE TABLE public.kanban_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  column_id UUID NOT NULL REFERENCES public.kanban_columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  recurrence public.recurrence_type NOT NULL DEFAULT 'none',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kanban_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tasks" ON public.kanban_tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.kanban_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- app_settings
CREATE TABLE public.app_settings (
  user_id UUID PRIMARY KEY,
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_push BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON public.app_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- iras_series (compartilhada entre usuários autenticados)
CREATE TABLE public.iras_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  sector TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.iras_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read iras" ON public.iras_series FOR SELECT TO authenticated USING (true);
CREATE POLICY "CCIH writes iras" ON public.iras_series FOR ALL
  USING (public.has_role(auth.uid(), 'ccih'))
  WITH CHECK (public.has_role(auth.uid(), 'ccih'));

-- Trigger: cria profile + role assistencial em novo signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'assistencial');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
