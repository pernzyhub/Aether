-- Add clan users table for tracking IGN and active status
CREATE TABLE IF NOT EXISTS public.clan_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ign TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.clan_users ENABLE ROW LEVEL SECURITY;

-- Policies for clan_users
CREATE POLICY "Users can view their own profile"
  ON public.clan_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all clan users"
  ON public.clan_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Users can update their own ign"
  ON public.clan_users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage clan users (activate/deactivate)"
  ON public.clan_users
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Add items table for admin-managed item list
CREATE TABLE IF NOT EXISTS public.items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Policies for items
CREATE POLICY "All authenticated users can view items"
  ON public.items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage items"
  ON public.items
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Add item requests table
CREATE TABLE IF NOT EXISTS public.item_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER DEFAULT 1 NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.item_requests ENABLE ROW LEVEL SECURITY;

-- Policies for item_requests
CREATE POLICY "Users can view their own requests"
  ON public.item_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all requests"
  ON public.item_requests
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Users can create requests if active"
  ON public.item_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.clan_users
      WHERE id = auth.uid()
        AND is_active = TRUE
        AND ign IS NOT NULL
    )
  );

CREATE POLICY "Admins can update request status"
  ON public.item_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Function to automatically create clan_users entry on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clan_users (id, ign, is_active)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    TRUE
  );
  RETURN NEW;
END;
$$;

-- Trigger for new auth users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
