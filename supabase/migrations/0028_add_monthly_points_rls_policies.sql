-- Add RLS policies so monthly_points_summary can be modified by triggers and users

-- Ensure RLS is enabled (already enabled in migration 0020 but safe to include)
ALTER TABLE public.monthly_points_summary ENABLE ROW LEVEL SECURITY;

-- Remove any existing policies that might block writes
DROP POLICY IF EXISTS "Admins can manage monthly_points" ON public.monthly_points_summary;
DROP POLICY IF EXISTS "Members can manage their monthly_points" ON public.monthly_points_summary;

-- Allow admins to do anything
CREATE POLICY "Admins can manage monthly_points" ON public.monthly_points_summary
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Allow members to insert their own monthly summary rows (trigger runs under the member's context)
CREATE POLICY "Members can insert their monthly_points" ON public.monthly_points_summary
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Allow members to update their own monthly summary
CREATE POLICY "Members can update their monthly_points" ON public.monthly_points_summary
  FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Allow members to delete their own monthly summary (rare)
CREATE POLICY "Members can delete their monthly_points" ON public.monthly_points_summary
  FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- Keep existing select policies (do not remove)
