import { Request, Response, NextFunction } from 'express';
import { organizationHelpers, teamHelpers } from '../services/supabase';
import { TeamMemberRole } from '../types';

// Custom error class for tenant access errors
export class TenantAccessError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 403, code: string = 'ACCESS_DENIED') {
    super(message);
    this.name = 'TenantAccessError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Middleware to validate organization access
export const validateOrganizationAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.userId;
    const organizationId = req.organizationId || req.params.organizationId;

    if (!userId) {
      throw new TenantAccessError('User authentication required', 401, 'AUTH_REQUIRED');
    }

    if (!organizationId) {
      throw new TenantAccessError('Organization context required', 400, 'ORG_CONTEXT_REQUIRED');
    }

    const hasAccess = await organizationHelpers.validateOrganizationAccess(userId, organizationId);
    
    if (!hasAccess) {
      throw new TenantAccessError(
        'Access denied to organization', 
        403, 
        'ORG_ACCESS_DENIED'
      );
    }

    // Set organization context if not already set
    if (!req.organizationId) {
      req.organizationId = organizationId;
    }

    next();
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }

    console.error('Organization access validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate organization access',
      code: 'VALIDATION_ERROR'
    });
  }
};

// Middleware to validate team access
export const validateTeamAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.userId;
    const teamId = req.teamId || req.params.teamId;

    if (!userId) {
      throw new TenantAccessError('User authentication required', 401, 'AUTH_REQUIRED');
    }

    if (!teamId) {
      throw new TenantAccessError('Team context required', 400, 'TEAM_CONTEXT_REQUIRED');
    }

    const hasAccess = await teamHelpers.validateTeamAccess(userId, teamId);
    
    if (!hasAccess) {
      throw new TenantAccessError(
        'Access denied to team', 
        403, 
        'TEAM_ACCESS_DENIED'
      );
    }

    // Set team context if not already set
    if (!req.teamId) {
      req.teamId = teamId;
    }

    next();
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }

    console.error('Team access validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate team access',
      code: 'VALIDATION_ERROR'
    });
  }
};

// Middleware to require organization ownership
export const requireOrganizationOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.userId;
    const organizationId = req.organizationId || req.params.organizationId;

    if (!userId || !organizationId) {
      throw new TenantAccessError('User and organization context required', 400, 'CONTEXT_REQUIRED');
    }

    const isOwner = await organizationHelpers.isOrganizationOwner(userId, organizationId);
    
    if (!isOwner) {
      throw new TenantAccessError(
        'Organization owner access required', 
        403, 
        'OWNER_ACCESS_REQUIRED'
      );
    }

    next();
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }

    console.error('Organization ownership validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate organization ownership',
      code: 'VALIDATION_ERROR'
    });
  }
};

// Middleware factory to require minimum team role
export const requireMinimumTeamRole = (minRole: TeamMemberRole) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const userId = req.userId;
      const teamId = req.teamId || req.params.teamId;

      if (!userId || !teamId) {
        throw new TenantAccessError('User and team context required', 400, 'CONTEXT_REQUIRED');
      }

      const hasRole = await teamHelpers.hasMinimumTeamRole(userId, teamId, minRole);
      
      if (!hasRole) {
        throw new TenantAccessError(
          `Minimum role required: ${minRole}`, 
          403, 
          'INSUFFICIENT_ROLE'
        );
      }

      next();
    } catch (error) {
      if (error instanceof TenantAccessError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code
        });
      }

      console.error('Team role validation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to validate team role',
        code: 'VALIDATION_ERROR'
      });
    }
  };
};

// Middleware to extract and validate service access
export const validateServiceAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.userId;
    const serviceId = req.params.serviceId;

    if (!userId) {
      throw new TenantAccessError('User authentication required', 401, 'AUTH_REQUIRED');
    }

    if (!serviceId) {
      throw new TenantAccessError('Service ID required', 400, 'SERVICE_ID_REQUIRED');
    }

    // Get service and validate access through team membership
    const { TenantQueryBuilder } = await import('../services/queryBuilder');
    const queryBuilder = new TenantQueryBuilder(userId);
    
    try {
      const service = await queryBuilder.getServiceById(serviceId);
      
      if (!service) {
        throw new TenantAccessError('Service not found', 404, 'SERVICE_NOT_FOUND');
      }

      // Set service context
      req.serviceId = serviceId;
      req.teamId = service.team_id;

      next();
    } finally {
      await queryBuilder.clearContext();
    }
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }

    console.error('Service access validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate service access',
      code: 'VALIDATION_ERROR'
    });
  }
};

// Middleware to extract and validate incident access
export const validateIncidentAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.userId;
    const incidentId = req.params.incidentId;

    if (!userId) {
      throw new TenantAccessError('User authentication required', 401, 'AUTH_REQUIRED');
    }

    if (!incidentId) {
      throw new TenantAccessError('Incident ID required', 400, 'INCIDENT_ID_REQUIRED');
    }

    // Get incident and validate access through team membership
    const { TenantQueryBuilder } = await import('../services/queryBuilder');
    const queryBuilder = new TenantQueryBuilder(userId);
    
    try {
      const incident = await queryBuilder.getIncidentById(incidentId);
      
      if (!incident) {
        throw new TenantAccessError('Incident not found', 404, 'INCIDENT_NOT_FOUND');
      }

      // Set incident context
      req.incidentId = incidentId;
      req.serviceId = incident.service_id;
      req.teamId = incident.service_id; // We'll get team_id from service later if needed

      next();
    } finally {
      await queryBuilder.clearContext();
    }
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }

    console.error('Incident access validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate incident access',
      code: 'VALIDATION_ERROR'
    });
  }
};

// Error handler for tenant access errors
export const handleTenantAccessError = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): any => {
  if (error instanceof TenantAccessError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code
    });
  }

  // Pass to next error handler
  next(error);
};
