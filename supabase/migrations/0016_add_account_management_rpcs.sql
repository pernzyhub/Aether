-- Create RPC function for admin to create clan users
DROP FUNCTION IF EXISTS public.admin_create_clan_user(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.admin_create_clan_user(
  user_id UUID,
  ign TEXT,
  role TEXT DEFAULT 'member',
  is_active BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.clan_users (id, ign, role, is_active)
  VALUES (user_id, ign, role, is_active);
END;
$$;

-- Create RPC function for admin to update clan user IGN
CREATE OR REPLACE FUNCTION public.admin_update_clan_user_ign(
  target_user_id UUID,
  new_ign TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.clan_users
  SET ign = new_ign
  WHERE id = target_user_id;
END;
$$;

-- Create RPC function for admin to update clan user password
CREATE OR REPLACE FUNCTION public.admin_update_clan_user_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update password in auth.users (requires admin service role)
  -- This function will be called with elevated privileges
  PERFORM auth.users()
  WHERE id = target_user_id;
  
  -- Note: Actual password update requires service role key
  -- This is a placeholder for the admin dashboard logic
END;
$$;

-- Create RPC function for admin to toggle clan user status
CREATE OR REPLACE FUNCTION public.admin_toggle_clan_user_status(
  target_user_id UUID,
  new_status BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.clan_users
  SET is_active = new_status
  WHERE id = target_user_id;
END;
$$;

-- Create RPC function for admin to delete clan users
CREATE OR REPLACE FUNCTION public.admin_delete_clan_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Soft delete the clan user by deactivating the record.
  UPDATE public.clan_users SET is_active = false WHERE id = target_user_id;
  
  -- Note: We don't delete the auth user here as that requires admin privileges.
  -- Preserving the clan_users row prevents deleted users from being recreated automatically.
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.admin_create_clan_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_clan_user_ign TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_clan_user_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_clan_user_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_clan_user TO authenticated;
