-- Adiciona hospital_id em actions para escopo multi-hospital
ALTER TABLE public.actions
  ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE;

-- Atualiza RLS: membros do hospital veem ações do seu hospital
DROP POLICY IF EXISTS "acoes_user" ON public.actions;
DROP POLICY IF EXISTS "Users view own actions" ON public.actions;
DROP POLICY IF EXISTS "Users insert own actions" ON public.actions;
DROP POLICY IF EXISTS "Users update own actions" ON public.actions;
DROP POLICY IF EXISTS "Users delete own actions" ON public.actions;

CREATE POLICY "actions_select" ON public.actions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      hospital_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.hospital_users hu
        JOIN public.profiles p ON p.user_id = hu.user_id
        WHERE hu.hospital_id = actions.hospital_id
          AND p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "actions_insert" ON public.actions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "actions_update" ON public.actions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "actions_delete" ON public.actions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
