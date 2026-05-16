-- Corrige FK de kanban_tasks.assigned_to: apontava para auth.users mas precisa
-- apontar para profiles.user_id para o PostgREST resolver .select("*, profiles(full_name)")
ALTER TABLE public.kanban_tasks
  DROP CONSTRAINT kanban_tasks_assigned_to_fkey;

ALTER TABLE public.kanban_tasks
  ADD CONSTRAINT kanban_tasks_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- Adiciona FK de hospital_users.user_id → profiles.user_id
-- para o PostgREST resolver .select("user_id, profiles(full_name, email)")
ALTER TABLE public.hospital_users
  ADD CONSTRAINT hospital_users_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
