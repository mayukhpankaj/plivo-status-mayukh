import { Router } from 'express';
import { authenticateUser, requireAuth } from '../middleware/auth';
import {
  validateTeamAccess,
  requireMinimumTeamRole,
  validateServiceAccess
} from '../middleware/tenantAccess';
import { DatabaseHelpers } from '../services/databaseHelpers';
import { ErrorHandler, asyncHandler } from '../services/errorHandler';
import { WebSocketService } from '../services/websocket';
import { AuditLogger } from '../services/auditLogger';
import {
  validate,
  createServiceSchema,
  updateServiceSchema,
  updateServiceStatusSchema,
  serviceFiltersSchema
} from '../validators/schemas';
import { supabase, teamHelpers } from '../services/supabase';

const router = Router();
const wsService = WebSocketService.getInstance();

// Apply authentication to all routes
router.use(authenticateUser, requireAuth);

// GET /api/services - List all services for current team
router.get('/',
  validate(serviceFiltersSchema, 'query'),
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { team_id, status, search, page, limit } = req.query;

    // Validate team access if team_id is provided
    if (team_id) {
      const hasAccess = await teamHelpers.validateTeamAccess(userId, team_id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to team',
          code: 'TEAM_ACCESS_DENIED'
        });
      }
    }

    const dbHelpers = new DatabaseHelpers(userId);

    try {
      let services;
      let total = 0;

      if (search) {
        // Search services
        const searchResults = await dbHelpers.searchServices(search, team_id);
        services = searchResults.slice((page - 1) * limit, page * limit);
        total = searchResults.length;
      } else {
        // Get services with filters
        const result = await dbHelpers.getServices({
          team_id,
          status,
          page,
          limit
        });
        services = result;
        total = services.length;
      }

      res.json({
        success: true,
        data: services,
        pagination: {
          page,
          limit,
          total,
          hasMore: services.length === limit && (page * limit) < total
        },
        filters: {
          team_id: team_id || null,
          status: status || null,
          search: search || null
        }
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

// POST /api/services - Create new service
router.post('/',
  validate(createServiceSchema, 'body'),
  validateTeamAccess,
  requireMinimumTeamRole('admin'),
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { team_id, name, description, entity_type, active_status } = req.body;

    const dbHelpers = new DatabaseHelpers(userId);

    try {
      // Check for service name uniqueness within team
      const { data: existingServices, error: checkError } = await supabase
        .from('services')
        .select('id, name')
        .eq('team_id', team_id)
        .ilike('name', name.trim());

      if (checkError) {
        throw new Error('Failed to check service name uniqueness');
      }

      if (existingServices && existingServices.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Service name already exists in this team',
          code: 'SERVICE_NAME_EXISTS',
          errors: { name: 'A service with this name already exists in the team' }
        });
      }

      // Get team and organization info for audit logging
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, organization_id, organizations(id)')
        .eq('id', team_id)
        .single();

      const service = await dbHelpers.createService({
        team_id,
        name: name.trim(),
        description: description?.trim() || null,
        entity_type: entity_type || 'service',
        active_status: active_status || 'active'
      });

      // Audit logging
      await AuditLogger.logServiceCreated(
        req,
        service.id,
        service,
        team_id,
        teamData?.organization_id
      );

      res.status(201).json({
        success: true,
        data: service,
        message: 'Service created successfully'
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

// GET /api/services/:id - Get service details
router.get('/:serviceId',
  validateServiceAccess,
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { serviceId } = req.params;

    const dbHelpers = new DatabaseHelpers(userId);

    try {
      const service = await dbHelpers.getServiceById(serviceId);

      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found',
          code: 'SERVICE_NOT_FOUND'
        });
      }

      // Get recent incidents and maintenances for this service
      const [recentIncidents, upcomingMaintenances] = await Promise.all([
        dbHelpers.getIncidents({
          service_id: serviceId,
          limit: 5
        }),
        dbHelpers.getMaintenances({
          service_id: serviceId,
          upcoming: true,
          limit: 3
        })
      ]);

      res.json({
        success: true,
        data: {
          ...service,
          recent_incidents: recentIncidents,
          upcoming_maintenances: upcomingMaintenances
        }
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

// PUT /api/services/:id - Update service
router.put('/:serviceId',
  validateServiceAccess,
  requireMinimumTeamRole('admin'),
  validate(updateServiceSchema, 'body'),
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { serviceId } = req.params;
    const updates = req.body;

    const dbHelpers = new DatabaseHelpers(userId);

    try {
      // Get current service data for audit logging
      const currentService = await dbHelpers.getServiceById(serviceId);
      if (!currentService) {
        return res.status(404).json({
          success: false,
          message: 'Service not found',
          code: 'SERVICE_NOT_FOUND'
        });
      }

      // Check for name uniqueness if name is being updated
      if (updates.name && updates.name !== currentService.name) {
        const { data: existingServices, error: checkError } = await supabase
          .from('services')
          .select('id, name')
          .eq('team_id', currentService.team_id)
          .neq('id', serviceId)
          .ilike('name', updates.name.trim());

        if (checkError) {
          throw new Error('Failed to check service name uniqueness');
        }

        if (existingServices && existingServices.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'Service name already exists in this team',
            code: 'SERVICE_NAME_EXISTS',
            errors: { name: 'A service with this name already exists in the team' }
          });
        }
      }

      // Get team info for audit logging
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, organization_id')
        .eq('id', currentService.team_id)
        .single();

      const updatedService = await dbHelpers.updateService(serviceId, updates);

      // Audit logging
      await AuditLogger.logServiceUpdated(
        req,
        serviceId,
        currentService,
        updates,
        currentService.team_id,
        teamData?.organization_id
      );

      res.json({
        success: true,
        data: updatedService,
        message: 'Service updated successfully'
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

// PATCH /api/services/:id/status - Update service status
router.patch('/:serviceId/status',
  validateServiceAccess,
  requireMinimumTeamRole('member'),
  validate(updateServiceStatusSchema, 'body'),
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { serviceId } = req.params;
    const { status } = req.body;

    const dbHelpers = new DatabaseHelpers(userId);

    try {
      // Get current service data
      const currentService = await dbHelpers.getServiceById(serviceId);
      if (!currentService) {
        return res.status(404).json({
          success: false,
          message: 'Service not found',
          code: 'SERVICE_NOT_FOUND'
        });
      }

      const oldStatus = currentService.status;

      // Update service status
      const updatedService = await dbHelpers.updateService(serviceId, { status });

      // Get team info for notifications and audit logging
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, organization_id')
        .eq('id', currentService.team_id)
        .single();

      // WebSocket notification for status change
      await wsService.notifyServiceStatusChange(
        serviceId,
        currentService.team_id,
        teamData?.organization_id,
        oldStatus,
        status,
        currentService.name,
        userId
      );

      // Audit logging for status change
      await AuditLogger.logServiceStatusChanged(
        req,
        serviceId,
        oldStatus,
        status,
        currentService.name,
        currentService.team_id,
        teamData?.organization_id
      );

      res.json({
        success: true,
        data: updatedService,
        message: `Service status updated to ${status}`,
        status_change: {
          from: oldStatus,
          to: status,
          timestamp: new Date().toISOString()
        }
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

// DELETE /api/services/:id - Delete service
router.delete('/:serviceId',
  validateServiceAccess,
  requireMinimumTeamRole('admin'),
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { serviceId } = req.params;

    const dbHelpers = new DatabaseHelpers(userId);

    try {
      // Get service data before deletion for audit logging
      const serviceData = await dbHelpers.getServiceById(serviceId);
      if (!serviceData) {
        return res.status(404).json({
          success: false,
          message: 'Service not found',
          code: 'SERVICE_NOT_FOUND'
        });
      }

      // Check if service has active incidents
      const activeIncidents = await dbHelpers.getIncidents({
        service_id: serviceId,
        status: 'investigating'
      });

      if (activeIncidents.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Cannot delete service with active incidents',
          code: 'SERVICE_HAS_ACTIVE_INCIDENTS',
          active_incidents: activeIncidents.length
        });
      }

      // Get team info for audit logging
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, organization_id')
        .eq('id', serviceData.team_id)
        .single();

      await dbHelpers.deleteService(serviceId);

      // Audit logging
      await AuditLogger.logServiceDeleted(
        req,
        serviceId,
        serviceData,
        serviceData.team_id,
        teamData?.organization_id
      );

      res.json({
        success: true,
        message: 'Service deleted successfully',
        deleted_service: {
          id: serviceId,
          name: serviceData.name
        }
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

export default router;
