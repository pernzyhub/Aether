-- Add foreign key relationship so bv_requests can join to clan_users for Supabase nested selects
ALTER TABLE IF EXISTS public.bv_requests
  ADD CONSTRAINT fk_bv_requests_clan_users
  FOREIGN KEY (user_id)
  REFERENCES public.clan_users(id)
  ON DELETE CASCADE;
