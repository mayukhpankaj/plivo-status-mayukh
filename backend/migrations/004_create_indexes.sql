-- Migration: Create performance indexes
-- Description: Creates indexes on frequently queried columns for optimal performance
-- Date: 2025-09-19

-- Organizations indexes
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX idx_organizations_created_at ON organizations(created_at);

-- Teams indexes
CREATE INDEX idx_teams_organization_id ON teams(organization_id);
CREATE INDEX idx_teams_slug ON teams(slug);
CREATE INDEX idx_teams_org_slug ON teams(organization_id, slug); -- Composite for unique constraint queries
CREATE INDEX idx_teams_created_at ON teams(created_at);

-- Team members indexes
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_role ON team_members(role);
CREATE INDEX idx_team_members_team_user ON team_members(team_id, user_id); -- Composite for unique constraint queries
CREATE INDEX idx_team_members_user_role ON team_members(user_id, role); -- For user permission queries

-- Services indexes
CREATE INDEX idx_services_team_id ON services(team_id);
CREATE INDEX idx_services_status ON services(status);
CREATE INDEX idx_services_created_at ON services(created_at);
CREATE INDEX idx_services_updated_at ON services(updated_at);
CREATE INDEX idx_services_team_status ON services(team_id, status); -- Composite for team service status queries

-- Incidents indexes
CREATE INDEX idx_incidents_service_id ON incidents(service_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_created_at ON incidents(created_at);
CREATE INDEX idx_incidents_updated_at ON incidents(updated_at);
CREATE INDEX idx_incidents_resolved_at ON incidents(resolved_at);
CREATE INDEX idx_incidents_service_status ON incidents(service_id, status); -- Composite for active incidents queries
CREATE INDEX idx_incidents_status_severity ON incidents(status, severity); -- Composite for priority queries
CREATE INDEX idx_incidents_service_created ON incidents(service_id, created_at DESC); -- For incident timeline queries

-- Incident updates indexes
CREATE INDEX idx_incident_updates_incident_id ON incident_updates(incident_id);
CREATE INDEX idx_incident_updates_author_id ON incident_updates(author_id);
CREATE INDEX idx_incident_updates_created_at ON incident_updates(created_at);
CREATE INDEX idx_incident_updates_status ON incident_updates(status);
CREATE INDEX idx_incident_updates_incident_created ON incident_updates(incident_id, created_at DESC); -- For timeline queries

-- Maintenances indexes
CREATE INDEX idx_maintenances_service_id ON maintenances(service_id);
CREATE INDEX idx_maintenances_status ON maintenances(status);
CREATE INDEX idx_maintenances_scheduled_start ON maintenances(scheduled_start);
CREATE INDEX idx_maintenances_scheduled_end ON maintenances(scheduled_end);
CREATE INDEX idx_maintenances_created_at ON maintenances(created_at);
CREATE INDEX idx_maintenances_created_by ON maintenances(created_by);
CREATE INDEX idx_maintenances_service_status ON maintenances(service_id, status); -- Composite for active maintenance queries
CREATE INDEX idx_maintenances_status_scheduled ON maintenances(status, scheduled_start); -- For upcoming maintenance queries

-- Partial indexes for better performance on common queries
-- Only index non-resolved incidents (most common query)
CREATE INDEX idx_incidents_active ON incidents(service_id, severity, created_at DESC) 
WHERE status != 'resolved';

-- Only index scheduled and in-progress maintenances
CREATE INDEX idx_maintenances_active ON maintenances(service_id, scheduled_start) 
WHERE status IN ('scheduled', 'in_progress');

-- Only index operational and degraded services (most common statuses)
CREATE INDEX idx_services_healthy ON services(team_id, updated_at DESC) 
WHERE status IN ('operational', 'degraded');

-- Full-text search indexes for better search performance
-- Create GIN indexes for full-text search on text fields
CREATE INDEX idx_organizations_name_fts ON organizations USING gin(to_tsvector('english', name));
CREATE INDEX idx_teams_name_fts ON teams USING gin(to_tsvector('english', name));
CREATE INDEX idx_services_name_fts ON services USING gin(to_tsvector('english', name));
CREATE INDEX idx_services_description_fts ON services USING gin(to_tsvector('english', COALESCE(description, '')));
CREATE INDEX idx_incidents_title_fts ON incidents USING gin(to_tsvector('english', title));
CREATE INDEX idx_incidents_description_fts ON incidents USING gin(to_tsvector('english', COALESCE(description, '')));
CREATE INDEX idx_maintenances_title_fts ON maintenances USING gin(to_tsvector('english', title));
CREATE INDEX idx_maintenances_description_fts ON maintenances USING gin(to_tsvector('english', COALESCE(description, '')));

-- Covering indexes for common query patterns
-- Organization with teams (avoid additional lookups)
CREATE INDEX idx_teams_org_covering ON teams(organization_id) INCLUDE (name, slug, created_at);

-- Team with services (avoid additional lookups)
CREATE INDEX idx_services_team_covering ON services(team_id) INCLUDE (name, status, updated_at);

-- Service with recent incidents (avoid additional lookups)
CREATE INDEX idx_incidents_service_covering ON incidents(service_id, created_at DESC) 
INCLUDE (title, status, severity) WHERE status != 'resolved';

-- Comments for documentation
COMMENT ON INDEX idx_organizations_slug IS 'Unique lookup index for organization slugs';
COMMENT ON INDEX idx_teams_org_slug IS 'Composite index for unique team slug per organization';
COMMENT ON INDEX idx_team_members_team_user IS 'Composite index for unique user per team constraint';
COMMENT ON INDEX idx_services_team_status IS 'Composite index for team service status queries';
COMMENT ON INDEX idx_incidents_service_status IS 'Composite index for active incidents per service';
COMMENT ON INDEX idx_incidents_active IS 'Partial index for non-resolved incidents only';
COMMENT ON INDEX idx_maintenances_active IS 'Partial index for scheduled/in-progress maintenances only';
COMMENT ON INDEX idx_services_healthy IS 'Partial index for operational/degraded services only';

-- Analyze tables to update statistics for query planner
ANALYZE organizations;
ANALYZE teams;
ANALYZE team_members;
ANALYZE services;
ANALYZE incidents;
ANALYZE incident_updates;
ANALYZE maintenances;
