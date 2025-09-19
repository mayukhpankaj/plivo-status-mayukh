import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase';

// Middleware to set organization context from headers or params
export const setOrganizationContext = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get organization ID from headers, params, or query
    const organizationId = req.headers['x-organization-id'] as string || 
                          req.params.organizationId || 
                          req.query.organizationId as string;

    if (organizationId) {
      // Verify user has access to this organization
      const { data: userOrgs, error } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', organizationId)
        .single();

      if (error || !userOrgs) {
        res.status(403).json({
          success: false,
          message: 'Access denied to organization'
        });
        return;
      }

      req.organizationId = organizationId;
    }

    next();
  } catch (error) {
    console.error('Organization context error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set organization context'
    });
  }
};

// Middleware to require organization context
export const requireOrganization = (req: Request, res: Response, next: NextFunction) => {
  if (!req.organizationId) {
    res.status(400).json({
      success: false,
      message: 'Organization context required'
    });
    return;
  }
  next();
};

// Middleware to set team context
export const setTeamContext = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get team ID from headers, params, or query
    const teamId = req.headers['x-team-id'] as string || 
                   req.params.teamId || 
                   req.query.teamId as string;

    if (teamId) {
      // Verify user has access to this team
      const { data: userTeam, error } = await supabase
        .from('teams')
        .select('id, organization_id')
        .eq('id', teamId)
        .single();

      if (error || !userTeam) {
        res.status(403).json({
          success: false,
          message: 'Access denied to team'
        });
        return;
      }

      req.teamId = teamId;
      
      // Also set organization context if not already set
      if (!req.organizationId) {
        req.organizationId = userTeam.organization_id;
      }
    }

    next();
  } catch (error) {
    console.error('Team context error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set team context'
    });
  }
};

// Middleware to require team context
export const requireTeam = (req: Request, res: Response, next: NextFunction) => {
  if (!req.teamId) {
    res.status(400).json({
      success: false,
      message: 'Team context required'
    });
    return;
  }
  next();
};

// Helper function to check if user has minimum role in team
export const requireTeamRole = (minRole: 'viewer' | 'member' | 'admin' | 'owner') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.teamId || !req.userId) {
        res.status(400).json({
          success: false,
          message: 'Team and user context required'
        });
        return;
      }

      // Check if user is organization owner (has access to all teams)
      const { data: orgOwner } = await supabase
        .from('teams')
        .select('organization_id, organizations!inner(owner_id)')
        .eq('id', req.teamId)
        .single();

      if (orgOwner?.organizations?.[0]?.owner_id === req.userId) {
        next();
        return;
      }

      // Check user's role in the team
      const { data: teamMember, error } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', req.teamId)
        .eq('user_id', req.userId)
        .single();

      if (error || !teamMember) {
        res.status(403).json({
          success: false,
          message: 'Access denied to team'
        });
        return;
      }

      // Define role hierarchy
      const roleHierarchy = {
        viewer: 1,
        member: 2,
        admin: 3,
        owner: 4
      };

      const userRoleLevel = roleHierarchy[teamMember.role as keyof typeof roleHierarchy];
      const minRoleLevel = roleHierarchy[minRole];

      if (userRoleLevel < minRoleLevel) {
        res.status(403).json({
          success: false,
          message: `Insufficient permissions. Required role: ${minRole}`
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Team role check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify team permissions'
      });
    }
  };
};

// Helper function to check if user is organization owner
export const requireOrganizationOwner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId || !req.userId) {
      res.status(400).json({
        success: false,
        message: 'Organization and user context required'
      });
      return;
    }

    const { data: org, error } = await supabase
      .from('organizations')
      .select('owner_id')
      .eq('id', req.organizationId)
      .single();

    if (error || !org || org.owner_id !== req.userId) {
      res.status(403).json({
        success: false,
        message: 'Organization owner access required'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Organization owner check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify organization ownership'
    });
  }
};
