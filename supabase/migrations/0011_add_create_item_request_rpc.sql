CREATE OR REPLACE FUNCTION public.create_item_request(
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
  created_request public.item_requests;
BEGIN
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

  INSERT INTO public.item_requests (
    user_id,
    item_id,
    quantity,
    notes,
    status
  )
  VALUES (
    target_user_id,
    target_item_id,
    target_quantity,
    NULLIF(target_notes, ''),
    'pending'
  )
  RETURNING *
  INTO created_request;

  RETURN created_request;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_item_request(UUID, UUID, INTEGER, TEXT) TO anon, authenticated;
