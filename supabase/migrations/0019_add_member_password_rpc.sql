-- RPC function to update member password (bypasses RLS for member users)
CREATE OR REPLACE FUNCTION public.update_member_password(
  user_id UUID,
  new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.clan_users
  SET password = new_password,
      updated_at = NOW()
  WHERE id = user_id;
  
  RETURN FOUND;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_member_password TO authenticated;
