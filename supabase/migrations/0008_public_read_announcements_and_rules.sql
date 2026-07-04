-- Allow the member portal to read announcements and rules without an admin session
DROP POLICY IF EXISTS "Public can read announcements" ON public.announcements;
CREATE POLICY "Public can read announcements"
  ON public.announcements
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Public can read rules" ON public.rules;
CREATE POLICY "Public can read rules"
  ON public.rules
  FOR SELECT
  TO public
  USING (true);
