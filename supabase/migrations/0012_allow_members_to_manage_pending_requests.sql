-- Allow signed-in members to edit or cancel their own pending requests.
DROP POLICY IF EXISTS "Users can update their own pending requests" ON public.item_requests;
CREATE POLICY "Users can update their own pending requests"
  ON public.item_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Users can delete their own pending requests" ON public.item_requests;
CREATE POLICY "Users can delete their own pending requests"
  ON public.item_requests
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND status = 'pending'
  );
