ALTER TABLE public.clan_users
ADD COLUMN IF NOT EXISTS is_hidden_from_members BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.clan_users cu
SET is_hidden_from_members = TRUE,
    updated_at = now()
FROM auth.users u
WHERE u.id = cu.id
  AND (
    COALESCE(u.raw_app_meta_data->>'role', '') IN ('admin', 'superuser')
    OR COALESCE(u.raw_user_meta_data->>'role', '') IN ('admin', 'superuser')
    OR COALESCE((u.raw_app_meta_data->>'is_superuser')::boolean, FALSE)
    OR COALESCE((u.raw_user_meta_data->>'is_superuser')::boolean, FALSE)
  );

NOTIFY pgrst, 'reload schema';
