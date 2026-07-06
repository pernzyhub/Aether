DROP FUNCTION IF EXISTS public.update_bv_request_status(UUID, UUID, TEXT);

CREATE FUNCTION public.update_bv_request_status(
  target_request_id UUID,
  target_user_id UUID,
  target_status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_request_id IS NULL THEN
    RAISE EXCEPTION 'target_request_id is required';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;

  IF target_status IS NULL OR target_status NOT IN ('approved', 'denied') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.bv_requests
  SET status = target_status,
      updated_at = NOW()
  WHERE id = target_request_id
    AND user_id = target_user_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending BV request not found for this account';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_bv_request_status(UUID, UUID, TEXT) TO anon, authenticated;
