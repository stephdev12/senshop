-- Add policy for admin_logs (admin operations only via service role)
-- This is a restrictive policy - no public access
CREATE POLICY "No public access to admin logs" ON public.admin_logs
  FOR SELECT USING (false);