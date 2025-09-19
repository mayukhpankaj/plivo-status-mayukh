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
  createIncidentSchema,
  updateIncidentSchema,
  createIncidentUpdateSchema,
  resolveIncidentSchema,
  incidentFiltersSchema
} from '../validators/schemas';
import { supabase, teamHelpers } from '../services/supabase';
import { IncidentWithUpdates } from '../types';

const router = Router();
const wsService = WebSocketService.getInstance();

// Apply authentication to all routes
router.use(authenticateUser, requireAuth);

// GET /api/incidents - List incidents with filtering and pagination
router.get('/',
  validate(incidentFiltersSchema, 'query'),
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { service_id, team_id, status, severity, page, limit, search } = req.query;

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

    if (service_id) {
      // Get service to validate team access
      const { data: serviceData } = await supabase
        .from('services')
        .select('team_id')
        .eq('id', service_id)
        .single();

      if (serviceData) {
        const hasAccess = await teamHelpers.validateTeamAccess(userId, serviceData.team_id);
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to service',
            code: 'SERVICE_ACCESS_DENIED'
          });
        }
      }
    }

    const dbHelpers = new DatabaseHelpers(userId);

    try {
      let incidents: IncidentWithUpdates[];
      let total = 0;

      if (search) {
        // Search incidents by title/description
        incidents = await dbHelpers.searchIncidents(search, team_id);
        // Apply additional filters to search results
        if (status) incidents = incidents.filter(i => i.status === status);
        if (severity) incidents = incidents.filter(i => i.severity === severity);
        if (service_id) incidents = incidents.filter(i => i.service_id === service_id);

        total = incidents.length;
        // Apply pagination to search results
        const startIndex = (page - 1) * limit;
        incidents = incidents.slice(startIndex, startIndex + limit);
      } else {
        // Regular filtered query
        const result = await dbHelpers.getIncidents({
          service_id,
          team_id,
          status,
          severity,
          page,
          limit
        });

        incidents = (result as any).data || result;
        total = (result as any).total || incidents.length;
      }

      // Calculate summary statistics
      const allIncidents = await dbHelpers.getIncidents({ team_id });
      const summary = {
        total_incidents: allIncidents.length,
        active_incidents: allIncidents.filter(i => i.status !== 'resolved').length,
        critical_incidents: allIncidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length,
        avg_resolution_time: await calculateAverageResolutionTime(allIncidents)
      };

      res.json({
        success: true,
        data: incidents,
        summary,
        pagination: {
          page,
          limit,
          total,
          hasMore: incidents.length === limit && (page * limit) < total
        },
        filters: {
          service_id: service_id || null,
          team_id: team_id || null,
          status: status || null,
          severity: severity || null,
          search: search || null
        }
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

// Helper function to calculate average resolution time
async function calculateAverageResolutionTime(incidents: any[]): Promise<number> {
  const resolvedIncidents = incidents.filter(i => i.resolved_at);

  if (resolvedIncidents.length === 0) return 0;

  const totalTime = resolvedIncidents.reduce((sum, incident) => {
    const created = new Date(incident.created_at);
    const resolved = new Date(incident.resolved_at);
    return sum + (resolved.getTime() - created.getTime());
  }, 0);

  return Math.round(totalTime / resolvedIncidents.length / (1000 * 60)); // minutes
}

// POST /api/incidents - Create new incident
router.post('/',
  validate(createIncidentSchema, 'body'),
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { service_id, title, description, severity } = req.body;

    // Validate service access
    const { data: serviceData } = await supabase
      .from('services')
      .select('id, name, status, team_id, teams(id, organization_id)')
      .eq('id', service_id)
      .single();

    if (!serviceData) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
        code: 'SERVICE_NOT_FOUND'
      });
    }

    // Validate team access
    const hasAccess = await teamHelpers.validateTeamAccess(userId, serviceData.team_id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to service',
        code: 'SERVICE_ACCESS_DENIED'
      });
    }

    const dbHelpers = new DatabaseHelpers(userId);

    try {
      // Create incident
      const incident = await dbHelpers.createIncident({
        service_id,
        title: title.trim(),
        description: description?.trim() || null,
        severity
      });

      // Automatically update service status based on incident severity
      await dbHelpers.updateServiceStatusBasedOnIncidents(service_id);

      // Get updated service data for notifications
      const { data: updatedService } = await supabase
        .from('services')
        .select('status')
        .eq('id', service_id)
        .single();

      // WebSocket notification for incident creation
      await wsService.notifyIncidentCreated(
        incident.id,
        service_id,
        serviceData.team_id,
        (serviceData as any).teams?.organization_id,
        {
          ...incident,
          service_name: serviceData.name,
          old_service_status: serviceData.status,
          new_service_status: updatedService?.status
        }
      );

      // WebSocket notification for service status change if it changed
      if (updatedService && updatedService.status !== serviceData.status) {
        await wsService.notifyServiceStatusChange(
          service_id,
          serviceData.team_id,
          (serviceData as any).teams?.organization_id,
          serviceData.status,
          updatedService.status,
          serviceData.name,
          userId
        );
      }

      // Audit logging
      await AuditLogger.logIncidentCreated(
        req,
        incident.id,
        incident,
        service_id,
        serviceData.team_id,
        (serviceData as any).teams?.organization_id
      );

      res.status(201).json({
        success: true,
        data: {
          ...incident,
          service: {
            id: serviceData.id,
            name: serviceData.name,
            old_status: serviceData.status,
            new_status: updatedService?.status
          }
        },
        message: 'Incident created successfully',
        service_status_updated: updatedService?.status !== serviceData.status
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

// GET /api/incidents/:id - Get incident with updates and timeline
router.get('/:incidentId',
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { incidentId } = req.params;

    const dbHelpers = new DatabaseHelpers(userId);

    try {
      const incident: IncidentWithUpdates | null = await dbHelpers.getIncidentById(incidentId);

      if (!incident) {
        return res.status(404).json({
          success: false,
          message: 'Incident not found',
          code: 'INCIDENT_NOT_FOUND'
        });
      }

      // Validate access to the service/team
      const hasAccess = await teamHelpers.validateTeamAccess(userId, (incident as any).service.team_id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to incident',
          code: 'INCIDENT_ACCESS_DENIED'
        });
      }

      // Get incident updates with author information
      const updates = await dbHelpers.getIncidentUpdates(incidentId);

      // Calculate incident metrics
      const createdAt = new Date(incident.created_at);
      const now = new Date();
      const resolvedAt = incident.resolved_at ? new Date(incident.resolved_at) : null;

      const duration = resolvedAt
        ? Math.round((resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60)) // minutes
        : Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60)); // minutes since creation

      const metrics = {
        duration_minutes: duration,
        duration_hours: Math.round(duration / 60 * 10) / 10,
        is_resolved: incident.status === 'resolved',
        time_to_resolution: resolvedAt ? duration : null,
        updates_count: updates.length,
        last_updated: updates.length > 0 ? updates[updates.length - 1].created_at : incident.created_at
      };

      // Get related incidents for the same service
      const relatedIncidents = await dbHelpers.getIncidents({
        service_id: incident.service_id,
        limit: 5
      });

      const filteredRelatedIncidents = relatedIncidents
        .filter(i => i.id !== incidentId)
        .slice(0, 3);

      res.json({
        success: true,
        data: {
          ...incident,
          updates,
          metrics,
          related_incidents: filteredRelatedIncidents
        }
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

// PUT /api/incidents/:id - Update incident
router.put('/:incidentId',
  validate(updateIncidentSchema, 'body'),
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { incidentId } = req.params;
    const updates = req.body;

    const dbHelpers = new DatabaseHelpers(userId);

    try {
      // Get current incident data
      const currentIncident: IncidentWithUpdates | null = await dbHelpers.getIncidentById(incidentId);
      if (!currentIncident) {
        return res.status(404).json({
          success: false,
          message: 'Incident not found',
          code: 'INCIDENT_NOT_FOUND'
        });
      }

      // Validate access
      const hasAccess = await teamHelpers.validateTeamAccess(userId, (currentIncident as any).service.team_id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to incident',
          code: 'INCIDENT_ACCESS_DENIED'
        });
      }

      // Check if user has minimum role for the operation
      const userRole = await teamHelpers.getUserTeamRole(userId, (currentIncident as any).service.team_id);
      const canEdit = ['admin', 'owner'].includes(userRole) ||
                     (['member'].includes(userRole) && currentIncident.status !== 'resolved');

      if (!canEdit) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to update this incident',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Store old values for comparison
      const oldStatus = currentIncident.status;
      const oldSeverity = currentIncident.severity;

      const updatedIncident = await dbHelpers.updateIncident(incidentId, updates);

      // Update service status if incident severity or status changed
      if (updates.severity !== oldSeverity || updates.status !== oldStatus) {
        await dbHelpers.updateServiceStatusBasedOnIncidents(currentIncident.service_id);
      }

      // Get team info for notifications
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, organization_id')
        .eq('id', (currentIncident as any).service.team_id)
        .single();

      // WebSocket notification
      await wsService.notifyIncidentUpdated(
        incidentId,
        currentIncident.service_id,
        (currentIncident as any).service.team_id,
        teamData?.organization_id,
        {
          ...updates,
          updated_by: userId,
          old_status: oldStatus,
          old_severity: oldSeverity
        }
      );

      // Audit logging
      await AuditLogger.logIncidentUpdated(
        req,
        incidentId,
        currentIncident,
        updates,
        currentIncident.service_id,
        (currentIncident as any).service.team_id,
        teamData?.organization_id
      );

      // Create automatic update entry for significant changes
      if (updates.status && updates.status !== oldStatus) {
        const statusMessages = {
          investigating: 'Incident is being investigated',
          identified: 'Root cause has been identified',
          monitoring: 'Fix has been applied, monitoring for stability',
          resolved: 'Incident has been resolved'
        };

        await dbHelpers.createIncidentUpdate({
          incident_id: incidentId,
          message: statusMessages[updates.status as keyof typeof statusMessages] || 'Status updated',
          status: updates.status,
          author_id: userId
        });
      }

      res.json({
        success: true,
        data: updatedIncident,
        message: 'Incident updated successfully',
        changes: {
          status_changed: updates.status !== oldStatus,
          severity_changed: updates.severity !== oldSeverity
        }
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

// DELETE /api/incidents/:id - Delete incident
router.delete('/:incidentId',
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { incidentId } = req.params;

    const dbHelpers = new DatabaseHelpers(userId);

    try {
      // Get incident data before deletion
      const incident: IncidentWithUpdates | null = await dbHelpers.getIncidentById(incidentId);
      if (!incident) {
        return res.status(404).json({
          success: false,
          message: 'Incident not found',
          code: 'INCIDENT_NOT_FOUND'
        });
      }

      // Validate access
      const hasAccess = await teamHelpers.validateTeamAccess(userId, (incident as any).service.team_id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to incident',
          code: 'INCIDENT_ACCESS_DENIED'
        });
      }

      // Check if user has admin role for deletion
      const userRole = await teamHelpers.getUserTeamRole(userId, (incident as any).service.team_id);
      if (!['admin', 'owner'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Only admins can delete incidents',
          code: 'ADMIN_REQUIRED'
        });
      }

      // Prevent deletion of resolved incidents older than 24 hours (optional business rule)
      if (incident.status === 'resolved' && incident.resolved_at) {
        const resolvedAt = new Date(incident.resolved_at);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        if (resolvedAt < dayAgo) {
          return res.status(409).json({
            success: false,
            message: 'Cannot delete resolved incidents older than 24 hours',
            code: 'INCIDENT_TOO_OLD'
          });
        }
      }

      await dbHelpers.deleteIncident(incidentId);

      // Update service status after incident deletion
      await dbHelpers.updateServiceStatusBasedOnIncidents(incident.service_id);

      res.json({
        success: true,
        message: 'Incident deleted successfully',
        deleted_incident: {
          id: incidentId,
          title: incident.title,
          service_name: (incident as any).service?.name
        }
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

// POST /api/incidents/:id/updates - Add update to incident
router.post('/:incidentId/updates',
  validate(createIncidentUpdateSchema, 'body'),
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { incidentId } = req.params;
    const { message, status } = req.body;

    const dbHelpers = new DatabaseHelpers(userId);

    try {
      // Validate incident exists and user has access
      const incident: IncidentWithUpdates | null = await dbHelpers.getIncidentById(incidentId);
      if (!incident) {
        return res.status(404).json({
          success: false,
          message: 'Incident not found',
          code: 'INCIDENT_NOT_FOUND'
        });
      }

      const hasAccess = await teamHelpers.validateTeamAccess(userId, (incident as any).service.team_id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to incident',
          code: 'INCIDENT_ACCESS_DENIED'
        });
      }

      // Check minimum role
      const userRole = await teamHelpers.getUserTeamRole(userId, (incident as any).service.team_id);
      if (!['member', 'admin', 'owner'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to update incident',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      const oldStatus = incident.status;

      const update = await dbHelpers.createIncidentUpdate({
        incident_id: incidentId,
        message: message.trim(),
        status,
        author_id: userId
      });

      // Update incident status if provided and different
      if (status && status !== oldStatus) {
        await dbHelpers.updateIncident(incidentId, { status });

        // Update service status based on new incident status
        await dbHelpers.updateServiceStatusBasedOnIncidents(incident.service_id);

        // Get team info for notifications
        const { data: teamData } = await supabase
          .from('teams')
          .select('id, organization_id')
          .eq('id', (incident as any).service.team_id)
          .single();

        // WebSocket notification for incident update
        await wsService.notifyIncidentUpdated(
          incidentId,
          incident.service_id,
          (incident as any).service.team_id,
          teamData?.organization_id,
          {
            update_message: message,
            old_status: oldStatus,
            new_status: status,
            updated_by: userId
          }
        );
      }

      res.status(201).json({
        success: true,
        data: update,
        message: 'Incident update added successfully',
        status_changed: status !== oldStatus
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

// PATCH /api/incidents/:id/resolve - Resolve incident
router.patch('/:incidentId/resolve',
  validate(resolveIncidentSchema, 'body'),
  asyncHandler(async (req: any, res: any) => {
    const userId = req.userId!;
    const { incidentId } = req.params;
    const { resolution_message } = req.body;

    const dbHelpers = new DatabaseHelpers(userId);

    try {
      // Get incident data
      const incident: IncidentWithUpdates | null = await dbHelpers.getIncidentById(incidentId);
      if (!incident) {
        return res.status(404).json({
          success: false,
          message: 'Incident not found',
          code: 'INCIDENT_NOT_FOUND'
        });
      }

      // Validate access
      const hasAccess = await teamHelpers.validateTeamAccess(userId, (incident as any).service.team_id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to incident',
          code: 'INCIDENT_ACCESS_DENIED'
        });
      }

      // Check if incident is already resolved
      if (incident.status === 'resolved') {
        return res.status(409).json({
          success: false,
          message: 'Incident is already resolved',
          code: 'INCIDENT_ALREADY_RESOLVED'
        });
      }

      // Check minimum role
      const userRole = await teamHelpers.getUserTeamRole(userId, (incident as any).service.team_id);
      if (!['member', 'admin', 'owner'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to resolve incident',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Store old service status
      const oldServiceStatus = (incident as any).service?.status;

      // Resolve incident
      const resolvedIncident = await dbHelpers.resolveIncident(
        incidentId,
        resolution_message || 'Incident has been resolved'
      );

      // Get updated service status
      const { data: serviceData } = await supabase
        .from('services')
        .select('id, name, status')
        .eq('id', incident.service_id)
        .single();

      // Get team info for notifications
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, organization_id')
        .eq('id', (incident as any).service.team_id)
        .single();

      // WebSocket notification for incident resolution
      await wsService.notifyIncidentUpdated(
        incidentId,
        incident.service_id,
        (incident as any).service.team_id,
        teamData?.organization_id,
        {
          resolved: true,
          resolution_message: resolution_message || 'Incident has been resolved',
          resolved_by: userId,
          resolution_time: new Date().toISOString(),
          service_status: serviceData?.status
        }
      );

      // Notify service status change if service was restored
      if (serviceData && serviceData.status !== oldServiceStatus) {
        await wsService.notifyServiceStatusChange(
          incident.service_id,
          (incident as any).service.team_id,
          teamData?.organization_id,
          oldServiceStatus || 'unknown',
          serviceData.status,
          serviceData.name,
          userId
        );
      }

      // Calculate resolution time
      const createdAt = new Date(incident.created_at);
      const resolvedAt = new Date(resolvedIncident.resolved_at!);
      const resolutionTimeMinutes = Math.round((resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60));

      res.json({
        success: true,
        data: resolvedIncident,
        message: 'Incident resolved successfully',
        resolution: {
          resolved_at: resolvedIncident.resolved_at,
          resolution_time_minutes: resolutionTimeMinutes,
          resolution_time_hours: Math.round(resolutionTimeMinutes / 60 * 10) / 10,
          service_restored: serviceData?.status === 'operational',
          old_service_status: oldServiceStatus,
          new_service_status: serviceData?.status
        }
      });
    } finally {
      await dbHelpers.cleanup();
    }
  })
);

export default router;
