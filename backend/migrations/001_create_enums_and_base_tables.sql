-- Migration: Create enums and base tables
-- Description: Creates status enums, organizations, teams, and team_members tables
-- Date: 2025-09-19

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums for status types
CREATE TYPE service_status AS ENUM (
    'operational',
    'degraded', 
    'partial_outage',
    'major_outage'
);

CREATE TYPE incident_status AS ENUM (
    'investigating',
    'identified',
    'monitoring',
    'resolved'
);

CREATE TYPE incident_severity AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

CREATE TYPE maintenance_status AS ENUM (
    'scheduled',
    'in_progress',
    'completed',
    'cancelled'
);

CREATE TYPE team_member_role AS ENUM (
    'owner',
    'admin',
    'member',
    'viewer'
);

-- Organizations table (top-level tenant)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_id VARCHAR(255) NOT NULL, -- Clerk user ID
    
    -- Constraints
    CONSTRAINT organizations_name_length CHECK (LENGTH(name) >= 1),
    CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT organizations_slug_length CHECK (LENGTH(slug) >= 3 AND LENGTH(slug) <= 100)
);

-- Teams table (sub-organizations)
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT teams_name_length CHECK (LENGTH(name) >= 1),
    CONSTRAINT teams_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT teams_slug_length CHECK (LENGTH(slug) >= 3 AND LENGTH(slug) <= 100),
    CONSTRAINT teams_unique_slug_per_org UNIQUE (organization_id, slug)
);

-- Team members table (users assigned to teams)
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL, -- Clerk user ID
    role team_member_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT team_members_unique_user_per_team UNIQUE (team_id, user_id)
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_organizations_updated_at 
    BEFORE UPDATE ON organizations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at 
    BEFORE UPDATE ON teams 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE organizations IS 'Top-level tenant organizations';
COMMENT ON TABLE teams IS 'Sub-organizations within an organization';
COMMENT ON TABLE team_members IS 'Users assigned to teams with specific roles';

COMMENT ON COLUMN organizations.owner_id IS 'Clerk user ID of the organization owner';
COMMENT ON COLUMN organizations.slug IS 'URL-friendly unique identifier for the organization';
COMMENT ON COLUMN teams.slug IS 'URL-friendly identifier for the team (unique within organization)';
COMMENT ON COLUMN team_members.user_id IS 'Clerk user ID of the team member';
