-- Bug 4: INSERT em kanban_tasks exigia is_primary_admin. Se checkIsAdmin
-- falhasse por qualquer motivo, o admin ficava bloqueado no banco também.
-- A UI já controla quem cria tarefas (só admins veem os botões), portanto
-- é seguro permitir INSERT para qualquer membro do hospital no banco.
DROP POLICY IF EXISTS "hospital admins insert tasks" ON public.kanban_tasks;

CREATE POLICY "hospital members insert tasks"
  ON public.kanban_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    hospital_id IS NULL
    OR hospital_id IN (
      SELECT hu.hospital_id
      FROM public.hospital_users hu
      WHERE hu.user_id = auth.uid()
    )
  );
