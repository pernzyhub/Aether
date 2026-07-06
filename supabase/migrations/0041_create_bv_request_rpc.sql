-- Create RPC function for inserting BV requests with proper auth handling
CREATE OR REPLACE FUNCTION public.create_bv_request(
  target_user_id UUID DEFAULT NULL,
  request_reason TEXT DEFAULT NULL,
  request_amount INTEGER DEFAULT 0,
  request_status TEXT DEFAULT 'pending'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_request_id UUID;
  requester_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated user required';
  END IF;

  requester_id := COALESCE(target_user_id, auth.uid());

  IF requester_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Cannot create a BV request for another user.';
  END IF;

  INSERT INTO public.clan_users (id, ign, is_active)
  SELECT requester_id, NULL, TRUE
  WHERE NOT EXISTS (SELECT 1 FROM public.clan_users WHERE id = requester_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.clan_users
    WHERE id = requester_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'User is not active or does not exist';
  END IF;

  INSERT INTO public.bv_requests (user_id, reason, amount, status)
  VALUES (requester_id, request_reason, request_amount, request_status)
  RETURNING id INTO new_request_id;

  RETURN jsonb_build_object('id', new_request_id, 'success', TRUE);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_bv_request TO authenticated;
