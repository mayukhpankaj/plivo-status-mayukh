-- Migration: Create services and incidents tables
-- Description: Creates services, incidents, and incident_updates tables with foreign key relationships
-- Date: 2025-09-19

-- Services table (monitored components/services)
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status service_status NOT NULL DEFAULT 'operational',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT services_name_length CHECK (LENGTH(name) >= 1),
    CONSTRAINT services_description_length CHECK (description IS NULL OR LENGTH(description) <= 2000)
);

-- Incidents table (service disruptions and outages)
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status incident_status NOT NULL DEFAULT 'investigating',
    severity incident_severity NOT NULL DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT incidents_title_length CHECK (LENGTH(title) >= 1),
    CONSTRAINT incidents_description_length CHECK (description IS NULL OR LENGTH(description) <= 5000),
    CONSTRAINT incidents_resolved_at_check CHECK (
        (status = 'resolved' AND resolved_at IS NOT NULL) OR 
        (status != 'resolved' AND resolved_at IS NULL)
    )
);

-- Incident updates table (timeline updates for incidents)
CREATE TABLE incident_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    status incident_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    author_id VARCHAR(255) NOT NULL, -- Clerk user ID
    
    -- Constraints
    CONSTRAINT incident_updates_message_length CHECK (LENGTH(message) >= 1 AND LENGTH(message) <= 2000)
);

-- Create triggers for updated_at
CREATE TRIGGER update_services_updated_at 
    BEFORE UPDATE ON services 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at 
    BEFORE UPDATE ON incidents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically set resolved_at when incident status changes to resolved
CREATE OR REPLACE FUNCTION set_incident_resolved_at()
RETURNS TRIGGER AS $$
BEGIN
    -- If status is being changed to resolved, set resolved_at
    IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
        NEW.resolved_at = NOW();
    -- If status is being changed from resolved to something else, clear resolved_at
    ELSIF NEW.status != 'resolved' AND OLD.status = 'resolved' THEN
        NEW.resolved_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automatic resolved_at handling
CREATE TRIGGER set_incident_resolved_at_trigger
    BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION set_incident_resolved_at();

-- Function to update service status based on active incidents
CREATE OR REPLACE FUNCTION update_service_status_from_incidents()
RETURNS TRIGGER AS $$
DECLARE
    service_uuid UUID;
    max_severity incident_severity;
    active_incidents_count INTEGER;
BEGIN
    -- Get the service_id from the incident
    IF TG_OP = 'DELETE' THEN
        service_uuid := OLD.service_id;
    ELSE
        service_uuid := NEW.service_id;
    END IF;
    
    -- Count active incidents and get max severity
    SELECT COUNT(*), COALESCE(MAX(severity), 'low')
    INTO active_incidents_count, max_severity
    FROM incidents 
    WHERE service_id = service_uuid AND status != 'resolved';
    
    -- Update service status based on incidents
    IF active_incidents_count = 0 THEN
        UPDATE services SET status = 'operational' WHERE id = service_uuid;
    ELSE
        CASE max_severity
            WHEN 'critical' THEN
                UPDATE services SET status = 'major_outage' WHERE id = service_uuid;
            WHEN 'high' THEN
                UPDATE services SET status = 'partial_outage' WHERE id = service_uuid;
            WHEN 'medium', 'low' THEN
                UPDATE services SET status = 'degraded' WHERE id = service_uuid;
        END CASE;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update service status when incidents change
CREATE TRIGGER update_service_status_on_incident_change
    AFTER INSERT OR UPDATE OR DELETE ON incidents
    FOR EACH ROW EXECUTE FUNCTION update_service_status_from_incidents();

-- Comments for documentation
COMMENT ON TABLE services IS 'Monitored services/components within a team';
COMMENT ON TABLE incidents IS 'Service disruptions and outages';
COMMENT ON TABLE incident_updates IS 'Timeline updates and communications for incidents';

COMMENT ON COLUMN services.status IS 'Current operational status of the service';
COMMENT ON COLUMN incidents.severity IS 'Impact level of the incident';
COMMENT ON COLUMN incidents.resolved_at IS 'Timestamp when incident was resolved (auto-set)';
COMMENT ON COLUMN incident_updates.author_id IS 'Clerk user ID of the update author';
