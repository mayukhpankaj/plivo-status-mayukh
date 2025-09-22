-- Migration: Update services table for entity types
-- Description: Add entity_type and active_status columns to services table
-- Date: 2025-09-19

-- Create enum for entity types
CREATE TYPE entity_type AS ENUM (
    'service',
    'database', 
    'api',
    'custom'
);

-- Create enum for active status
CREATE TYPE active_status AS ENUM (
    'active',
    'down'
);

-- Add new columns to services table
ALTER TABLE services 
ADD COLUMN entity_type entity_type NOT NULL DEFAULT 'service',
ADD COLUMN active_status active_status NOT NULL DEFAULT 'active';

-- Update existing services to have default values
UPDATE services SET entity_type = 'service', active_status = 'active';

-- Add indexes for better performance
CREATE INDEX idx_services_entity_type ON services(entity_type);
CREATE INDEX idx_services_active_status ON services(active_status);
CREATE INDEX idx_services_team_id_entity_type ON services(team_id, entity_type);

-- Comments for documentation
COMMENT ON COLUMN services.entity_type IS 'Type of entity: service, database, api, or custom';
COMMENT ON COLUMN services.active_status IS 'Active status: active or down';
