# Database Migrations

This directory contains SQL migration files for the multi-tenant status page application using Supabase/PostgreSQL.

## Migration Files

The migrations are organized in chronological order:

1. `001_create_enums_and_base_tables.sql` - Creates enums and base tables (organizations, teams, team_members)
2. `002_create_services_and_incidents.sql` - Creates services, incidents, and incident_updates tables
3. `003_create_maintenances.sql` - Creates maintenances table
4. `004_create_indexes.sql` - Creates performance indexes
5. `005_create_rls_policies.sql` - Creates Row Level Security policies for multi-tenancy

## How to Apply Migrations

### Using Supabase CLI (Recommended)

1. Install Supabase CLI: `npm install -g supabase`
2. Initialize Supabase in your project: `supabase init`
3. Link to your project: `supabase link --project-ref YOUR_PROJECT_REF`
4. Apply migrations: `supabase db push`

### Manual Application

You can also run these SQL files directly in your Supabase SQL editor or using psql:

```bash
psql -h YOUR_HOST -U postgres -d postgres -f migrations/001_create_enums_and_base_tables.sql
```

## Schema Overview

### Multi-Tenancy Structure

- **Organizations**: Top-level tenant isolation
- **Teams**: Sub-organizations within an organization
- **Team Members**: Users assigned to teams with roles

### Status Page Components

- **Services**: Monitored services/components
- **Incidents**: Service disruptions and outages
- **Incident Updates**: Timeline updates for incidents
- **Maintenances**: Scheduled maintenance windows

### Security

- Row Level Security (RLS) policies ensure data isolation between organizations
- UUID primary keys for better security and performance
- Proper foreign key constraints maintain data integrity

## Status Enums

- **Service Status**: `operational`, `degraded`, `partial_outage`, `major_outage`
- **Incident Status**: `investigating`, `identified`, `monitoring`, `resolved`
- **Incident Severity**: `low`, `medium`, `high`, `critical`
- **Maintenance Status**: `scheduled`, `in_progress`, `completed`, `cancelled`
- **Team Member Role**: `owner`, `admin`, `member`, `viewer`
