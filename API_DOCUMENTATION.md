# Status Page API Documentation

## Overview

A comprehensive RESTful API for managing multi-tenant status pages with real-time notifications, audit logging, and role-based access control.

## Base URL
```
http://localhost:3001/api
```

## Authentication

Most endpoints require authentication via Clerk JWT tokens:

```
Authorization: Bearer <jwt_token>
```

## Rate Limiting

- **General endpoints**: 100 requests per 15 minutes
- **Authentication endpoints**: 20 requests per 15 minutes  
- **Webhook endpoints**: 50 requests per minute

## API Structure

### Core Resources

1. **Organizations** - Top-level tenant isolation
2. **Teams** - Sub-organizations within an organization
3. **Services** - Monitored services within teams
4. **Incidents** - Service disruption tracking
5. **Maintenances** - Scheduled maintenance windows

## Service Management API

### GET /api/services
List all services for accessible teams.

**Query Parameters:**
- `team_id` (string, optional) - Filter by team ID
- `status` (string, optional) - Filter by status: `operational`, `degraded`, `partial_outage`, `major_outage`
- `search` (string, optional) - Search services by name (min 2 chars)
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Items per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "API Service",
      "description": "Main API service",
      "status": "operational",
      "team_id": "uuid",
      "created_at": "2025-09-19T10:00:00Z",
      "updated_at": "2025-09-19T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "hasMore": true
  },
  "filters": {
    "team_id": "uuid",
    "status": "operational",
    "search": null
  }
}
```

### POST /api/services
Create a new service.

**Required Role:** Admin

**Request Body:**
```json
{
  "team_id": "uuid",
  "name": "Service Name",
  "description": "Optional description"
}
```

**Validation:**
- `team_id`: Required UUID
- `name`: Required, 2-100 chars, alphanumeric + spaces/hyphens/underscores/dots
- `description`: Optional, max 500 chars
- Service name must be unique within team

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Service Name",
    "description": "Optional description",
    "status": "operational",
    "team_id": "uuid",
    "created_at": "2025-09-19T10:00:00Z",
    "updated_at": "2025-09-19T10:00:00Z"
  },
  "message": "Service created successfully"
}
```

### GET /api/services/:id
Get service details with recent incidents and upcoming maintenances.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Service Name",
    "description": "Description",
    "status": "operational",
    "team_id": "uuid",
    "created_at": "2025-09-19T10:00:00Z",
    "updated_at": "2025-09-19T10:00:00Z",
    "recent_incidents": [...],
    "upcoming_maintenances": [...]
  }
}
```

### PUT /api/services/:id
Update service details.

**Required Role:** Admin

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "status": "degraded"
}
```

**Validation:**
- All fields optional
- Same validation rules as creation
- Name uniqueness checked if changed

**Features:**
- Audit logging for all changes
- Name uniqueness validation
- Access control validation

### PATCH /api/services/:id/status
Update only the service status.

**Required Role:** Member

**Request Body:**
```json
{
  "status": "degraded"
}
```

**Valid Statuses:**
- `operational` - Service is working normally
- `degraded` - Service is experiencing minor issues
- `partial_outage` - Service is partially unavailable
- `major_outage` - Service is completely unavailable

**Features:**
- Real-time WebSocket notifications
- Audit logging with status change tracking
- Automatic timestamp recording

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "degraded",
    "updated_at": "2025-09-19T10:30:00Z"
  },
  "message": "Service status updated to degraded",
  "status_change": {
    "from": "operational",
    "to": "degraded",
    "timestamp": "2025-09-19T10:30:00Z"
  }
}
```

### DELETE /api/services/:id
Delete a service.

**Required Role:** Admin

**Validation:**
- Cannot delete services with active incidents
- Soft delete with audit logging

**Response:**
```json
{
  "success": true,
  "message": "Service deleted successfully",
  "deleted_service": {
    "id": "uuid",
    "name": "Service Name"
  }
}
```

## Error Responses

### Validation Errors (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": {
    "name": "Service name must be at least 2 characters long",
    "team_id": "Team ID is required"
  }
}
```

### Authentication Errors (401)
```json
{
  "success": false,
  "message": "Authentication required",
  "code": "AUTHENTICATION_REQUIRED"
}
```

### Authorization Errors (403)
```json
{
  "success": false,
  "message": "Access denied to team",
  "code": "TEAM_ACCESS_DENIED"
}
```

### Not Found Errors (404)
```json
{
  "success": false,
  "message": "Service not found",
  "code": "SERVICE_NOT_FOUND"
}
```

### Conflict Errors (409)
```json
{
  "success": false,
  "message": "Service name already exists in this team",
  "code": "SERVICE_NAME_EXISTS",
  "errors": {
    "name": "A service with this name already exists in the team"
  }
}
```

### Rate Limit Errors (429)
```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again later",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 900
}
```

## WebSocket Events

Connect to WebSocket server for real-time updates:

```javascript
const socket = io('ws://localhost:3001', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Service status changes
socket.on('service_status_changed', (notification) => {
  console.log('Service status changed:', notification);
});
```

### Event Types
- `service_status_changed` - Service status updates
- `incident_created` - New incidents
- `incident_updated` - Incident updates
- `maintenance_scheduled` - New maintenance windows

## Audit Logging

All service operations are automatically logged with:
- User ID and IP address
- Before/after values for updates
- Timestamp and action type
- Additional metadata

Access audit logs via:
```
GET /api/audit-logs?resource_type=SERVICE&resource_id=uuid
```

## Security Features

- **Row Level Security (RLS)** - Database-level tenant isolation
- **Role-Based Access Control** - Team member roles (viewer, member, admin, owner)
- **Input Validation** - Comprehensive validation using Joi schemas
- **Rate Limiting** - Protection against abuse
- **CORS Configuration** - Secure cross-origin requests
- **Helmet Security** - Security headers
- **Request Logging** - Comprehensive request tracking

## Multi-Tenant Architecture

- **Organizations** - Top-level tenant boundary
- **Teams** - Sub-organizations with independent services
- **Automatic Context** - User context automatically set for all operations
- **Access Validation** - Multiple layers of access control
- **Data Isolation** - Complete separation between organizations
