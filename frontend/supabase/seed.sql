-- Insert organization with the correct ID
INSERT INTO public.organizations (id, name, org_id, created_at, updated_at)
VALUES (
  'a4e7b716-4490-423e-b27c-769c8f53846d',
  'mayukh',
  'org-29646898-d55c-436b-91db-62749dd2320c',
  now(),
  now()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  org_id = EXCLUDED.org_id,
  updated_at = now();

-- Insert a test user in auth.users (this would normally be handled by Supabase Auth)
-- Note: This is for testing purposes only
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  '12345678-1234-1234-1234-123456789012',
  'test@example.com',
  '$2a$10$dummy.encrypted.password.hash.for.testing.purposes.only',
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false,
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Insert a profile that links the test user to the organization
INSERT INTO public.profiles (
  user_id,
  organization_id,
  first_name,
  last_name,
  email,
  created_at,
  updated_at
) VALUES (
  '12345678-1234-1234-1234-123456789012',
  'a4e7b716-4490-423e-b27c-769c8f53846d',
  'Test',
  'User',
  'test@example.com',
  now(),
  now()
) ON CONFLICT (user_id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  updated_at = now();
