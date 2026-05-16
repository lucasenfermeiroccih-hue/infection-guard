-- Bug 3: policy 'auth_kanban_columns' com qual=true anulava todas as outras,
-- permitindo que qualquer usuário autenticado visse/editasse colunas de qualquer hospital.
-- Removendo-a, as policies granulares já existentes passam a valer:
--   SELECT  → hospital members view columns (só membros do hospital)
--   INSERT  → hospital admins manage columns (só is_primary_admin)
--   UPDATE  → hospital admins update columns (só is_primary_admin)
--   DELETE  → hospital admins delete columns (só is_primary_admin)
DROP POLICY IF EXISTS "auth_kanban_columns" ON public.kanban_columns;
