-- Migration: Connect user_profiles table to other tables
-- Description: Add foreign key relationships and update existing tables to reference user_profiles
-- Date: 2025-09-19

-- First, let's update the organizations table to reference user_profiles
-- Add a foreign key constraint to organizations.owner_id -> user_profiles.clerk_user_id
ALTER TABLE organizations 
ADD CONSTRAINT fk_organizations_owner 
FOREIGN KEY (owner_id) REFERENCES user_profiles(clerk_user_id) ON DELETE CASCADE;

-- Update team_members table to reference user_profiles
-- Add a foreign key constraint to team_members.user_id -> user_profiles.clerk_user_id
ALTER TABLE team_members 
ADD CONSTRAINT fk_team_members_user 
FOREIGN KEY (user_id) REFERENCES user_profiles(clerk_user_id) ON DELETE CASCADE;

-- Update incident_updates table to reference user_profiles
-- Add a foreign key constraint to incident_updates.author_id -> user_profiles.clerk_user_id
ALTER TABLE incident_updates 
ADD CONSTRAINT fk_incident_updates_author 
FOREIGN KEY (author_id) REFERENCES user_profiles(clerk_user_id) ON DELETE SET NULL;

-- Create an audit_logs table that references user_profiles (if it doesn't exist)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) REFERENCES user_profiles(clerk_user_id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_team_id ON audit_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Add indexes to improve foreign key performance
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_incident_updates_author_id ON incident_updates(author_id);

-- Create a view to easily get user information with their organizations and teams
CREATE OR REPLACE VIEW user_organization_summary AS
SELECT 
    up.clerk_user_id,
    up.email,
    up.first_name,
    up.last_name,
    up.image_url,
    up.created_at as user_created_at,
    o.id as organization_id,
    o.name as organization_name,
    o.slug as organization_slug,
    o.owner_id = up.clerk_user_id as is_organization_owner,
    t.id as team_id,
    t.name as team_name,
    t.slug as team_slug,
    tm.role as team_role
FROM user_profiles up
LEFT JOIN organizations o ON o.owner_id = up.clerk_user_id
LEFT JOIN team_members tm ON tm.user_id = up.clerk_user_id
LEFT JOIN teams t ON t.id = tm.team_id;

-- Comments for documentation
COMMENT ON TABLE audit_logs IS 'Audit trail for user actions across the system';
COMMENT ON VIEW user_organization_summary IS 'Comprehensive view of users with their organizations and team memberships';

-- Add comments to the new foreign key constraints
COMMENT ON CONSTRAINT fk_organizations_owner ON organizations IS 'Links organization owner to user profile';
COMMENT ON CONSTRAINT fk_team_members_user ON team_members IS 'Links team member to user profile';
COMMENT ON CONSTRAINT fk_incident_updates_author ON incident_updates IS 'Links incident update author to user profile';
