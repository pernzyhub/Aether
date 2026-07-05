-- Enable RLS for site_settings and add admin policies + public access gate helper.
-- Run in Supabase SQL editor as a project owner/admin.

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public can read access gate status" ON public.site_settings;

CREATE POLICY "Admins can manage site settings" ON public.site_settings
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Public can read access gate status" ON public.site_settings
  FOR SELECT
  USING (key = 'access_gate');

CREATE OR REPLACE FUNCTION public.validate_access_code(input_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  setting JSONB;
  enabled BOOLEAN;
  expected TEXT;
BEGIN
  SELECT value
  INTO setting
  FROM public.site_settings
  WHERE key = 'access_gate'
  LIMIT 1;

  IF setting IS NULL THEN
    enabled := TRUE;
    expected := 'AETHER2026';
  ELSE
    enabled := COALESCE((setting ->> 'enabled')::BOOLEAN, TRUE);
    expected := COALESCE(setting ->> 'access_code', 'AETHER2026');
  END IF;

  IF NOT enabled THEN
    RETURN TRUE;
  END IF;

  RETURN upper(coalesce(input_code, '')) = upper(expected);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_access_code(TEXT) TO anon, authenticated;
