-- Create a secure RPC for member BV pages to fetch requests for a specific user
CREATE OR REPLACE FUNCTION public.get_bv_requests_for_user(
  target_user_id UUID
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  amount INTEGER,
  reason TEXT,
  proof_image TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.user_id,
    b.amount,
    b.reason,
    b.proof_image,
    b.status,
    b.created_at,
    b.updated_at
  FROM public.bv_requests b
  WHERE b.user_id = target_user_id
  ORDER BY b.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bv_requests_for_user(UUID) TO anon, authenticated;
