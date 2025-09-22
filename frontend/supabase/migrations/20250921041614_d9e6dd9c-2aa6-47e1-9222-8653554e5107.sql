-- Fix the search path for the generate_service_id function
CREATE OR REPLACE FUNCTION public.generate_service_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'service-' || gen_random_uuid()::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;