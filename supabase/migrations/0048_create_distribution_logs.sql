-- Create distribution_logs table for admin item distribution history
CREATE TABLE IF NOT EXISTS public.distribution_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  assignments JSONB NOT NULL,
  recipient_count INTEGER NOT NULL,
  total_quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.distribution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view distribution logs" ON public.distribution_logs
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert distribution logs" ON public.distribution_logs
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update distribution logs" ON public.distribution_logs
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete distribution logs" ON public.distribution_logs
  FOR DELETE
  USING (public.is_admin());

CREATE OR REPLACE TRIGGER update_distribution_logs_updated_at
BEFORE UPDATE ON public.distribution_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
