-- Add a tracked requested quantity so member request summaries can show original vs remaining counts
ALTER TABLE public.item_requests
ADD COLUMN IF NOT EXISTS requested_quantity INTEGER;

UPDATE public.item_requests
SET requested_quantity = quantity
WHERE requested_quantity IS NULL;
