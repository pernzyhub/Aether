-- Add proof_image column to item_requests for optional proof images
ALTER TABLE public.item_requests ADD COLUMN IF NOT EXISTS proof_image TEXT;
