-- Migration: Create maintenances table
-- Description: Creates maintenances table with proper relationships to services
-- Date: 2025-09-19

-- Maintenances table (scheduled maintenance windows)
CREATE TABLE maintenances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    status maintenance_status NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL, -- Clerk user ID
    
    -- Constraints
    CONSTRAINT maintenances_title_length CHECK (LENGTH(title) >= 1),
    CONSTRAINT maintenances_description_length CHECK (description IS NULL OR LENGTH(description) <= 5000),
    CONSTRAINT maintenances_scheduled_times CHECK (scheduled_end > scheduled_start),
    CONSTRAINT maintenances_actual_times CHECK (
        actual_end IS NULL OR actual_start IS NULL OR actual_end >= actual_start
    ),
    CONSTRAINT maintenances_future_scheduled CHECK (scheduled_start > created_at),
    CONSTRAINT maintenances_status_actual_times CHECK (
        (status = 'in_progress' AND actual_start IS NOT NULL AND actual_end IS NULL) OR
        (status = 'completed' AND actual_start IS NOT NULL AND actual_end IS NOT NULL) OR
        (status IN ('scheduled', 'cancelled') AND actual_start IS NULL AND actual_end IS NULL)
    )
);

-- Create trigger for updated_at
CREATE TRIGGER update_maintenances_updated_at 
    BEFORE UPDATE ON maintenances 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically set actual_start when maintenance status changes to in_progress
CREATE OR REPLACE FUNCTION set_maintenance_actual_times()
RETURNS TRIGGER AS $$
BEGIN
    -- If status is being changed to in_progress, set actual_start
    IF NEW.status = 'in_progress' AND OLD.status = 'scheduled' THEN
        NEW.actual_start = NOW();
    -- If status is being changed to completed, set actual_end
    ELSIF NEW.status = 'completed' AND OLD.status = 'in_progress' THEN
        NEW.actual_end = NOW();
    -- If status is being changed from in_progress back to scheduled, clear actual times
    ELSIF NEW.status = 'scheduled' AND OLD.status = 'in_progress' THEN
        NEW.actual_start = NULL;
        NEW.actual_end = NULL;
    -- If status is being changed to cancelled, clear actual times
    ELSIF NEW.status = 'cancelled' THEN
        NEW.actual_start = NULL;
        NEW.actual_end = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automatic actual time handling
CREATE TRIGGER set_maintenance_actual_times_trigger
    BEFORE UPDATE ON maintenances
    FOR EACH ROW EXECUTE FUNCTION set_maintenance_actual_times();

-- Function to update service status during maintenance windows
CREATE OR REPLACE FUNCTION update_service_status_for_maintenance()
RETURNS TRIGGER AS $$
DECLARE
    service_uuid UUID;
    active_maintenance_count INTEGER;
    active_incident_count INTEGER;
BEGIN
    -- Get the service_id from the maintenance
    IF TG_OP = 'DELETE' THEN
        service_uuid := OLD.service_id;
    ELSE
        service_uuid := NEW.service_id;
    END IF;
    
    -- Count active maintenances
    SELECT COUNT(*)
    INTO active_maintenance_count
    FROM maintenances 
    WHERE service_id = service_uuid AND status = 'in_progress';
    
    -- Count active incidents (higher priority than maintenance)
    SELECT COUNT(*)
    INTO active_incident_count
    FROM incidents 
    WHERE service_id = service_uuid AND status != 'resolved';
    
    -- Update service status based on maintenance and incidents
    -- Incidents take priority over maintenance
    IF active_incident_count > 0 THEN
        -- Let the incident trigger handle the status
        RETURN COALESCE(NEW, OLD);
    ELSIF active_maintenance_count > 0 THEN
        UPDATE services SET status = 'degraded' WHERE id = service_uuid;
    ELSE
        -- No active incidents or maintenance, check if we should reset to operational
        UPDATE services SET status = 'operational' WHERE id = service_uuid;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update service status when maintenance changes
CREATE TRIGGER update_service_status_on_maintenance_change
    AFTER INSERT OR UPDATE OR DELETE ON maintenances
    FOR EACH ROW EXECUTE FUNCTION update_service_status_for_maintenance();

-- View for upcoming maintenances (next 30 days)
CREATE VIEW upcoming_maintenances AS
SELECT 
    m.*,
    s.name as service_name,
    t.name as team_name,
    o.name as organization_name
FROM maintenances m
JOIN services s ON m.service_id = s.id
JOIN teams t ON s.team_id = t.id
JOIN organizations o ON t.organization_id = o.id
WHERE m.status = 'scheduled' 
    AND m.scheduled_start <= NOW() + INTERVAL '30 days'
ORDER BY m.scheduled_start ASC;

-- View for active maintenances
CREATE VIEW active_maintenances AS
SELECT 
    m.*,
    s.name as service_name,
    t.name as team_name,
    o.name as organization_name
FROM maintenances m
JOIN services s ON m.service_id = s.id
JOIN teams t ON s.team_id = t.id
JOIN organizations o ON t.organization_id = o.id
WHERE m.status = 'in_progress'
ORDER BY m.actual_start ASC;

-- Comments for documentation
COMMENT ON TABLE maintenances IS 'Scheduled maintenance windows for services';
COMMENT ON COLUMN maintenances.scheduled_start IS 'Planned start time for maintenance';
COMMENT ON COLUMN maintenances.scheduled_end IS 'Planned end time for maintenance';
COMMENT ON COLUMN maintenances.actual_start IS 'Actual start time (auto-set when status changes to in_progress)';
COMMENT ON COLUMN maintenances.actual_end IS 'Actual end time (auto-set when status changes to completed)';
COMMENT ON COLUMN maintenances.created_by IS 'Clerk user ID of the maintenance creator';

COMMENT ON VIEW upcoming_maintenances IS 'View of scheduled maintenances in the next 30 days';
COMMENT ON VIEW active_maintenances IS 'View of currently active maintenances';
