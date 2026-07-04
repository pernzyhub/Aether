-- Allow the member portal to read items and requests for the member experience
DROP POLICY IF EXISTS "Public can read items" ON public.items;
CREATE POLICY "Public can read items"
  ON public.items
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Users can view their own requests" ON public.item_requests;
CREATE POLICY "Users can view their own requests"
  ON public.item_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all requests" ON public.item_requests;
CREATE POLICY "Admins can view all requests"
  ON public.item_requests
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can create requests if active" ON public.item_requests;
CREATE POLICY "Users can create requests if active"
  ON public.item_requests
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
