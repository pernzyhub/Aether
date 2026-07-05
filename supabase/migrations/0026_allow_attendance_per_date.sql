-- Allow multiple attendance records for the same event/user on different dates
ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_event_id_user_id_key;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_event_id_user_id_attendance_date_key UNIQUE (event_id, user_id, attendance_date);
