-- Create table to track Apple OAuth key rotation history
CREATE TABLE public.apple_key_rotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rotated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  triggered_by TEXT NOT NULL DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'cron'))
);

-- Enable RLS (but allow public read for dashboard - no sensitive data)
ALTER TABLE public.apple_key_rotations ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read rotation history (no sensitive data stored)
CREATE POLICY "Anyone can view rotation history" 
ON public.apple_key_rotations 
FOR SELECT 
USING (true);

-- Only service role can insert (from edge function)
CREATE POLICY "Service role can insert rotations" 
ON public.apple_key_rotations 
FOR INSERT 
WITH CHECK (true);