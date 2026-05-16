-- Bug 2: listHospitalUsers retornava vazio porque a RLS de hospital_users
-- exige role 'hospital_admin' (sistema do IRASControl), mas usuários do
-- Guardião Hospitalar só possuem is_primary_admin = true na tabela hospital_users.
-- Esta policy permite que primary_admins vejam todos os membros do seu hospital.
CREATE POLICY "Primary admins view hospital members"
  ON public.hospital_users
  FOR SELECT
  TO authenticated
  USING (
    hospital_id IN (
      SELECT hu.hospital_id
      FROM public.hospital_users hu
      WHERE hu.user_id = auth.uid()
        AND hu.is_primary_admin = true
    )
  );
