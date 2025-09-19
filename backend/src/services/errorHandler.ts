import { Request, Response, NextFunction } from 'express';
import { DatabaseError } from '../types';

// Custom error classes
export class DatabaseAccessError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, code: string = 'DATABASE_ERROR', statusCode: number = 500, details?: any) {
    super(message);
    this.name = 'DatabaseAccessError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class TenantIsolationError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, code: string = 'TENANT_ISOLATION_ERROR', statusCode: number = 403) {
    super(message);
    this.name = 'TenantIsolationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends Error {
  public statusCode: number;
  public code: string;
  public fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>, code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.code = code;
    if (fields) {
      this.fields = fields;
    }
  }
}

// Error handling utilities
export class ErrorHandler {
  /**
   * Handle Supabase/PostgreSQL errors
   */
  static handleDatabaseError(error: any): DatabaseAccessError {
    console.error('Database error:', error);

    // PostgreSQL error codes
    switch (error.code) {
      case '23505': // unique_violation
        return new DatabaseAccessError(
          'A record with this value already exists',
          'DUPLICATE_RECORD',
          409,
          { constraint: error.constraint }
        );
      
      case '23503': // foreign_key_violation
        return new DatabaseAccessError(
          'Referenced record does not exist',
          'FOREIGN_KEY_VIOLATION',
          400,
          { constraint: error.constraint }
        );
      
      case '23514': // check_violation
        return new DatabaseAccessError(
          'Invalid data provided',
          'CHECK_VIOLATION',
          400,
          { constraint: error.constraint }
        );
      
      case '42501': // insufficient_privilege
        return new TenantIsolationError(
          'Access denied to resource',
          'INSUFFICIENT_PRIVILEGE',
          403
        );
      
      case 'PGRST116': // Supabase: no rows returned
        return new DatabaseAccessError(
          'Record not found',
          'RECORD_NOT_FOUND',
          404
        );
      
      case 'PGRST301': // Supabase: multiple rows returned
        return new DatabaseAccessError(
          'Multiple records found when expecting one',
          'MULTIPLE_RECORDS_FOUND',
          409
        );
      
      default:
        return new DatabaseAccessError(
          error.message || 'Database operation failed',
          'DATABASE_ERROR',
          500,
          { originalError: error }
        );
    }
  }

  /**
   * Handle authentication errors
   */
  static handleAuthError(error: any): DatabaseAccessError {
    console.error('Authentication error:', error);
    
    return new DatabaseAccessError(
      'Authentication failed',
      'AUTH_ERROR',
      401,
      { originalError: error.message }
    );
  }

  /**
   * Handle authorization errors
   */
  static handleAuthorizationError(resource: string, action: string): TenantIsolationError {
    return new TenantIsolationError(
      `Access denied: Cannot ${action} ${resource}`,
      'AUTHORIZATION_ERROR',
      403
    );
  }

  /**
   * Validate request data
   */
  static validateRequired(data: any, requiredFields: string[]): void {
    const missingFields: Record<string, string> = {};
    
    requiredFields.forEach(field => {
      if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
        missingFields[field] = `${field} is required`;
      }
    });

    if (Object.keys(missingFields).length > 0) {
      throw new ValidationError('Missing required fields', missingFields);
    }
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate slug format
   */
  static validateSlug(slug: string): boolean {
    const slugRegex = /^[a-z0-9-]+$/;
    return slugRegex.test(slug) && slug.length >= 3 && slug.length <= 50;
  }

  /**
   * Sanitize input data
   */
  static sanitizeInput(data: any): any {
    if (typeof data === 'string') {
      return data.trim();
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeInput(item));
    }
    
    if (data && typeof data === 'object') {
      const sanitized: any = {};
      Object.keys(data).forEach(key => {
        sanitized[key] = this.sanitizeInput(data[key]);
      });
      return sanitized;
    }
    
    return data;
  }
}

// Express error handling middleware
export const globalErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): any => {
  console.error('Global error handler:', error);

  // Handle custom errors
  if (error instanceof DatabaseAccessError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code,
      details: error.details
    });
  }

  if (error instanceof TenantIsolationError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code
    });
  }

  if (error instanceof ValidationError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code,
      fields: error.fields
    });
  }

  // Handle Supabase/PostgreSQL errors
  if (error.name === 'PostgrestError' || (error as any).code) {
    const dbError = ErrorHandler.handleDatabaseError(error);
    return res.status(dbError.statusCode).json({
      success: false,
      message: dbError.message,
      code: dbError.code,
      details: dbError.details
    });
  }

  // Handle Clerk errors
  if (error.name === 'ClerkError' || error.message?.includes('clerk')) {
    const authError = ErrorHandler.handleAuthError(error);
    return res.status(authError.statusCode).json({
      success: false,
      message: authError.message,
      code: authError.code
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      originalError: error.message 
    })
  });
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Request validation middleware
export const validateRequest = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const { body, params, query } = req;
      
      // Sanitize input
      req.body = ErrorHandler.sanitizeInput(body);
      req.params = ErrorHandler.sanitizeInput(params);
      req.query = ErrorHandler.sanitizeInput(query);
      
      // Validate against schema if provided
      if (schema) {
        // You can integrate with validation libraries like Joi, Yup, or Zod here
        // For now, we'll do basic validation
        if (schema.required) {
          ErrorHandler.validateRequired(req.body, schema.required);
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Rate limiting error
export class RateLimitError extends Error {
  public statusCode: number = 429;
  public code: string = 'RATE_LIMIT_EXCEEDED';
  
  constructor(message: string = 'Too many requests') {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Resource not found error
export class NotFoundError extends Error {
  public statusCode: number = 404;
  public code: string = 'RESOURCE_NOT_FOUND';
  
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}
