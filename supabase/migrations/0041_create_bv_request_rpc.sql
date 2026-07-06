-- Create RPC function for inserting BV requests with proper auth handling
CREATE OR REPLACE FUNCTION public.create_bv_request(
  target_user_id UUID,
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
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clan_users
    WHERE id = target_user_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'User is not active or does not exist';
  END IF;

  INSERT INTO public.bv_requests (user_id, reason, amount, status)
  VALUES (target_user_id, request_reason, request_amount, request_status)
  RETURNING id INTO new_request_id;

  RETURN jsonb_build_object('id', new_request_id, 'success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_bv_request(UUID, TEXT, INTEGER, TEXT) TO anon, authenticated;
