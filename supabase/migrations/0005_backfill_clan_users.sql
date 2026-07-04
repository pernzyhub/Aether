-- Backfill existing auth.users into clan_users table if they don't have an entry yet
INSERT INTO public.clan_users (id, ign, is_active, created_at, updated_at)
SELECT 
  id, 
  raw_user_meta_data->>'full_name' AS ign,
  true AS is_active,
  NOW() AS created_at,
  NOW() AS updated_at
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.clan_users WHERE clan_users.id = auth.users.id
);
