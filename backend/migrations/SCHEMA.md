# Database Schema Documentation

## Overview

This document describes the comprehensive database schema for the multi-tenant status page application built with Supabase/PostgreSQL. The schema supports multi-tenancy through organizations and teams, with proper Row Level Security (RLS) policies for data isolation.

## Schema Diagram

```
Organizations (Top-level tenants)
├── Teams (Sub-organizations)
│   ├── Team Members (Users with roles)
│   └── Services (Monitored components)
│       ├── Incidents (Service disruptions)
│       │   └── Incident Updates (Timeline updates)
│       └── Maintenances (Scheduled maintenance)
```

## Tables

### 1. Organizations
**Purpose**: Top-level tenant isolation for multi-tenancy

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| name | VARCHAR(255) | NOT NULL | Organization display name |
| slug | VARCHAR(100) | NOT NULL, UNIQUE | URL-friendly identifier |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| owner_id | VARCHAR(255) | NOT NULL | Clerk user ID of owner |

**Indexes**:
- `idx_organizations_slug` - Unique lookup
- `idx_organizations_owner_id` - Owner queries
- `idx_organizations_created_at` - Chronological queries

### 2. Teams
**Purpose**: Sub-organizations within an organization

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| organization_id | UUID | NOT NULL, FK to organizations(id) | Parent organization |
| name | VARCHAR(255) | NOT NULL | Team display name |
| slug | VARCHAR(100) | NOT NULL | URL-friendly identifier |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Constraints**:
- `teams_unique_slug_per_org` - UNIQUE(organization_id, slug)

**Indexes**:
- `idx_teams_organization_id` - Organization queries
- `idx_teams_org_slug` - Composite for unique constraint

### 3. Team Members
**Purpose**: Users assigned to teams with specific roles

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| team_id | UUID | NOT NULL, FK to teams(id) | Parent team |
| user_id | VARCHAR(255) | NOT NULL | Clerk user ID |
| role | team_member_role | NOT NULL, DEFAULT 'member' | User role in team |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Enums**:
- `team_member_role`: 'owner', 'admin', 'member', 'viewer'

**Constraints**:
- `team_members_unique_user_per_team` - UNIQUE(team_id, user_id)

### 4. Services
**Purpose**: Monitored services/components within a team

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| team_id | UUID | NOT NULL, FK to teams(id) | Parent team |
| name | VARCHAR(255) | NOT NULL | Service display name |
| description | TEXT | NULL | Service description |
| status | service_status | NOT NULL, DEFAULT 'operational' | Current status |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Enums**:
- `service_status`: 'operational', 'degraded', 'partial_outage', 'major_outage'

### 5. Incidents
**Purpose**: Service disruptions and outages

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| service_id | UUID | NOT NULL, FK to services(id) | Affected service |
| title | VARCHAR(500) | NOT NULL | Incident title |
| description | TEXT | NULL | Incident description |
| status | incident_status | NOT NULL, DEFAULT 'investigating' | Current status |
| severity | incident_severity | NOT NULL, DEFAULT 'medium' | Impact level |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| resolved_at | TIMESTAMPTZ | NULL | Resolution timestamp (auto-set) |

**Enums**:
- `incident_status`: 'investigating', 'identified', 'monitoring', 'resolved'
- `incident_severity`: 'low', 'medium', 'high', 'critical'

**Triggers**:
- Auto-sets `resolved_at` when status changes to 'resolved'
- Auto-updates parent service status based on active incidents

### 6. Incident Updates
**Purpose**: Timeline updates and communications for incidents

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| incident_id | UUID | NOT NULL, FK to incidents(id) | Parent incident |
| message | TEXT | NOT NULL | Update message |
| status | incident_status | NOT NULL | Status at time of update |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| author_id | VARCHAR(255) | NOT NULL | Clerk user ID of author |

### 7. Maintenances
**Purpose**: Scheduled maintenance windows

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| service_id | UUID | NOT NULL, FK to services(id) | Affected service |
| title | VARCHAR(500) | NOT NULL | Maintenance title |
| description | TEXT | NULL | Maintenance description |
| scheduled_start | TIMESTAMPTZ | NOT NULL | Planned start time |
| scheduled_end | TIMESTAMPTZ | NOT NULL | Planned end time |
| actual_start | TIMESTAMPTZ | NULL | Actual start time (auto-set) |
| actual_end | TIMESTAMPTZ | NULL | Actual end time (auto-set) |
| status | maintenance_status | NOT NULL, DEFAULT 'scheduled' | Current status |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| created_by | VARCHAR(255) | NOT NULL | Clerk user ID of creator |

**Enums**:
- `maintenance_status`: 'scheduled', 'in_progress', 'completed', 'cancelled'

**Triggers**:
- Auto-sets `actual_start` when status changes to 'in_progress'
- Auto-sets `actual_end` when status changes to 'completed'
- Auto-updates parent service status during maintenance

## Views

### upcoming_maintenances
Shows scheduled maintenances in the next 30 days with service, team, and organization details.

### active_maintenances
Shows currently in-progress maintenances with related details.

## Row Level Security (RLS)

All tables have RLS enabled with policies that ensure:

1. **Organization Isolation**: Users can only access data from organizations they own or are members of
2. **Team-based Access**: Users can only access team data where they are members
3. **Role-based Permissions**: Different roles have different levels of access:
   - **Owner**: Full access to organization and all teams
   - **Admin**: Can manage team settings and members
   - **Member**: Can create/update incidents, services, and maintenances
   - **Viewer**: Read-only access

### Key RLS Functions

- `get_user_organization_ids(user_id)`: Returns organization IDs user has access to
- `get_user_team_ids(user_id)`: Returns team IDs user is a member of
- `is_organization_owner(user_id, org_id)`: Checks if user owns organization
- `has_team_access(user_id, team_id, min_role)`: Checks if user has minimum role in team
- `set_current_user_id(user_id)`: Sets current user context for RLS

## Performance Optimizations

### Indexes
- **Primary indexes** on all foreign keys
- **Composite indexes** for common query patterns
- **Partial indexes** for frequently filtered subsets
- **Full-text search indexes** using GIN for text search
- **Covering indexes** to avoid additional lookups

### Triggers
- **Auto-update timestamps** using `update_updated_at_column()`
- **Auto-resolve incidents** when status changes
- **Auto-update service status** based on incidents and maintenance
- **Auto-set maintenance times** based on status changes

## Security Features

1. **UUID Primary Keys**: Better security and performance than sequential IDs
2. **Row Level Security**: Multi-tenant data isolation
3. **Input Validation**: CHECK constraints on data formats and lengths
4. **Foreign Key Constraints**: Maintain referential integrity
5. **Enum Types**: Prevent invalid status values
6. **Audit Trail**: Timestamps and author tracking

## Usage with Supabase

To use this schema with Supabase:

1. Run migrations in order: `001_*.sql` through `005_*.sql`
2. Set up your application to call `set_current_user_id()` with the Clerk user ID on each request
3. Use the service role key for admin operations and anon key for user operations
4. Configure Clerk webhook to sync user data if needed

## Migration Strategy

The schema is designed to be applied incrementally:

1. **001**: Base tables and enums
2. **002**: Services and incidents with business logic
3. **003**: Maintenances with scheduling logic
4. **004**: Performance indexes
5. **005**: Security policies

Each migration is idempotent and can be safely re-run.
