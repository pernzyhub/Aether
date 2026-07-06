-- Enable RLS and add safe policies for bv_request_types
ALTER TABLE IF EXISTS public.bv_request_types ENABLE ROW LEVEL SECURITY;

-- Allow public read of active types
CREATE POLICY "Public can read active BV types" ON public.bv_request_types
  FOR SELECT
  USING (is_active = true OR public.is_admin());

-- Allow admins to manage BV types
CREATE POLICY "Admins can manage BV types" ON public.bv_request_types
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
