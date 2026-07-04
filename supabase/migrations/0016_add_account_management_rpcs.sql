-- Create RPC function for admin to delete clan users
CREATE OR REPLACE FUNCTION public.admin_delete_clan_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete the clan user record
  DELETE FROM public.clan_users WHERE id = target_user_id;
  
  -- Note: We don't delete the auth user here as that requires admin privileges
  -- The auth user will remain but won't have access to clan functionality
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.admin_delete_clan_user TO authenticated;
