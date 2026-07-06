-- Drop existing BV requests table and recreate with proper RLS for RPC access
DROP TABLE IF EXISTS public.bv_requests CASCADE;

CREATE TABLE public.bv_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.clan_users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER DEFAULT 0 NOT NULL,
  reason TEXT,
  proof_image TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.bv_requests ENABLE ROW LEVEL SECURITY;

-- Single permissive INSERT policy for authenticated users (RPC function runs as definer)
CREATE POLICY "Allow authenticated inserts via RPC"
  ON public.bv_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT policy: users see their own, admins see all
CREATE POLICY "Users can view their own BV requests"
  ON public.bv_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- UPDATE policy: admins only
CREATE POLICY "Admins can update BV requests"
  ON public.bv_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE policy: admins only
CREATE POLICY "Admins can delete BV requests"
  ON public.bv_requests
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
