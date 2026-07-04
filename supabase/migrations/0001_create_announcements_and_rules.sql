-- Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for reading announcements (all authenticated users)
CREATE POLICY "Authenticated users can read announcements"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (true);

-- Create RLS policy for inserting/updating/deleting announcements (only admins)
CREATE POLICY "Admins can manage announcements"
  ON public.announcements
  USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'superuser')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'superuser');

-- Create rules table
CREATE TABLE IF NOT EXISTS public.rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_num INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on rules
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for reading rules (all authenticated users)
CREATE POLICY "Authenticated users can read rules"
  ON public.rules
  FOR SELECT
  TO authenticated
  USING (true);

-- Create RLS policy for inserting/updating/deleting rules (only admins)
CREATE POLICY "Admins can manage rules"
  ON public.rules
  USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'superuser')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'superuser');

-- Optional: Add some example data
-- INSERT INTO public.announcements (title, content)
-- VALUES
--   ('Welcome to AetherClan!', 'Welcome to the clan! Please read the rules and have fun!'),
--   ('Clan Warfare Season 2', 'Season 2 starts next week! Stay tuned for more details!');

-- INSERT INTO public.rules (order_num, title, content)
-- VALUES
--   (1, 'Respect All Members', 'Treat every clan member with respect. Toxic behavior will not be tolerated.'),
--   (2, 'Be Active', 'Participate in clan events and contribute to the community.'),
--   (3, 'Follow Game Rules', 'No cheating, hacking, or exploiting in any games.'),
--   (4, 'Clean Communication', 'Use appropriate channels and avoid spam.'),
--   (5, 'Represent the Clan', 'Be a positive ambassador for AetherClan wherever you go.');
