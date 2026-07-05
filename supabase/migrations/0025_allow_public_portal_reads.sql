-- Allow the member portal to read active announcements, rules, and events without a signed-in admin session.

DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can read active announcements" ON public.announcements;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE POLICY "Public can read active announcements"
  ON public.announcements
  FOR SELECT
  TO anon, authenticated
  USING (is_active IS NOT FALSE);

DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can read active rules" ON public.rules;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE POLICY "Public can read active rules"
  ON public.rules
  FOR SELECT
  TO anon, authenticated
  USING (is_active IS NOT FALSE);

DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can read active events" ON public.events;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE POLICY "Public can read active events"
  ON public.events
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
