-- Add password column to clan_users table
ALTER TABLE public.clan_users 
ADD COLUMN IF NOT EXISTS password TEXT;

-- Update RLS policy to allow users to update their own password
CREATE POLICY "Users can update their own password"
  ON public.clan_users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
