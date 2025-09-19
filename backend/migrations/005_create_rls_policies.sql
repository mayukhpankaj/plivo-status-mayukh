-- Migration: Create Row Level Security policies
-- Description: Creates RLS policies for multi-tenant data isolation
-- Date: 2025-09-19

-- Enable Row Level Security on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenances ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's organization IDs
CREATE OR REPLACE FUNCTION get_user_organization_ids(user_clerk_id TEXT)
RETURNS UUID[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT DISTINCT o.id
        FROM organizations o
        LEFT JOIN teams t ON t.organization_id = o.id
        LEFT JOIN team_members tm ON tm.team_id = t.id
        WHERE o.owner_id = user_clerk_id OR tm.user_id = user_clerk_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's team IDs
CREATE OR REPLACE FUNCTION get_user_team_ids(user_clerk_id TEXT)
RETURNS UUID[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT tm.team_id
        FROM team_members tm
        WHERE tm.user_id = user_clerk_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is organization owner
CREATE OR REPLACE FUNCTION is_organization_owner(user_clerk_id TEXT, org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 FROM organizations 
        WHERE id = org_id AND owner_id = user_clerk_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has team access with minimum role
CREATE OR REPLACE FUNCTION has_team_access(user_clerk_id TEXT, team_uuid UUID, min_role team_member_role DEFAULT 'viewer')
RETURNS BOOLEAN AS $$
DECLARE
    user_role team_member_role;
    role_hierarchy INTEGER;
    min_role_hierarchy INTEGER;
BEGIN
    -- Check if user is organization owner first
    IF EXISTS(
        SELECT 1 FROM teams t 
        JOIN organizations o ON t.organization_id = o.id 
        WHERE t.id = team_uuid AND o.owner_id = user_clerk_id
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Get user's role in the team
    SELECT role INTO user_role
    FROM team_members 
    WHERE team_id = team_uuid AND user_id = user_clerk_id;
    
    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Define role hierarchy (higher number = more permissions)
    role_hierarchy := CASE user_role
        WHEN 'viewer' THEN 1
        WHEN 'member' THEN 2
        WHEN 'admin' THEN 3
        WHEN 'owner' THEN 4
    END;
    
    min_role_hierarchy := CASE min_role
        WHEN 'viewer' THEN 1
        WHEN 'member' THEN 2
        WHEN 'admin' THEN 3
        WHEN 'owner' THEN 4
    END;
    
    RETURN role_hierarchy >= min_role_hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations RLS Policies
CREATE POLICY "Users can view organizations they own or are members of" ON organizations
    FOR SELECT USING (
        owner_id = current_setting('app.current_user_id', true) OR
        id = ANY(get_user_organization_ids(current_setting('app.current_user_id', true)))
    );

CREATE POLICY "Users can create organizations" ON organizations
    FOR INSERT WITH CHECK (
        owner_id = current_setting('app.current_user_id', true)
    );

CREATE POLICY "Organization owners can update their organizations" ON organizations
    FOR UPDATE USING (
        owner_id = current_setting('app.current_user_id', true)
    );

CREATE POLICY "Organization owners can delete their organizations" ON organizations
    FOR DELETE USING (
        owner_id = current_setting('app.current_user_id', true)
    );

-- Teams RLS Policies
CREATE POLICY "Users can view teams in their organizations" ON teams
    FOR SELECT USING (
        organization_id = ANY(get_user_organization_ids(current_setting('app.current_user_id', true)))
    );

CREATE POLICY "Organization owners and team admins can create teams" ON teams
    FOR INSERT WITH CHECK (
        is_organization_owner(current_setting('app.current_user_id', true), organization_id)
    );

CREATE POLICY "Organization owners and team admins can update teams" ON teams
    FOR UPDATE USING (
        is_organization_owner(current_setting('app.current_user_id', true), organization_id) OR
        has_team_access(current_setting('app.current_user_id', true), id, 'admin')
    );

CREATE POLICY "Organization owners can delete teams" ON teams
    FOR DELETE USING (
        is_organization_owner(current_setting('app.current_user_id', true), organization_id)
    );

-- Team Members RLS Policies
CREATE POLICY "Users can view team members in their teams" ON team_members
    FOR SELECT USING (
        team_id = ANY(get_user_team_ids(current_setting('app.current_user_id', true))) OR
        EXISTS(
            SELECT 1 FROM teams t 
            WHERE t.id = team_id AND 
            is_organization_owner(current_setting('app.current_user_id', true), t.organization_id)
        )
    );

CREATE POLICY "Team admins and organization owners can add team members" ON team_members
    FOR INSERT WITH CHECK (
        has_team_access(current_setting('app.current_user_id', true), team_id, 'admin') OR
        EXISTS(
            SELECT 1 FROM teams t 
            WHERE t.id = team_id AND 
            is_organization_owner(current_setting('app.current_user_id', true), t.organization_id)
        )
    );

CREATE POLICY "Team admins and organization owners can update team members" ON team_members
    FOR UPDATE USING (
        has_team_access(current_setting('app.current_user_id', true), team_id, 'admin') OR
        EXISTS(
            SELECT 1 FROM teams t 
            WHERE t.id = team_id AND 
            is_organization_owner(current_setting('app.current_user_id', true), t.organization_id)
        )
    );

CREATE POLICY "Team admins and organization owners can remove team members" ON team_members
    FOR DELETE USING (
        has_team_access(current_setting('app.current_user_id', true), team_id, 'admin') OR
        EXISTS(
            SELECT 1 FROM teams t 
            WHERE t.id = team_id AND 
            is_organization_owner(current_setting('app.current_user_id', true), t.organization_id)
        )
    );

-- Services RLS Policies
CREATE POLICY "Users can view services in their teams" ON services
    FOR SELECT USING (
        team_id = ANY(get_user_team_ids(current_setting('app.current_user_id', true))) OR
        EXISTS(
            SELECT 1 FROM teams t 
            WHERE t.id = team_id AND 
            is_organization_owner(current_setting('app.current_user_id', true), t.organization_id)
        )
    );

CREATE POLICY "Team members can create services" ON services
    FOR INSERT WITH CHECK (
        has_team_access(current_setting('app.current_user_id', true), team_id, 'member')
    );

CREATE POLICY "Team members can update services" ON services
    FOR UPDATE USING (
        has_team_access(current_setting('app.current_user_id', true), team_id, 'member')
    );

CREATE POLICY "Team admins can delete services" ON services
    FOR DELETE USING (
        has_team_access(current_setting('app.current_user_id', true), team_id, 'admin')
    );

-- Incidents RLS Policies
CREATE POLICY "Users can view incidents for services in their teams" ON incidents
    FOR SELECT USING (
        EXISTS(
            SELECT 1 FROM services s
            WHERE s.id = service_id AND (
                s.team_id = ANY(get_user_team_ids(current_setting('app.current_user_id', true))) OR
                EXISTS(
                    SELECT 1 FROM teams t
                    WHERE t.id = s.team_id AND
                    is_organization_owner(current_setting('app.current_user_id', true), t.organization_id)
                )
            )
        )
    );

CREATE POLICY "Team members can create incidents" ON incidents
    FOR INSERT WITH CHECK (
        EXISTS(
            SELECT 1 FROM services s
            WHERE s.id = service_id AND
            has_team_access(current_setting('app.current_user_id', true), s.team_id, 'member')
        )
    );

CREATE POLICY "Team members can update incidents" ON incidents
    FOR UPDATE USING (
        EXISTS(
            SELECT 1 FROM services s
            WHERE s.id = service_id AND
            has_team_access(current_setting('app.current_user_id', true), s.team_id, 'member')
        )
    );

CREATE POLICY "Team admins can delete incidents" ON incidents
    FOR DELETE USING (
        EXISTS(
            SELECT 1 FROM services s
            WHERE s.id = service_id AND
            has_team_access(current_setting('app.current_user_id', true), s.team_id, 'admin')
        )
    );

-- Incident Updates RLS Policies
CREATE POLICY "Users can view incident updates for incidents in their teams" ON incident_updates
    FOR SELECT USING (
        EXISTS(
            SELECT 1 FROM incidents i
            JOIN services s ON i.service_id = s.id
            WHERE i.id = incident_id AND (
                s.team_id = ANY(get_user_team_ids(current_setting('app.current_user_id', true))) OR
                EXISTS(
                    SELECT 1 FROM teams t
                    WHERE t.id = s.team_id AND
                    is_organization_owner(current_setting('app.current_user_id', true), t.organization_id)
                )
            )
        )
    );

CREATE POLICY "Team members can create incident updates" ON incident_updates
    FOR INSERT WITH CHECK (
        author_id = current_setting('app.current_user_id', true) AND
        EXISTS(
            SELECT 1 FROM incidents i
            JOIN services s ON i.service_id = s.id
            WHERE i.id = incident_id AND
            has_team_access(current_setting('app.current_user_id', true), s.team_id, 'member')
        )
    );

CREATE POLICY "Authors and team admins can update incident updates" ON incident_updates
    FOR UPDATE USING (
        author_id = current_setting('app.current_user_id', true) OR
        EXISTS(
            SELECT 1 FROM incidents i
            JOIN services s ON i.service_id = s.id
            WHERE i.id = incident_id AND
            has_team_access(current_setting('app.current_user_id', true), s.team_id, 'admin')
        )
    );

CREATE POLICY "Authors and team admins can delete incident updates" ON incident_updates
    FOR DELETE USING (
        author_id = current_setting('app.current_user_id', true) OR
        EXISTS(
            SELECT 1 FROM incidents i
            JOIN services s ON i.service_id = s.id
            WHERE i.id = incident_id AND
            has_team_access(current_setting('app.current_user_id', true), s.team_id, 'admin')
        )
    );

-- Maintenances RLS Policies
CREATE POLICY "Users can view maintenances for services in their teams" ON maintenances
    FOR SELECT USING (
        EXISTS(
            SELECT 1 FROM services s
            WHERE s.id = service_id AND (
                s.team_id = ANY(get_user_team_ids(current_setting('app.current_user_id', true))) OR
                EXISTS(
                    SELECT 1 FROM teams t
                    WHERE t.id = s.team_id AND
                    is_organization_owner(current_setting('app.current_user_id', true), t.organization_id)
                )
            )
        )
    );

CREATE POLICY "Team members can create maintenances" ON maintenances
    FOR INSERT WITH CHECK (
        created_by = current_setting('app.current_user_id', true) AND
        EXISTS(
            SELECT 1 FROM services s
            WHERE s.id = service_id AND
            has_team_access(current_setting('app.current_user_id', true), s.team_id, 'member')
        )
    );

CREATE POLICY "Team members can update maintenances" ON maintenances
    FOR UPDATE USING (
        EXISTS(
            SELECT 1 FROM services s
            WHERE s.id = service_id AND
            has_team_access(current_setting('app.current_user_id', true), s.team_id, 'member')
        )
    );

CREATE POLICY "Team admins can delete maintenances" ON maintenances
    FOR DELETE USING (
        EXISTS(
            SELECT 1 FROM services s
            WHERE s.id = service_id AND
            has_team_access(current_setting('app.current_user_id', true), s.team_id, 'admin')
        )
    );

-- Grant necessary permissions to authenticated users
-- Note: In Supabase, you would typically use the 'authenticated' role
-- For this example, we'll assume a custom role setup

-- Comments for documentation
COMMENT ON FUNCTION get_user_organization_ids IS 'Helper function to get all organization IDs a user has access to';
COMMENT ON FUNCTION get_user_team_ids IS 'Helper function to get all team IDs a user is a member of';
COMMENT ON FUNCTION is_organization_owner IS 'Helper function to check if user owns an organization';
COMMENT ON FUNCTION has_team_access IS 'Helper function to check if user has minimum role access to a team';

-- Create a function to set the current user context (to be called by your application)
CREATE OR REPLACE FUNCTION set_current_user_id(user_clerk_id TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_clerk_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_current_user_id IS 'Function to set current user context for RLS policies (call this in your application)';
