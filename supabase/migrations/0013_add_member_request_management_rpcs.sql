CREATE OR REPLACE FUNCTION public.update_item_request(
  target_request_id UUID,
  target_user_id UUID,
  target_item_id UUID,
  target_quantity INTEGER,
  target_notes TEXT DEFAULT NULL
)
RETURNS public.item_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_request public.item_requests;
BEGIN
  IF target_request_id IS NULL THEN
    RAISE EXCEPTION 'target_request_id is required';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;

  IF target_item_id IS NULL THEN
    RAISE EXCEPTION 'target_item_id is required';
  END IF;

  IF target_quantity IS NULL OR target_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clan_users
    WHERE id = target_user_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Your account is inactive or missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.items
    WHERE id = target_item_id
  ) THEN
    RAISE EXCEPTION 'Selected item no longer exists';
  END IF;

  UPDATE public.item_requests
  SET item_id = target_item_id,
      quantity = target_quantity,
      notes = NULLIF(target_notes, ''),
      updated_at = NOW()
  WHERE id = target_request_id
    AND user_id = target_user_id
    AND status = 'pending'
  RETURNING *
  INTO updated_request;

  IF updated_request IS NULL THEN
    RAISE EXCEPTION 'Pending request not found for this account';
  END IF;

  RETURN updated_request;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_item_request(UUID, UUID, UUID, INTEGER, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_item_request(
  target_request_id UUID,
  target_user_id UUID
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.clan_users
    WHERE id = target_user_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Your account is inactive or missing';
  END IF;

  DELETE FROM public.item_requests
  WHERE id = target_request_id
    AND user_id = target_user_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending request not found for this account';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_item_request(UUID, UUID) TO anon, authenticated;
