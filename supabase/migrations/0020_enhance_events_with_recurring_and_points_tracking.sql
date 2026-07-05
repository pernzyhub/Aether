-- Create event_types table for event categories
CREATE TABLE IF NOT EXISTS public.event_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  default_points INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#ff6688',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns to events table for recurring schedule
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS event_type_id UUID REFERENCES public.event_types(id),
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR(50) DEFAULT NULL, -- 'weekly', 'biweekly', 'monthly', 'daily'
ADD COLUMN IF NOT EXISTS recurrence_days TEXT DEFAULT NULL, -- JSON array of days [0-6] for weekly (0=Sunday)
ADD COLUMN IF NOT EXISTS recurrence_time TIME DEFAULT NULL, -- Time of day for recurring events
ADD COLUMN IF NOT EXISTS month_year VARCHAR(7) DEFAULT NULL; -- 'YYYY-MM' for monthly tracking

-- Create monthly_points_summary table for tracking monthly points
CREATE TABLE IF NOT EXISTS public.monthly_points_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.clan_users(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  total_points INTEGER DEFAULT 0,
  events_attended INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

-- Add month_year and attendance_date to attendance for monthly tracking and date-specific logs
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS month_year VARCHAR(7) DEFAULT NULL; -- 'YYYY-MM'

ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS attendance_date TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Update existing attendance records to have month_year
UPDATE public.attendance
SET month_year = TO_CHAR(created_at, 'YYYY-MM')
WHERE month_year IS NULL;

-- Enable RLS on new tables
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_points_summary ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for new tables if they exist
DROP POLICY IF EXISTS "Admins can view all event_types" ON public.event_types;
DROP POLICY IF EXISTS "Members can view active event_types" ON public.event_types;
DROP POLICY IF EXISTS "Admins can manage event_types" ON public.event_types;
DROP POLICY IF EXISTS "Admins can view all monthly_points_summary" ON public.monthly_points_summary;
DROP POLICY IF EXISTS "Members can view their own monthly_points" ON public.monthly_points_summary;

-- Policies for event_types
CREATE POLICY "Members can view active event_types" ON public.event_types
  FOR SELECT USING (is_active);

CREATE POLICY "Admins can manage event_types" ON public.event_types
  FOR ALL USING (public.is_admin());

-- Policies for monthly_points_summary
CREATE POLICY "Admins can view all monthly_points" ON public.monthly_points_summary
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Members can view their own monthly_points" ON public.monthly_points_summary
  FOR SELECT USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_event_types_updated_at BEFORE UPDATE ON public.event_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_points_summary_updated_at BEFORE UPDATE ON public.monthly_points_summary
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update monthly points summary
CREATE OR REPLACE FUNCTION public.update_monthly_points_summary()
RETURNS TRIGGER AS $$
DECLARE
  v_month_year VARCHAR(7);
BEGIN
  IF NEW.attended AND NEW.points_awarded > 0 THEN
    v_month_year := COALESCE(NEW.month_year, TO_CHAR(NOW(), 'YYYY-MM'));
    
    INSERT INTO public.monthly_points_summary (user_id, month_year, total_points, events_attended)
    VALUES (NEW.user_id, v_month_year, NEW.points_awarded, 1)
    ON CONFLICT (user_id, month_year) DO UPDATE SET
      total_points = monthly_points_summary.total_points + NEW.points_awarded,
      events_attended = monthly_points_summary.events_attended + 1,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for attendance to update monthly points
CREATE TRIGGER update_monthly_points_on_attendance AFTER INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_monthly_points_summary();

-- Insert default event types
INSERT INTO public.event_types (name, description, default_points, color)
VALUES
  ('Guild Meeting', 'Weekly guild meetings', 10, '#ff6688'),
  ('Raid', 'Guild raids and dungeons', 25, '#ffaa00'),
  ('Activity', 'Guild activities and events', 15, '#00ff88'),
  ('Quest', 'Group quests', 20, '#0088ff')
ON CONFLICT DO NOTHING;
