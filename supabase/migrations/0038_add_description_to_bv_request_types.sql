-- Add description column to bv_request_types
ALTER TABLE IF EXISTS bv_request_types
  ADD COLUMN IF NOT EXISTS description text DEFAULT '';
