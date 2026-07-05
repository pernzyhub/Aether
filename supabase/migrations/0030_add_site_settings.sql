-- Create a simple key/value table for site-wide settings
-- Run this migration in Supabase SQL editor as project owner/admin.

CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Convenience trigger to update "updated_at"
CREATE OR REPLACE FUNCTION public.site_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER trg_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION public.site_settings_updated_at();

-- Insert default access_gate setting if not present
INSERT INTO public.site_settings (key, value)
SELECT 'access_gate', jsonb_build_object('enabled', true, 'access_code', 'AETHER2026')
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'access_gate');
