-- Migration: Create audit logs table
-- Description: Creates audit_logs table for tracking all system changes
-- Date: 2025-09-19

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL, -- Clerk user ID
    organization_id UUID NOT NULL,
    team_id UUID,
    action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, STATUS_CHANGE, etc.
    resource_type VARCHAR(50) NOT NULL, -- SERVICE, INCIDENT, MAINTENANCE, TEAM_MEMBER, etc.
    resource_id VARCHAR(255) NOT NULL, -- ID of the affected resource
    old_values JSONB, -- Previous values (for updates)
    new_values JSONB, -- New values (for creates/updates)
    ip_address INET,
    user_agent TEXT,
    metadata JSONB, -- Additional context data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_audit_logs_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_logs_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Check constraints
    CONSTRAINT audit_logs_action_check CHECK (action IN (
        'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ADD', 'REMOVE', 'ROLE_CHANGE'
    )),
    CONSTRAINT audit_logs_resource_type_check CHECK (resource_type IN (
        'SERVICE', 'INCIDENT', 'INCIDENT_UPDATE', 'MAINTENANCE', 'TEAM', 'TEAM_MEMBER', 'ORGANIZATION'
    ))
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_team_id ON audit_logs(team_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_org_created_at ON audit_logs(organization_id, created_at);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_logs
CREATE POLICY "Users can view audit logs for their organizations" ON audit_logs
    FOR SELECT USING (
        user_has_organization_access(current_setting('app.current_user_id', true), organization_id)
    );

CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true); -- Allow system inserts

-- Comments for documentation
COMMENT ON TABLE audit_logs IS 'Audit trail for all system changes and actions';
COMMENT ON COLUMN audit_logs.user_id IS 'Clerk user ID who performed the action';
COMMENT ON COLUMN audit_logs.organization_id IS 'Organization where the action occurred';
COMMENT ON COLUMN audit_logs.team_id IS 'Team where the action occurred (if applicable)';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the affected resource';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous values before the change';
COMMENT ON COLUMN audit_logs.new_values IS 'New values after the change';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the user';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context and metadata';
