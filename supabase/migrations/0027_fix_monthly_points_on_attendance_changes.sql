-- Fix monthly points summary so it updates when attendance records are changed or deleted

CREATE OR REPLACE FUNCTION public.adjust_monthly_points_summary()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_monthly_points_on_attendance ON public.attendance;
DROP TRIGGER IF EXISTS update_monthly_points_on_attendance_insert ON public.attendance;
DROP TRIGGER IF EXISTS update_monthly_points_on_attendance_update ON public.attendance;
DROP TRIGGER IF EXISTS update_monthly_points_on_attendance_delete ON public.attendance;

CREATE TRIGGER update_monthly_points_on_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.adjust_monthly_points_summary();
