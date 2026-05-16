-- Bug 1: kanban_columns não tinha user_id — createColumn falhava ao tentar inserir
ALTER TABLE public.kanban_columns
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
