import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { supabase } from '../services/supabase';

// Extend Request interface to include user and tenant context
declare global {
  namespace Express {
    interface Request {
      user?: any;
      userId?: string;
      organizationId?: string;
      teamId?: string;
      serviceId?: string;
      incidentId?: string;
      maintenanceId?: string;
    }
  }
}

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'No token provided'
      });
      return;
    }

    // Verify the token with Clerk
    const payload = await clerkClient.verifyToken(token);

    if (!payload || !payload.sub) {
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
      return;
    }

    // Get user details from Clerk
    const user = await clerkClient.users.getUser(payload.sub);

    // Set user context for RLS policies
    await supabase.rpc('set_current_user_id', { user_clerk_id: user.id });

    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }
  next();
};
