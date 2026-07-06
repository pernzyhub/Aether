-- Add optional event_code to events for short-code lookup and CSV import/export support
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_code TEXT;

-- Ensure event codes are unique when set (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS events_event_code_unique_idx
  ON public.events (LOWER(event_code))
  WHERE event_code IS NOT NULL;
