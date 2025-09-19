# 🚨 Incident Management API Documentation

## Overview

Comprehensive incident management system with full CRUD operations, timeline tracking, automatic service status updates, and real-time notifications.

## Base URL
```
http://localhost:3001/api/incidents
```

## Authentication
All endpoints require authentication via Clerk JWT tokens:
```
Authorization: Bearer <jwt_token>
```

## Incident Lifecycle

### Status Flow
1. **investigating** - Initial status when incident is created
2. **identified** - Root cause has been identified
3. **monitoring** - Fix has been applied, monitoring for stability
4. **resolved** - Incident has been fully resolved

### Severity Levels
- **low** - Minor issues with minimal impact
- **medium** - Moderate issues affecting some users
- **high** - Major issues affecting many users
- **critical** - Complete service outage

## API Endpoints

### 1. GET /api/incidents
List incidents with filtering and pagination.

**Query Parameters:**
- `service_id` (string, optional) - Filter by service ID
- `team_id` (string, optional) - Filter by team ID
- `status` (string, optional) - Filter by status
- `severity` (string, optional) - Filter by severity
- `search` (string, optional) - Search by title/description
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Items per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Database Connection Issues",
      "description": "Users experiencing slow response times",
      "status": "investigating",
      "severity": "high",
      "service_id": "uuid",
      "created_at": "2025-09-19T10:00:00Z",
      "updated_at": "2025-09-19T10:30:00Z",
      "resolved_at": null,
      "service": {
        "id": "uuid",
        "name": "API Service",
        "team_id": "uuid"
      }
    }
  ],
  "summary": {
    "total_incidents": 25,
    "active_incidents": 3,
    "critical_incidents": 1,
    "avg_resolution_time": 45
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "hasMore": true
  },
  "filters": {
    "service_id": null,
    "team_id": "uuid",
    "status": null,
    "severity": "high",
    "search": null
  }
}
```

### 2. POST /api/incidents
Create a new incident.

**Required Role:** Member

**Request Body:**
```json
{
  "service_id": "uuid",
  "title": "Database Connection Issues",
  "description": "Users experiencing slow response times",
  "severity": "high"
}
```

**Validation:**
- `service_id`: Required UUID
- `title`: Required, 5-200 characters
- `description`: Optional, max 2000 characters
- `severity`: Required, one of: low, medium, high, critical

**Features:**
- ✅ Automatic service status update based on severity
- ✅ Real-time WebSocket notifications
- ✅ Audit logging
- ✅ Team access validation

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Database Connection Issues",
    "description": "Users experiencing slow response times",
    "status": "investigating",
    "severity": "high",
    "service_id": "uuid",
    "created_at": "2025-09-19T10:00:00Z",
    "service": {
      "id": "uuid",
      "name": "API Service",
      "old_status": "operational",
      "new_status": "partial_outage"
    }
  },
  "message": "Incident created successfully",
  "service_status_updated": true
}
```

### 3. GET /api/incidents/:id
Get incident details with updates and timeline.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Database Connection Issues",
    "description": "Users experiencing slow response times",
    "status": "monitoring",
    "severity": "high",
    "service_id": "uuid",
    "created_at": "2025-09-19T10:00:00Z",
    "updated_at": "2025-09-19T11:30:00Z",
    "resolved_at": null,
    "service": {
      "id": "uuid",
      "name": "API Service",
      "team_id": "uuid"
    },
    "updates": [
      {
        "id": "uuid",
        "message": "Investigating database connection issues",
        "status": "investigating",
        "author_id": "clerk_user_id",
        "created_at": "2025-09-19T10:05:00Z"
      },
      {
        "id": "uuid",
        "message": "Root cause identified - connection pool exhaustion",
        "status": "identified",
        "author_id": "clerk_user_id",
        "created_at": "2025-09-19T10:30:00Z"
      }
    ],
    "metrics": {
      "duration_minutes": 90,
      "duration_hours": 1.5,
      "is_resolved": false,
      "time_to_resolution": null,
      "updates_count": 2,
      "last_updated": "2025-09-19T10:30:00Z"
    },
    "related_incidents": [...]
  }
}
```

### 4. PUT /api/incidents/:id
Update incident details.

**Required Role:** Member (with restrictions for resolved incidents)

**Request Body:**
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "status": "identified",
  "severity": "medium"
}
```

**Features:**
- ✅ Automatic service status updates when severity/status changes
- ✅ Automatic update entries for status changes
- ✅ Permission validation (resolved incidents require admin)
- ✅ Real-time notifications

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Updated title",
    "status": "identified",
    "severity": "medium",
    "updated_at": "2025-09-19T11:00:00Z"
  },
  "message": "Incident updated successfully",
  "changes": {
    "status_changed": true,
    "severity_changed": true
  }
}
```

### 5. DELETE /api/incidents/:id
Delete an incident.

**Required Role:** Admin

**Business Rules:**
- Cannot delete resolved incidents older than 24 hours
- Automatically updates service status after deletion

**Response:**
```json
{
  "success": true,
  "message": "Incident deleted successfully",
  "deleted_incident": {
    "id": "uuid",
    "title": "Database Connection Issues",
    "service_name": "API Service"
  }
}
```

### 6. POST /api/incidents/:id/updates
Add an update to an incident.

**Required Role:** Member

**Request Body:**
```json
{
  "message": "Applied database connection pool fix",
  "status": "monitoring"
}
```

**Validation:**
- `message`: Required, 10-1000 characters
- `status`: Required, valid incident status

**Features:**
- ✅ Automatic incident status update
- ✅ Service status recalculation
- ✅ Real-time notifications

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "incident_id": "uuid",
    "message": "Applied database connection pool fix",
    "status": "monitoring",
    "author_id": "clerk_user_id",
    "created_at": "2025-09-19T11:30:00Z"
  },
  "message": "Incident update added successfully",
  "status_changed": true
}
```

### 7. PATCH /api/incidents/:id/resolve
Resolve an incident.

**Required Role:** Member

**Request Body:**
```json
{
  "resolution_message": "Database connection issues have been resolved by increasing connection pool size"
}
```

**Features:**
- ✅ Automatic resolved_at timestamp
- ✅ Service status restoration if no other active incidents
- ✅ Resolution time calculation
- ✅ Real-time notifications

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "resolved",
    "resolved_at": "2025-09-19T12:00:00Z"
  },
  "message": "Incident resolved successfully",
  "resolution": {
    "resolved_at": "2025-09-19T12:00:00Z",
    "resolution_time_minutes": 120,
    "resolution_time_hours": 2.0,
    "service_restored": true,
    "old_service_status": "partial_outage",
    "new_service_status": "operational"
  }
}
```

## Automatic Service Status Updates

The system automatically updates service status based on active incidents:

### Status Mapping
- **No active incidents** → `operational`
- **Low severity incidents** → `degraded`
- **Medium severity incidents** → `degraded`
- **High severity incidents** → `partial_outage`
- **Critical severity incidents** → `major_outage`

### When Updates Occur
- ✅ When incident is created
- ✅ When incident severity is changed
- ✅ When incident status is changed
- ✅ When incident is resolved
- ✅ When incident is deleted

## Real-time Features

### WebSocket Events
- `incident_created` - New incident notifications
- `incident_updated` - Incident update notifications
- `service_status_changed` - Service status change notifications

### Event Data
```json
{
  "type": "incident_created",
  "data": {
    "incidentId": "uuid",
    "serviceId": "uuid",
    "title": "Database Connection Issues",
    "severity": "high",
    "service_name": "API Service",
    "old_service_status": "operational",
    "new_service_status": "partial_outage"
  },
  "organizationId": "uuid",
  "teamId": "uuid",
  "serviceId": "uuid",
  "timestamp": "2025-09-19T10:00:00Z"
}
```

## Error Handling

### Common Error Codes
- `INCIDENT_NOT_FOUND` (404) - Incident does not exist
- `SERVICE_NOT_FOUND` (404) - Associated service does not exist
- `INCIDENT_ACCESS_DENIED` (403) - No access to incident's team
- `INCIDENT_ALREADY_RESOLVED` (409) - Trying to resolve already resolved incident
- `INCIDENT_TOO_OLD` (409) - Trying to delete old resolved incident
- `INSUFFICIENT_PERMISSIONS` (403) - Role-based access denied

## Security Features

- ✅ **Multi-tenant isolation** - Users can only access incidents in their teams
- ✅ **Role-based access control** - Different permissions for different roles
- ✅ **Input validation** - Comprehensive validation using Joi schemas
- ✅ **Audit logging** - All operations are logged with user context
- ✅ **Rate limiting** - Protection against abuse

## Performance Features

- ✅ **Pagination** - Efficient handling of large incident lists
- ✅ **Search functionality** - Fast text search across incidents
- ✅ **Filtering** - Multiple filter options for targeted queries
- ✅ **Summary statistics** - Quick overview of incident metrics
