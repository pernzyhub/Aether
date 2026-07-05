-- Fix RLS policies to allow members to view active events and manage attendance

-- Drop all existing policies for events table
DO $$
BEGIN
  DROP POLICY IF EXISTS "Members can view active events" ON public.events;
  DROP POLICY IF EXISTS "Admins can view all events" ON public.events;
  DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
  DROP POLICY IF EXISTS "Admins can update events" ON public.events;
  DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Drop all existing policies for attendance table
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
  DROP POLICY IF EXISTS "Members can view their own attendance" ON public.attendance;
  DROP POLICY IF EXISTS "Members can view active events attendance" ON public.attendance;
  DROP POLICY IF EXISTS "Admins can insert attendance" ON public.attendance;
  DROP POLICY IF EXISTS "Members can manage their own attendance" ON public.attendance;
  DROP POLICY IF EXISTS "Members can update their own attendance" ON public.attendance;
  DROP POLICY IF EXISTS "Members can delete their own attendance" ON public.attendance;
  DROP POLICY IF EXISTS "Admins can update attendance" ON public.attendance;
  DROP POLICY IF EXISTS "Admins can delete attendance" ON public.attendance;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- New events policies: members can view active events, admins can manage all
CREATE POLICY "Members can view active events" ON public.events
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can view all events" ON public.events
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert events" ON public.events
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update events" ON public.events
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete events" ON public.events
  FOR DELETE USING (public.is_admin());

-- New attendance policies: members manage their own, admins manage all
-- All authenticated users (including anonymous) can view attendance for active events
CREATE POLICY "View attendance for active events" ON public.attendance
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = attendance.event_id AND events.is_active = true
    )
  );

CREATE POLICY "Admins can view all attendance" ON public.attendance
  FOR SELECT USING (public.is_admin());

-- Members can insert their own attendance records
CREATE POLICY "Authenticated users can create own attendance" ON public.attendance
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND (attended = false OR attended IS NULL)
  );

-- Members can update their own attendance records (if not marked by admin)
CREATE POLICY "Authenticated users can update own attendance" ON public.attendance
  FOR UPDATE USING (auth.uid() = user_id);

-- Members can delete their own attendance records (if not marked by admin)
CREATE POLICY "Authenticated users can delete own attendance" ON public.attendance
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can insert attendance for anyone
CREATE POLICY "Admins can insert attendance" ON public.attendance
  FOR INSERT WITH CHECK (public.is_admin());

-- Admins can update attendance for anyone
CREATE POLICY "Admins can update attendance" ON public.attendance
  FOR UPDATE USING (public.is_admin());

-- Admins can delete attendance records
CREATE POLICY "Admins can delete attendance" ON public.attendance
  FOR DELETE USING (public.is_admin());
