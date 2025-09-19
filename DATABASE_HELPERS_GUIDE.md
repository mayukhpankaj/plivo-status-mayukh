# Database Helper Functions and Multi-Tenant Access Guide

## Overview
This guide covers the comprehensive database helper functions and middleware for multi-tenant access in the status page application. The system ensures proper data isolation, access control, and security through Row Level Security (RLS) policies and role-based permissions.

## 🏗️ Architecture

### Multi-Tenant Structure
```
Organizations (Top-level tenants)
├── Teams (Sub-organizations)
│   ├── Team Members (Users with roles)
│   └── Services
│       ├── Incidents
│       └── Maintenances
```

### Access Control Hierarchy
1. **Organization Owner**: Full access to all teams and resources
2. **Team Owner**: Full access to team resources
3. **Team Admin**: Can manage team resources and members
4. **Team Member**: Can create/update incidents and maintenances
5. **Team Viewer**: Read-only access to team resources

## 📁 File Structure

### Core Services
- `backend/src/services/supabase.ts` - Enhanced Supabase client with RLS helpers
- `backend/src/services/queryBuilder.ts` - Tenant-aware query builder
- `backend/src/services/databaseHelpers.ts` - High-level database operations
- `backend/src/services/errorHandler.ts` - Comprehensive error handling

### Middleware
- `backend/src/middleware/tenantAccess.ts` - Multi-tenant access validation
- `backend/src/middleware/auth.ts` - Enhanced authentication middleware

### Routes
- `backend/src/routes/services.ts` - Example implementation using helpers

## 🔧 Core Components

### 1. RLS Helpers (`rlsHelpers`)
```typescript
// Set user context for RLS policies
await rlsHelpers.setUserContext(clerkUserId);

// Clear user context
await rlsHelpers.clearUserContext();
```

### 2. Organization Helpers (`organizationHelpers`)
```typescript
// Get user's organizations
const orgs = await organizationHelpers.getUserOrganizations(clerkUserId);

// Validate organization access
const hasAccess = await organizationHelpers.validateOrganizationAccess(clerkUserId, orgId);

// Check organization ownership
const isOwner = await organizationHelpers.isOrganizationOwner(clerkUserId, orgId);

// Create organization with default team
const org = await organizationHelpers.createOrganization(clerkUserId, { name, slug });
```

### 3. Team Helpers (`teamHelpers`)
```typescript
// Get user's team memberships
const teams = await teamHelpers.getUserTeams(clerkUserId);

// Get user's role in team
const role = await teamHelpers.getUserTeamRole(clerkUserId, teamId);

// Check minimum role requirement
const hasRole = await teamHelpers.hasMinimumTeamRole(clerkUserId, teamId, 'admin');

// Team member management
await teamHelpers.addTeamMember(clerkUserId, teamId, 'member');
await teamHelpers.updateTeamMemberRole(clerkUserId, teamId, 'admin');
await teamHelpers.removeTeamMember(clerkUserId, teamId);
```

### 4. Tenant Query Builder (`TenantQueryBuilder`)
```typescript
const queryBuilder = new TenantQueryBuilder(clerkUserId);

try {
  // Automatically filters by user's accessible teams
  const services = await queryBuilder.getServices({ status: 'operational' });
  const incidents = await queryBuilder.getIncidents({ severity: 'high' });
  const maintenances = await queryBuilder.getMaintenances({ upcoming: true });
} finally {
  await queryBuilder.clearContext();
}
```

### 5. Database Helpers (`DatabaseHelpers`)
```typescript
const dbHelpers = new DatabaseHelpers(clerkUserId);

try {
  // High-level operations with automatic tenant filtering
  const services = await dbHelpers.getServices();
  const dashboard = await dbHelpers.getTeamDashboard(teamId);
  const summary = await dbHelpers.getServiceStatusSummary(teamId);
} finally {
  await dbHelpers.cleanup();
}
```

## 🛡️ Security Features

### 1. Row Level Security (RLS)
- Automatic user context setting for all database operations
- Policies enforce data isolation between organizations
- No direct access to data outside user's scope

### 2. Access Validation Middleware
```typescript
// Validate organization access
app.use('/api/organizations/:organizationId', validateOrganizationAccess);

// Validate team access with minimum role
app.use('/api/teams/:teamId', validateTeamAccess, requireMinimumTeamRole('admin'));

// Validate service access (automatically checks team membership)
app.use('/api/services/:serviceId', validateServiceAccess);
```

### 3. Error Handling
```typescript
// Custom error classes with proper HTTP status codes
throw new TenantAccessError('Access denied to organization', 403);
throw new ValidationError('Invalid input', { name: 'Name is required' });
throw new DatabaseAccessError('Record not found', 'RECORD_NOT_FOUND', 404);
```

## 🚀 Usage Examples

### Creating a Protected Route
```typescript
import { Router } from 'express';
import { authenticateUser, requireAuth } from '../middleware/auth';
import { validateTeamAccess, requireMinimumTeamRole } from '../middleware/tenantAccess';
import { DatabaseHelpers } from '../services/databaseHelpers';
import { asyncHandler } from '../services/errorHandler';

const router = Router();

router.post('/teams/:teamId/services',
  authenticateUser,
  requireAuth,
  validateTeamAccess,
  requireMinimumTeamRole('admin'),
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { teamId } = req.params;
    const { name, description } = req.body;
    
    const dbHelpers = new DatabaseHelpers(userId);
    
    try {
      const service = await dbHelpers.createService({
        team_id: teamId,
        name,
        description
      });
      
      res.status(201).json({
        success: true,
        data: service
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);
```

### Bulk Operations with Error Handling
```typescript
router.post('/services/bulk-update',
  authenticateUser,
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { serviceIds, status } = req.body;
    
    const dbHelpers = new DatabaseHelpers(userId);
    
    try {
      // Automatically validates access to each service
      const updatedServices = await dbHelpers.bulkUpdateServiceStatus(serviceIds, status);
      
      res.json({
        success: true,
        data: updatedServices,
        message: `Updated ${updatedServices.length} services`
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);
```

### Dashboard Data with Analytics
```typescript
router.get('/teams/:teamId/dashboard',
  validateTeamAccess,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { teamId } = req.params;
    
    const dbHelpers = new DatabaseHelpers(userId);
    
    try {
      const dashboard = await dbHelpers.getTeamDashboard(teamId);
      
      res.json({
        success: true,
        data: dashboard
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);
```

## 🔍 Search and Filtering

### Search Operations
```typescript
// Search services across user's accessible teams
const services = await dbHelpers.searchServices('api', teamId);

// Search incidents with automatic team filtering
const incidents = await dbHelpers.searchIncidents('database', teamId);
```

### Advanced Filtering
```typescript
// Get services with filters and pagination
const services = await queryBuilder.getServices({
  team_id: 'team-123',
  status: 'operational',
  page: 1,
  limit: 20
});

// Get incidents with multiple filters
const incidents = await queryBuilder.getIncidents({
  service_id: 'service-456',
  status: 'investigating',
  severity: 'high',
  page: 1,
  limit: 10
});
```

## ⚠️ Error Handling Patterns

### Database Errors
```typescript
try {
  const service = await dbHelpers.createService(serviceData);
} catch (error) {
  if (error.code === 'DUPLICATE_RECORD') {
    // Handle duplicate service name
  } else if (error.code === 'FOREIGN_KEY_VIOLATION') {
    // Handle invalid team_id
  } else {
    // Handle other database errors
  }
}
```

### Access Control Errors
```typescript
// Middleware automatically handles these:
// - 401: Authentication required
// - 403: Access denied to resource
// - 404: Resource not found
// - 400: Invalid request data
```

## 📊 Performance Considerations

### 1. Context Management
- Always call `cleanup()` or `clearContext()` in finally blocks
- Use try-finally patterns to prevent context leaks

### 2. Query Optimization
- RLS policies use indexes for efficient filtering
- Pagination is built into query builders
- Bulk operations reduce database round trips

### 3. Caching Strategy
- User organizations and teams can be cached
- Service status summaries are good candidates for caching
- Invalidate cache on team membership changes

## 🧪 Testing

### Unit Tests
```typescript
describe('DatabaseHelpers', () => {
  let dbHelpers: DatabaseHelpers;
  
  beforeEach(() => {
    dbHelpers = new DatabaseHelpers('test-user-id');
  });
  
  afterEach(async () => {
    await dbHelpers.cleanup();
  });
  
  it('should get user services', async () => {
    const services = await dbHelpers.getServices();
    expect(services).toBeInstanceOf(Array);
  });
});
```

### Integration Tests
```typescript
describe('Service Routes', () => {
  it('should create service with proper access control', async () => {
    const response = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ team_id: 'team-123', name: 'Test Service' });
      
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});
```

## 🔄 Migration and Deployment

### Database Setup
1. Apply all migration files in order
2. Ensure RLS is enabled on all tables
3. Create the helper functions in the database
4. Test RLS policies with different user contexts

### Environment Variables
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
```

This comprehensive system provides secure, scalable multi-tenant access with proper error handling and performance optimization.
