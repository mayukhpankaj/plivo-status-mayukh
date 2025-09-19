-- Migration: Create user profiles table
-- Description: Creates user_profiles table for additional user data from Clerk
-- Date: 2025-09-19

-- User profiles table (optional - for additional user data beyond Clerk)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_user_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT user_profiles_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create trigger for updated_at
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_user_profiles_clerk_user_id ON user_profiles(clerk_user_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_created_at ON user_profiles(created_at);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (
        clerk_user_id = current_setting('app.current_user_id', true)
    );

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (
        clerk_user_id = current_setting('app.current_user_id', true)
    );

CREATE POLICY "System can insert user profiles" ON user_profiles
    FOR INSERT WITH CHECK (true); -- Allow system/webhook inserts

CREATE POLICY "System can delete user profiles" ON user_profiles
    FOR DELETE USING (true); -- Allow system/webhook deletes

-- Comments for documentation
COMMENT ON TABLE user_profiles IS 'Additional user profile data synced from Clerk';
COMMENT ON COLUMN user_profiles.clerk_user_id IS 'Clerk user ID (primary identifier)';
COMMENT ON COLUMN user_profiles.email IS 'Primary email address from Clerk';
COMMENT ON COLUMN user_profiles.image_url IS 'Profile image URL from Clerk';
