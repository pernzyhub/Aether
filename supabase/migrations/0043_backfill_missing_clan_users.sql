-- Backfill clan_users rows for any auth.users entries that are missing a profile
INSERT INTO public.clan_users (id, ign, is_active, created_at, updated_at)
SELECT
  u.id,
  u.raw_user_meta_data->>'full_name' AS ign,
  TRUE AS is_active,
  NOW() AS created_at,
  NOW() AS updated_at
FROM auth.users AS u
LEFT JOIN public.clan_users AS cu ON cu.id = u.id
WHERE cu.id IS NULL;
