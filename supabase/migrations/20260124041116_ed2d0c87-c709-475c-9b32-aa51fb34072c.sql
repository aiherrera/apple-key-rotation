-- Drop the permissive insert policy and create a more restrictive one
DROP POLICY IF EXISTS "Service role can insert rotations" ON public.apple_key_rotations;

-- Create a policy that only allows inserts from authenticated service role
-- This uses false for normal users - only service_role bypasses RLS
CREATE POLICY "Only service role can insert rotations" 
ON public.apple_key_rotations 
FOR INSERT 
WITH CHECK (false);