import { Router } from 'express';
import { authenticateUser, requireAuth } from '../middleware/auth';
import { 
  validateTeamAccess, 
  requireMinimumTeamRole,
  validateServiceAccess 
} from '../middleware/tenantAccess';
import { DatabaseHelpers } from '../services/databaseHelpers';
import { asyncHandler } from '../services/errorHandler';
import { WebSocketService } from '../services/websocket';
import { AuditLogger } from '../services/auditLogger';
import { 
  validate, 
  createMaintenanceSchema, 
  updateMaintenanceSchema,
  maintenanceFiltersSchema 
} from '../validators/schemas';
import { supabase, teamHelpers } from '../services/supabase';

const router = Router();
const wsService = WebSocketService.getInstance();

// Apply authentication to all routes
router.use(authenticateUser, requireAuth);

// GET /api/maintenances - List maintenances
router.get('/', 
  validate(maintenanceFiltersSchema, 'query'),
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { service_id, team_id, status, upcoming, page, limit } = req.query;
    
    // Validate access
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
      const result = await dbHelpers.getMaintenances({
        service_id,
        team_id,
        status,
        upcoming,
        page,
        limit
      });
      
      const maintenances = (result as any).data || result;
      const total = (result as any).total || maintenances.length;
      
      res.json({
        success: true,
        data: maintenances,
        pagination: {
          page,
          limit,
          total,
          hasMore: maintenances.length === limit && (page * limit) < total
        },
        filters: {
          service_id: service_id || null,
          team_id: team_id || null,
          status: status || null,
          upcoming: upcoming || null
        }
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

// POST /api/maintenances - Create new maintenance
router.post('/', 
  validate(createMaintenanceSchema, 'body'),
  validateServiceAccess,
  requireMinimumTeamRole('admin'),
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { service_id, title, description, scheduled_start, scheduled_end } = req.body;
    
    const dbHelpers = new DatabaseHelpers(userId);
    
    try {
      // Get service and team info
      const { data: serviceData } = await supabase
        .from('services')
        .select('id, name, team_id, teams(id, organization_id)')
        .eq('id', service_id)
        .single();

      if (!serviceData) {
        return res.status(404).json({
          success: false,
          message: 'Service not found',
          code: 'SERVICE_NOT_FOUND'
        });
      }

      // Validate maintenance window
      const startTime = new Date(scheduled_start);
      const endTime = new Date(scheduled_end);
      const now = new Date();

      if (startTime <= now) {
        return res.status(400).json({
          success: false,
          message: 'Maintenance start time must be in the future',
          code: 'INVALID_START_TIME'
        });
      }

      if (endTime <= startTime) {
        return res.status(400).json({
          success: false,
          message: 'Maintenance end time must be after start time',
          code: 'INVALID_END_TIME'
        });
      }

      // Check for overlapping maintenances
      const { data: overlapping } = await supabase
        .from('maintenances')
        .select('id, title, scheduled_start, scheduled_end')
        .eq('service_id', service_id)
        .neq('status', 'cancelled')
        .or(`and(scheduled_start.lte.${scheduled_end},scheduled_end.gte.${scheduled_start})`);

      if (overlapping && overlapping.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Maintenance window overlaps with existing maintenance',
          code: 'MAINTENANCE_OVERLAP',
          overlapping_maintenance: overlapping[0]
        });
      }

      const maintenance = await dbHelpers.createMaintenance({
        service_id,
        title: title.trim(),
        description: description?.trim() || null,
        scheduled_start,
        scheduled_end
      });

      // WebSocket notification
      await wsService.notifyMaintenanceScheduled(
        maintenance.id,
        service_id,
        serviceData.team_id,
        (serviceData as any).teams?.organization_id,
        maintenance
      );

      res.status(201).json({
        success: true,
        data: maintenance,
        message: 'Maintenance scheduled successfully'
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

// GET /api/maintenances/:id - Get maintenance details
router.get('/:maintenanceId', 
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { maintenanceId } = req.params;
    
    const dbHelpers = new DatabaseHelpers(userId);
    
    try {
      const maintenance = await dbHelpers.getMaintenanceById(maintenanceId);
      
      if (!maintenance) {
        return res.status(404).json({
          success: false,
          message: 'Maintenance not found',
          code: 'MAINTENANCE_NOT_FOUND'
        });
      }

      // Validate access to the service/team
      const hasAccess = await teamHelpers.validateTeamAccess(userId, (maintenance as any).service.team_id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to maintenance',
          code: 'MAINTENANCE_ACCESS_DENIED'
        });
      }
      
      res.json({
        success: true,
        data: maintenance
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

// PUT /api/maintenances/:id - Update maintenance
router.put('/:maintenanceId',
  validate(updateMaintenanceSchema, 'body'),
  requireMinimumTeamRole('admin'),
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { maintenanceId } = req.params;
    const updates = req.body;
    
    const dbHelpers = new DatabaseHelpers(userId);
    
    try {
      // Get current maintenance data
      const currentMaintenance = await dbHelpers.getMaintenanceById(maintenanceId);
      if (!currentMaintenance) {
        return res.status(404).json({
          success: false,
          message: 'Maintenance not found',
          code: 'MAINTENANCE_NOT_FOUND'
        });
      }

      // Validate access
      const hasAccess = await teamHelpers.validateTeamAccess(userId, (currentMaintenance as any).service.team_id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to maintenance',
          code: 'MAINTENANCE_ACCESS_DENIED'
        });
      }

      // Validate time updates if provided
      if (updates.scheduled_start || updates.scheduled_end) {
        const startTime = new Date(updates.scheduled_start || currentMaintenance.scheduled_start);
        const endTime = new Date(updates.scheduled_end || currentMaintenance.scheduled_end);
        
        if (endTime <= startTime) {
          return res.status(400).json({
            success: false,
            message: 'Maintenance end time must be after start time',
            code: 'INVALID_END_TIME'
          });
        }

        // Check for overlapping maintenances (excluding current one)
        const { data: overlapping } = await supabase
          .from('maintenances')
          .select('id, title, scheduled_start, scheduled_end')
          .eq('service_id', currentMaintenance.service_id)
          .neq('id', maintenanceId)
          .neq('status', 'cancelled')
          .or(`and(scheduled_start.lte.${endTime.toISOString()},scheduled_end.gte.${startTime.toISOString()})`);

        if (overlapping && overlapping.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'Maintenance window overlaps with existing maintenance',
            code: 'MAINTENANCE_OVERLAP',
            overlapping_maintenance: overlapping[0]
          });
        }
      }

      const updatedMaintenance = await dbHelpers.updateMaintenance(maintenanceId, updates);
      
      res.json({
        success: true,
        data: updatedMaintenance,
        message: 'Maintenance updated successfully'
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

// DELETE /api/maintenances/:id - Cancel maintenance
router.delete('/:maintenanceId',
  requireMinimumTeamRole('admin'),
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { maintenanceId } = req.params;
    
    const dbHelpers = new DatabaseHelpers(userId);
    
    try {
      // Get maintenance data
      const maintenance = await dbHelpers.getMaintenanceById(maintenanceId);
      if (!maintenance) {
        return res.status(404).json({
          success: false,
          message: 'Maintenance not found',
          code: 'MAINTENANCE_NOT_FOUND'
        });
      }

      // Validate access
      const hasAccess = await teamHelpers.validateTeamAccess(userId, (maintenance as any).service.team_id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to maintenance',
          code: 'MAINTENANCE_ACCESS_DENIED'
        });
      }

      // Cancel maintenance instead of deleting
      const cancelledMaintenance = await dbHelpers.updateMaintenance(maintenanceId, { 
        status: 'cancelled' 
      });
      
      res.json({
        success: true,
        data: cancelledMaintenance,
        message: 'Maintenance cancelled successfully'
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

export default router;
