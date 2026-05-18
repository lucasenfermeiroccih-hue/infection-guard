-- Tabela de múltiplos responsáveis por tarefa (many-to-many)
CREATE TABLE public.kanban_task_assignees (
  task_id UUID NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

ALTER TABLE public.kanban_task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital members view task assignees"
  ON public.kanban_task_assignees
  FOR SELECT
  TO authenticated
  USING (
    task_id IN (
      SELECT kt.id FROM public.kanban_tasks kt
      WHERE kt.hospital_id IN (
        SELECT hu.hospital_id FROM public.hospital_users hu WHERE hu.user_id = auth.uid()
      )
      OR kt.hospital_id IS NULL
    )
  );

CREATE POLICY "hospital members insert task assignees"
  ON public.kanban_task_assignees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    task_id IN (
      SELECT kt.id FROM public.kanban_tasks kt
      WHERE kt.hospital_id IN (
        SELECT hu.hospital_id FROM public.hospital_users hu WHERE hu.user_id = auth.uid()
      )
      OR kt.hospital_id IS NULL
    )
  );

CREATE POLICY "hospital members delete task assignees"
  ON public.kanban_task_assignees
  FOR DELETE
  TO authenticated
  USING (
    task_id IN (
      SELECT kt.id FROM public.kanban_tasks kt
      WHERE kt.hospital_id IN (
        SELECT hu.hospital_id FROM public.hospital_users hu WHERE hu.user_id = auth.uid()
      )
      OR kt.hospital_id IS NULL
    )
  );

-- Migra atribuições existentes (assigned_to → junction table)
INSERT INTO public.kanban_task_assignees (task_id, user_id)
SELECT id, assigned_to
FROM public.kanban_tasks
WHERE assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;
