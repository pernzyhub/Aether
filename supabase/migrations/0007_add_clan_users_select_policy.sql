-- Allow selecting clan_users by ign for login
DROP POLICY IF EXISTS "Users can view their own profile" ON public.clan_users;

CREATE POLICY "Users can view their own profile"
  ON public.clan_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow selecting any clan_user by ign for login (for memberLogin)
CREATE POLICY "Enable select by ign for login"
  ON public.clan_users
  FOR SELECT
  TO public
  USING (true);