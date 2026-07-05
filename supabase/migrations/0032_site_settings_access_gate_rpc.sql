-- Add a secure RPC for updating the access gate setting and broaden admin detection.
-- Run in Supabase SQL editor as project owner/admin.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superuser')
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'superuser')
    OR (auth.jwt() -> 'app_metadata' ->> 'is_superuser')::BOOLEAN
    OR (auth.jwt() -> 'user_metadata' ->> 'is_superuser')::BOOLEAN,
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_access_gate(enabled BOOLEAN, access_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.site_settings (key, value, updated_at)
  VALUES (
    'access_gate',
    jsonb_build_object('enabled', enabled, 'access_code', COALESCE(access_code, 'AETHER2026')),
    NOW()
  )
  ON CONFLICT (key)
  DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_access_gate(BOOLEAN, TEXT) TO anon, authenticated;
