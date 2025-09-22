-- SQL script to fix the RLS policy issue for organizations
-- Run this in the Supabase SQL Editor

-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;

-- Create a more permissive SELECT policy that allows authenticated users to view organizations
-- This is safe because organization names and IDs are not sensitive data
CREATE POLICY "Authenticated users can view organizations" 
ON public.organizations 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Verify the policies are correct
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'organizations';
