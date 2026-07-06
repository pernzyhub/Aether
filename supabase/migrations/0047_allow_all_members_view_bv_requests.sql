-- Allow all authenticated members to view BV requests so the shared BV board shows all players' requests.
-- This preserves existing admin-only update/delete policies while opening read access.

ALTER TABLE public.bv_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own BV requests" ON public.bv_requests;
DROP POLICY IF EXISTS "Authenticated users can view BV requests" ON public.bv_requests;

CREATE POLICY "Authenticated users can view BV requests"
  ON public.bv_requests
  FOR SELECT
  TO authenticated
  USING (true);
