-- Add password column to clan_users table (for IGN/password login)
ALTER TABLE public.clan_users 
ADD COLUMN IF NOT EXISTS password TEXT;
