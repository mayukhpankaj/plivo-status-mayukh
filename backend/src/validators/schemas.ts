import Joi from 'joi';

// Common schemas
export const uuidSchema = Joi.string().uuid().required();
export const paginationSchema = {
  page: Joi.number().integer().min(1).max(1000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
};

// Service schemas
export const createServiceSchema = Joi.object({
  team_id: uuidSchema,
  name: Joi.string().trim().min(2).max(100).required()
    .pattern(/^[a-zA-Z0-9\s\-_\.]+$/)
    .messages({
      'string.pattern.base': 'Service name can only contain letters, numbers, spaces, hyphens, underscores, and dots'
    }),
  description: Joi.string().trim().max(500).allow(null, '')
});

export const updateServiceSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100)
    .pattern(/^[a-zA-Z0-9\s\-_\.]+$/)
    .messages({
      'string.pattern.base': 'Service name can only contain letters, numbers, spaces, hyphens, underscores, and dots'
    }),
  description: Joi.string().trim().max(500).allow(null, ''),
  status: Joi.string().valid('operational', 'degraded', 'partial_outage', 'major_outage')
}).min(1);

export const updateServiceStatusSchema = Joi.object({
  status: Joi.string().valid('operational', 'degraded', 'partial_outage', 'major_outage').required()
});

export const serviceFiltersSchema = Joi.object({
  team_id: Joi.string().uuid(),
  status: Joi.string().valid('operational', 'degraded', 'partial_outage', 'major_outage'),
  search: Joi.string().trim().min(2).max(100),
  ...paginationSchema
});

// Incident schemas
export const createIncidentSchema = Joi.object({
  service_id: uuidSchema,
  title: Joi.string().trim().min(5).max(200).required(),
  description: Joi.string().trim().max(2000).allow(null, ''),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').required()
});

export const updateIncidentSchema = Joi.object({
  title: Joi.string().trim().min(5).max(200),
  description: Joi.string().trim().max(2000).allow(null, ''),
  status: Joi.string().valid('investigating', 'identified', 'monitoring', 'resolved'),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical')
}).min(1);

export const incidentFiltersSchema = Joi.object({
  service_id: Joi.string().uuid(),
  team_id: Joi.string().uuid(),
  status: Joi.string().valid('investigating', 'identified', 'monitoring', 'resolved'),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical'),
  ...paginationSchema
});

// Incident update schemas
export const createIncidentUpdateSchema = Joi.object({
  message: Joi.string().trim().min(10).max(1000).required(),
  status: Joi.string().valid('investigating', 'identified', 'monitoring', 'resolved').required()
});

// Incident resolution schema
export const resolveIncidentSchema = Joi.object({
  resolution_message: Joi.string().trim().min(10).max(1000).allow('', null)
});

// Maintenance schemas
export const createMaintenanceSchema = Joi.object({
  service_id: uuidSchema,
  title: Joi.string().trim().min(5).max(200).required(),
  description: Joi.string().trim().max(2000).allow(null, ''),
  scheduled_start: Joi.date().iso().required(),
  scheduled_end: Joi.date().iso().greater(Joi.ref('scheduled_start')).required()
});

export const updateMaintenanceSchema = Joi.object({
  title: Joi.string().trim().min(5).max(200),
  description: Joi.string().trim().max(2000).allow(null, ''),
  scheduled_start: Joi.date().iso(),
  scheduled_end: Joi.date().iso(),
  status: Joi.string().valid('scheduled', 'in_progress', 'completed', 'cancelled')
}).min(1);

export const maintenanceFiltersSchema = Joi.object({
  service_id: Joi.string().uuid(),
  team_id: Joi.string().uuid(),
  status: Joi.string().valid('scheduled', 'in_progress', 'completed', 'cancelled'),
  upcoming: Joi.boolean(),
  ...paginationSchema
});

// Organization schemas
export const createOrganizationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  slug: Joi.string().trim().min(3).max(50).required()
    .pattern(/^[a-z0-9-]+$/)
    .messages({
      'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens'
    })
});

export const updateOrganizationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  slug: Joi.string().trim().min(3).max(50)
    .pattern(/^[a-z0-9-]+$/)
    .messages({
      'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens'
    })
}).min(1);

// Team schemas
export const createTeamSchema = Joi.object({
  organization_id: uuidSchema,
  name: Joi.string().trim().min(2).max(100).required(),
  slug: Joi.string().trim().min(3).max(50).required()
    .pattern(/^[a-z0-9-]+$/)
    .messages({
      'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens'
    })
});

export const updateTeamSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  slug: Joi.string().trim().min(3).max(50)
    .pattern(/^[a-z0-9-]+$/)
    .messages({
      'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens'
    })
}).min(1);

// Team member schemas
export const addTeamMemberSchema = Joi.object({
  user_id: Joi.string().required(), // Clerk user ID
  role: Joi.string().valid('viewer', 'member', 'admin', 'owner').default('member')
});

export const updateTeamMemberSchema = Joi.object({
  role: Joi.string().valid('viewer', 'member', 'admin', 'owner').required()
});

// Search schemas
export const searchSchema = Joi.object({
  query: Joi.string().trim().min(2).max(100).required(),
  team_id: Joi.string().uuid(),
  type: Joi.string().valid('services', 'incidents', 'maintenances'),
  ...paginationSchema
});

// Public status page schemas
export const publicStatusFiltersSchema = Joi.object({
  organization_slug: Joi.string().trim().required(),
  team_slug: Joi.string().trim(),
  include_incidents: Joi.boolean().default(true),
  include_maintenances: Joi.boolean().default(true),
  days: Joi.number().integer().min(1).max(90).default(7)
});

// Validation middleware factory
export const validate = (schema: Joi.ObjectSchema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors: Record<string, string> = {};
      error.details.forEach(detail => {
        const key = detail.path.join('.');
        errors[key] = detail.message;
      });

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors
      });
    }

    // Replace the request property with the validated and sanitized value
    req[property] = value;
    next();
  };
};

// Combined validation for multiple properties
export const validateMultiple = (validations: Array<{
  schema: Joi.ObjectSchema;
  property: 'body' | 'query' | 'params';
}>) => {
  return (req: any, res: any, next: any) => {
    const allErrors: Record<string, string> = {};

    for (const validation of validations) {
      const { error, value } = validation.schema.validate(req[validation.property], {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        error.details.forEach(detail => {
          const key = `${validation.property}.${detail.path.join('.')}`;
          allErrors[key] = detail.message;
        });
      } else {
        req[validation.property] = value;
      }
    }

    if (Object.keys(allErrors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: allErrors
      });
    }

    next();
  };
};
