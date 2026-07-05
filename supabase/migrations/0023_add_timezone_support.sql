-- Add timezone support for event scheduling across different regions

-- Add timezone column to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

-- Add timezone column to clan_users for member preferences
ALTER TABLE public.clan_users
ADD COLUMN IF NOT EXISTS preferred_timezone VARCHAR(50) DEFAULT 'UTC';

-- Create a function to convert times between timezones
CREATE OR REPLACE FUNCTION public.convert_time_to_timezone(
  event_time TIME,
  from_tz VARCHAR,
  to_tz VARCHAR
)
RETURNS TIME AS $$
DECLARE
  v_temp_ts TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Create a temporary timestamp in the source timezone and convert
  v_temp_ts := (NOW()::DATE || ' ' || event_time::TEXT)::TIMESTAMP AT TIME ZONE from_tz;
  RETURN (v_temp_ts AT TIME ZONE to_tz)::TIME;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to get next event occurrence in a specific timezone
CREATE OR REPLACE FUNCTION public.get_next_event_occurrence_in_tz(
  event_id UUID,
  target_tz VARCHAR
)
RETURNS RECORD AS $$
DECLARE
  v_event RECORD;
  v_next_occurrence TIMESTAMP WITH TIME ZONE;
  v_event_date DATE;
  v_event_time TIME;
  v_recurrence_days INTEGER[];
  v_days_ahead INTEGER;
  v_today DATE;
  i INTEGER;
BEGIN
  -- Fetch event details
  SELECT * INTO v_event FROM public.events WHERE id = event_id;
  
  IF v_event IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get today's date in the target timezone
  v_today := (NOW() AT TIME ZONE target_tz)::DATE;
  v_event_date := v_today;
  
  -- If it's a recurring event
  IF v_event.is_recurring AND v_event.recurrence_days IS NOT NULL THEN
    v_recurrence_days := (v_event.recurrence_days::TEXT::INTEGER[]);
    
    -- Find the next occurrence
    FOR i IN 1..7 LOOP
      IF (EXTRACT(DOW FROM v_event_date))::INTEGER = ANY(v_recurrence_days) THEN
        v_event_time := v_event.recurrence_time;
        v_next_occurrence := (v_event_date || ' ' || v_event_time::TEXT)::TIMESTAMP AT TIME ZONE target_tz;
        
        -- If this time has passed today, use it if it's in the future
        IF v_next_occurrence > (NOW() AT TIME ZONE target_tz) THEN
          RETURN ROW(v_next_occurrence, v_event_date, v_event_time);
        END IF;
      END IF;
      
      v_event_date := v_event_date + INTERVAL '1 day';
    END LOOP;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create index for timezone lookups
CREATE INDEX IF NOT EXISTS idx_events_timezone ON public.events(timezone);
CREATE INDEX IF NOT EXISTS idx_clan_users_timezone ON public.clan_users(preferred_timezone);

-- Add comment documentation
COMMENT ON COLUMN public.events.timezone IS 'Timezone for the event (e.g., UTC, America/New_York, Europe/London, Asia/Tokyo). Used for recurring event scheduling and member notifications.';
COMMENT ON COLUMN public.clan_users.preferred_timezone IS 'Member preferred timezone for receiving event times and reminders.';
COMMENT ON FUNCTION public.convert_time_to_timezone(TIME, VARCHAR, VARCHAR) IS 'Converts a time value from one timezone to another.';
COMMENT ON FUNCTION public.get_next_event_occurrence_in_tz(UUID, VARCHAR) IS 'Calculates the next occurrence of an event in a specific timezone, accounting for recurring schedules.';
