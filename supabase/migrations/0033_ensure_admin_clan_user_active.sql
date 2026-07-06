CREATE OR REPLACE FUNCTION public.ensure_admin_clan_user_active()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := auth.uid();
  v_ign text;
BEGIN
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  v_ign := COALESCE(auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() -> 'user_metadata' ->> 'name', auth.jwt() ->> 'email');

  INSERT INTO public.clan_users (id, ign, is_active, created_at, updated_at)
  VALUES (v_id, v_ign, TRUE, now(), now())
  ON CONFLICT (id) DO UPDATE
    SET is_active = TRUE,
        ign = COALESCE(public.clan_users.ign, EXCLUDED.ign),
        updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_admin_clan_user_active() TO authenticated;

INSERT INTO public.clan_users (id, ign, is_active, created_at, updated_at)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
  TRUE,
  now(),
  now()
FROM auth.users u
WHERE COALESCE(u.raw_app_meta_data->>'role', '') IN ('admin', 'superuser')
ON CONFLICT (id) DO UPDATE
  SET is_active = TRUE,
      ign = COALESCE(public.clan_users.ign, EXCLUDED.ign),
      updated_at = now();

NOTIFY pgrst, 'reload schema';
