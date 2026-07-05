-- Diagnostic queries for attendance issues
-- Run these in Supabase SQL editor as a project owner/admin.

-- 1) Show top users by attendance row count (detect overwritten rows)
SELECT user_id, COUNT(*) AS cnt
FROM public.attendance
GROUP BY user_id
ORDER BY cnt DESC
LIMIT 50;

-- 2) Show unique constraints / indexes on attendance
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'attendance';

-- 3) Show table constraints for attendance
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.attendance'::regclass;

-- 4) Sample recent attendance rows (inspect dates)
SELECT id, user_id, event_id, attended, points_awarded, attendance_date, created_at, month_year
FROM public.attendance
ORDER BY created_at DESC
LIMIT 200;

-- ------------------------------------------------------------
-- Migration: make attendance unique per (event_id, user_id, attendance_date)
-- Run only if you are project owner/admin and after reviewing diagnostics.
-- This migration also creates a trigger to maintain monthly_points_summary
-- and backfills missing attendance_date values.
-- ------------------------------------------------------------

BEGIN;

-- Enable RLS on monthly_points_summary and add safe policies (adjust public.is_admin() as needed)
ALTER TABLE public.monthly_points_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage monthly_points" ON public.monthly_points_summary;
DROP POLICY IF EXISTS "Members can insert their monthly_points" ON public.monthly_points_summary;
DROP POLICY IF EXISTS "Members can update their monthly_points" ON public.monthly_points_summary;
DROP POLICY IF EXISTS "Members can delete their monthly_points" ON public.monthly_points_summary;

CREATE POLICY "Admins can manage monthly_points" ON public.monthly_points_summary
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Members can insert their monthly_points" ON public.monthly_points_summary
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Members can update their monthly_points" ON public.monthly_points_summary
  FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Members can delete their monthly_points" ON public.monthly_points_summary
  FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- Adjust unique constraint on attendance to include attendance_date
ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_event_id_user_id_key;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_event_id_user_id_attendance_date_key UNIQUE (event_id, user_id, attendance_date);

-- Create trigger to adjust monthly_points_summary on attendance changes
CREATE OR REPLACE FUNCTION public.adjust_monthly_points_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_month_year VARCHAR(7);
  new_month_year VARCHAR(7);
  old_points INTEGER;
  new_points INTEGER;
  old_attended BOOLEAN;
  new_attended BOOLEAN;
BEGIN
  old_month_year := COALESCE(OLD.month_year, TO_CHAR(COALESCE(OLD.attendance_date, OLD.created_at, NOW()), 'YYYY-MM'));
  new_month_year := COALESCE(NEW.month_year, TO_CHAR(COALESCE(NEW.attendance_date, NEW.created_at, NOW()), 'YYYY-MM'));
  old_points := COALESCE(OLD.points_awarded, 0);
  new_points := COALESCE(NEW.points_awarded, 0);
  old_attended := COALESCE(OLD.attended, false);
  new_attended := COALESCE(NEW.attended, false);

  IF TG_OP = 'INSERT' THEN
    IF new_attended AND new_points > 0 THEN
      INSERT INTO public.monthly_points_summary (user_id, month_year, total_points, events_attended)
      VALUES (NEW.user_id, new_month_year, new_points, 1)
      ON CONFLICT (user_id, month_year) DO UPDATE SET
        total_points = monthly_points_summary.total_points + EXCLUDED.total_points,
        events_attended = monthly_points_summary.events_attended + EXCLUDED.events_attended,
        updated_at = NOW();
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF old_attended AND old_points > 0 THEN
      UPDATE public.monthly_points_summary
      SET total_points = total_points - old_points,
          events_attended = events_attended - 1,
          updated_at = NOW()
      WHERE user_id = OLD.user_id
        AND month_year = old_month_year;

      DELETE FROM public.monthly_points_summary
      WHERE total_points <= 0 OR events_attended <= 0;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF old_attended AND old_points > 0 THEN
      UPDATE public.monthly_points_summary
      SET total_points = total_points - old_points,
          events_attended = events_attended - 1,
          updated_at = NOW()
      WHERE user_id = OLD.user_id
        AND month_year = old_month_year;

      DELETE FROM public.monthly_points_summary
      WHERE total_points <= 0 OR events_attended <= 0;
    END IF;

    IF new_attended AND new_points > 0 THEN
      INSERT INTO public.monthly_points_summary (user_id, month_year, total_points, events_attended)
      VALUES (NEW.user_id, new_month_year, new_points, 1)
      ON CONFLICT (user_id, month_year) DO UPDATE SET
        total_points = monthly_points_summary.total_points + EXCLUDED.total_points,
        events_attended = monthly_points_summary.events_attended + EXCLUDED.events_attended,
        updated_at = NOW();
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS update_monthly_points_on_attendance ON public.attendance;
CREATE TRIGGER update_monthly_points_on_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.adjust_monthly_points_summary();

-- Backfill attendance_date where missing
UPDATE public.attendance
SET attendance_date = created_at
WHERE attendance_date IS NULL;

-- Rebuild monthly_points_summary
TRUNCATE public.monthly_points_summary;

INSERT INTO public.monthly_points_summary (user_id, month_year, total_points, events_attended, created_at, updated_at)
SELECT
  user_id,
  COALESCE(month_year, TO_CHAR(COALESCE(attendance_date, created_at), 'YYYY-MM')) AS month_year,
  COALESCE(SUM(points_awarded), 0) AS total_points,
  COUNT(*) FILTER (WHERE attended = TRUE) AS events_attended,
  NOW(),
  NOW()
FROM public.attendance
WHERE attended = TRUE
GROUP BY user_id, COALESCE(month_year, TO_CHAR(COALESCE(attendance_date, created_at), 'YYYY-MM'));

COMMIT;

-- END OF MIGRATION
