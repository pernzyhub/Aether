-- Create table for configurable BV request dropdown types
CREATE TABLE IF NOT EXISTS bv_request_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Optional: seed some defaults if table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bv_request_types) THEN
    INSERT INTO bv_request_types (key, label, sort_order) VALUES
      ('standard','Standard', 10),
      ('event','Event', 20),
      ('other','Other', 30);
  END IF;
END$$;
