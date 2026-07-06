-- Create BV requests table for member BV submissions
CREATE TABLE IF NOT EXISTS public.bv_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER DEFAULT 0 NOT NULL,
  reason TEXT,
  proof_image TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.bv_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create BV requests when active"
  ON public.bv_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.clan_users
      WHERE id = auth.uid()
        AND is_active = TRUE
    )
  );

CREATE POLICY "Users can view their own BV requests"
  ON public.bv_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage BV requests"
  ON public.bv_requests
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
