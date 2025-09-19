-- Migration: Create helper functions for RLS and multi-tenant access
-- Description: Creates database functions to support RLS policies and user context management
-- Date: 2025-09-19

-- Function to set current user context for RLS policies
CREATE OR REPLACE FUNCTION set_current_user_id(user_clerk_id TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_clerk_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear current user context
CREATE OR REPLACE FUNCTION clear_current_user_id()
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_user_id', '', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user context
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to organization
CREATE OR REPLACE FUNCTION user_has_organization_access(user_id TEXT, org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  has_access BOOLEAN := FALSE;
BEGIN
  -- Check if user is organization owner
  SELECT EXISTS(
    SELECT 1 FROM organizations 
    WHERE id = org_id AND owner_id = user_id
  ) INTO has_access;
  
  IF has_access THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is a team member in the organization
  SELECT EXISTS(
    SELECT 1 FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    WHERE t.organization_id = org_id AND tm.user_id = user_id
  ) INTO has_access;
  
  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to team
CREATE OR REPLACE FUNCTION user_has_team_access(user_id TEXT, team_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  has_access BOOLEAN := FALSE;
  org_id UUID;
BEGIN
  -- Get organization ID for the team
  SELECT organization_id INTO org_id FROM teams WHERE id = team_id;
  
  IF org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is organization owner
  SELECT EXISTS(
    SELECT 1 FROM organizations 
    WHERE id = org_id AND owner_id = user_id
  ) INTO has_access;
  
  IF has_access THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is a team member
  SELECT EXISTS(
    SELECT 1 FROM team_members 
    WHERE team_id = team_id AND user_id = user_id
  ) INTO has_access;
  
  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's role in team
CREATE OR REPLACE FUNCTION get_user_team_role(user_id TEXT, team_id UUID)
RETURNS team_member_role AS $$
DECLARE
  user_role team_member_role;
  org_id UUID;
BEGIN
  -- Get organization ID for the team
  SELECT organization_id INTO org_id FROM teams WHERE id = team_id;
  
  -- Check if user is organization owner
  IF EXISTS(SELECT 1 FROM organizations WHERE id = org_id AND owner_id = user_id) THEN
    RETURN 'owner';
  END IF;
  
  -- Get user's role in the team
  SELECT role INTO user_role FROM team_members 
  WHERE team_id = team_id AND user_id = user_id;
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has minimum role in team
CREATE OR REPLACE FUNCTION user_has_minimum_team_role(user_id TEXT, team_id UUID, min_role team_member_role)
RETURNS BOOLEAN AS $$
DECLARE
  user_role team_member_role;
  role_hierarchy INTEGER;
  min_role_hierarchy INTEGER;
BEGIN
  -- Get user's role
  user_role := get_user_team_role(user_id, team_id);
  
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Define role hierarchy
  role_hierarchy := CASE user_role
    WHEN 'viewer' THEN 1
    WHEN 'member' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'owner' THEN 4
    ELSE 0
  END;
  
  min_role_hierarchy := CASE min_role
    WHEN 'viewer' THEN 1
    WHEN 'member' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'owner' THEN 4
    ELSE 0
  END;
  
  RETURN role_hierarchy >= min_role_hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to service
CREATE OR REPLACE FUNCTION user_has_service_access(user_id TEXT, service_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  team_id UUID;
BEGIN
  -- Get team ID for the service
  SELECT s.team_id INTO team_id FROM services s WHERE s.id = service_id;
  
  IF team_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN user_has_team_access(user_id, team_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get service status summary for a team
CREATE OR REPLACE FUNCTION get_team_service_status_summary(team_id UUID)
RETURNS TABLE(
  operational BIGINT,
  degraded BIGINT,
  partial_outage BIGINT,
  major_outage BIGINT,
  total BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'operational') as operational,
    COUNT(*) FILTER (WHERE status = 'degraded') as degraded,
    COUNT(*) FILTER (WHERE status = 'partial_outage') as partial_outage,
    COUNT(*) FILTER (WHERE status = 'major_outage') as major_outage,
    COUNT(*) as total
  FROM services 
  WHERE services.team_id = get_team_service_status_summary.team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get incident summary for a team
CREATE OR REPLACE FUNCTION get_team_incident_summary(team_id UUID)
RETURNS TABLE(
  total BIGINT,
  active BIGINT,
  resolved_today BIGINT,
  avg_resolution_time_minutes INTEGER
) AS $$
DECLARE
  today_start TIMESTAMP WITH TIME ZONE;
BEGIN
  today_start := date_trunc('day', NOW());
  
  RETURN QUERY
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE i.status != 'resolved') as active,
    COUNT(*) FILTER (WHERE i.status = 'resolved' AND i.resolved_at >= today_start) as resolved_today,
    COALESCE(
      ROUND(
        AVG(
          EXTRACT(EPOCH FROM (i.resolved_at - i.created_at)) / 60
        ) FILTER (WHERE i.resolved_at IS NOT NULL)
      )::INTEGER,
      0
    ) as avg_resolution_time_minutes
  FROM incidents i
  JOIN services s ON i.service_id = s.id
  WHERE s.team_id = get_team_incident_summary.team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up user data (for user deletion)
CREATE OR REPLACE FUNCTION cleanup_user_data(user_clerk_id TEXT)
RETURNS TABLE(
  organizations_affected INTEGER,
  teams_left INTEGER,
  profiles_deleted INTEGER
) AS $$
DECLARE
  org_count INTEGER := 0;
  team_count INTEGER := 0;
  profile_count INTEGER := 0;
BEGIN
  -- Count organizations owned by user
  SELECT COUNT(*) INTO org_count FROM organizations WHERE owner_id = user_clerk_id;
  
  -- Remove user from all teams
  DELETE FROM team_members WHERE user_id = user_clerk_id;
  GET DIAGNOSTICS team_count = ROW_COUNT;
  
  -- Delete user profile
  DELETE FROM user_profiles WHERE clerk_user_id = user_clerk_id;
  GET DIAGNOSTICS profile_count = ROW_COUNT;
  
  RETURN QUERY SELECT org_count, team_count, profile_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION set_current_user_id(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_organization_access(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_team_access(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_team_role(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_minimum_team_role(TEXT, UUID, team_member_role) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_service_access(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_service_status_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_incident_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_user_data(TEXT) TO service_role;

-- Comments for documentation
COMMENT ON FUNCTION set_current_user_id(TEXT) IS 'Sets the current user context for RLS policies';
COMMENT ON FUNCTION clear_current_user_id() IS 'Clears the current user context';
COMMENT ON FUNCTION get_current_user_id() IS 'Gets the current user context';
COMMENT ON FUNCTION user_has_organization_access(TEXT, UUID) IS 'Checks if user has access to organization';
COMMENT ON FUNCTION user_has_team_access(TEXT, UUID) IS 'Checks if user has access to team';
COMMENT ON FUNCTION get_user_team_role(TEXT, UUID) IS 'Gets user role in team';
COMMENT ON FUNCTION user_has_minimum_team_role(TEXT, UUID, team_member_role) IS 'Checks if user has minimum role in team';
COMMENT ON FUNCTION user_has_service_access(TEXT, UUID) IS 'Checks if user has access to service';
COMMENT ON FUNCTION get_team_service_status_summary(UUID) IS 'Gets service status summary for team';
COMMENT ON FUNCTION get_team_incident_summary(UUID) IS 'Gets incident summary for team';
COMMENT ON FUNCTION cleanup_user_data(TEXT) IS 'Cleans up user data when user is deleted';
