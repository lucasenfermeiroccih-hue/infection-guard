-- Corrige recursão infinita na RLS de hospital_users.
-- A policy anterior ("Primary admins view hospital members") fazia SELECT em
-- hospital_users dentro de uma policy de hospital_users → loop infinito → HTTP 500
-- em TODAS as queries do banco.
--
-- Fix: SECURITY DEFINER function que lê hospital_users como superuser (sem RLS),
-- eliminando o ciclo.

DROP POLICY IF EXISTS "Primary admins view hospital members" ON public.hospital_users;

CREATE OR REPLACE FUNCTION public.get_primary_admin_hospital_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT hospital_id
  FROM public.hospital_users
  WHERE user_id = auth.uid()
    AND is_primary_admin = true;
$$;

REVOKE EXECUTE ON FUNCTION public.get_primary_admin_hospital_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_primary_admin_hospital_ids() TO authenticated;

CREATE POLICY "Primary admins view hospital members"
  ON public.hospital_users
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR hospital_id IN (SELECT get_primary_admin_hospital_ids())
  );
