import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';

// Import route modules
import authRoutes from './auth';
import organizationRoutes from './organizations';
import teamRoutes from './teams';
import serviceRoutes from './services';
import incidentRoutes from './incidents';
import maintenanceRoutes from './maintenances';
import publicRoutes from './public';
import webhookRoutes from './webhooks';

// Import middleware
import { globalErrorHandler } from '../services/errorHandler';

const router = Router();

// Security middleware
router.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
router.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:5174',
      'https://localhost:3000',
      'https://localhost:3001',
      'https://localhost:5173',
      'https://localhost:5174'
    ];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression middleware
router.use(compression());

// Request logging
router.use(morgan('combined', {
  skip: function (req, res) {
    // Skip logging for health checks and static assets
    return req.url === '/health' || req.url.startsWith('/static');
  }
}));

// Rate limiting
const createRateLimit = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// Different rate limits for different endpoints
const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  'Too many requests from this IP, please try again later'
);

const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  20, // limit each IP to 20 auth requests per windowMs
  'Too many authentication attempts, please try again later'
);

const webhookRateLimit = createRateLimit(
  1 * 60 * 1000, // 1 minute
  50, // limit each IP to 50 webhook requests per minute
  'Too many webhook requests, please try again later'
);

// Apply rate limiting
router.use('/auth', authRateLimit);
router.use('/webhooks', webhookRateLimit);
router.use(generalRateLimit);

// Health check endpoint (no auth required)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0'
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/teams', teamRoutes);
router.use('/services', serviceRoutes);
router.use('/incidents', incidentRoutes);
router.use('/maintenances', maintenanceRoutes);
router.use('/public', publicRoutes);
router.use('/webhooks', webhookRoutes);

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    success: true,
    message: 'Status Page API Documentation',
    version: process.env.API_VERSION || '1.0.0',
    endpoints: {
      auth: {
        description: 'Authentication and user management',
        routes: [
          'POST /auth/login',
          'POST /auth/logout',
          'GET /auth/me',
          'POST /auth/refresh'
        ]
      },
      organizations: {
        description: 'Organization management',
        routes: [
          'GET /organizations',
          'POST /organizations',
          'GET /organizations/:id',
          'PUT /organizations/:id',
          'DELETE /organizations/:id'
        ]
      },
      teams: {
        description: 'Team management within organizations',
        routes: [
          'GET /teams',
          'POST /teams',
          'GET /teams/:id',
          'PUT /teams/:id',
          'DELETE /teams/:id',
          'GET /teams/:id/members',
          'POST /teams/:id/members',
          'PUT /teams/:id/members/:userId',
          'DELETE /teams/:id/members/:userId'
        ]
      },
      services: {
        description: 'Service monitoring and management',
        routes: [
          'GET /services',
          'POST /services',
          'GET /services/:id',
          'PUT /services/:id',
          'DELETE /services/:id',
          'PATCH /services/:id/status'
        ]
      },
      incidents: {
        description: 'Incident management and tracking',
        routes: [
          'GET /incidents',
          'POST /incidents',
          'GET /incidents/:id',
          'PUT /incidents/:id',
          'DELETE /incidents/:id',
          'POST /incidents/:id/updates'
        ]
      },
      maintenances: {
        description: 'Scheduled maintenance management',
        routes: [
          'GET /maintenances',
          'POST /maintenances',
          'GET /maintenances/:id',
          'PUT /maintenances/:id',
          'DELETE /maintenances/:id'
        ]
      },
      public: {
        description: 'Public status page data (no auth required)',
        routes: [
          'GET /public/:orgSlug',
          'GET /public/:orgSlug/:teamSlug',
          'GET /public/:orgSlug/incidents',
          'GET /public/:orgSlug/maintenances'
        ]
      },
      webhooks: {
        description: 'Webhook endpoints for external integrations',
        routes: [
          'POST /webhooks/clerk',
          'POST /webhooks/stripe'
        ]
      }
    },
    authentication: {
      type: 'Bearer Token (JWT)',
      header: 'Authorization: Bearer <token>',
      description: 'Most endpoints require authentication via Clerk JWT tokens'
    },
    rateLimit: {
      general: '100 requests per 15 minutes',
      auth: '20 requests per 15 minutes',
      webhooks: '50 requests per minute'
    }
  });
});

// 404 handler for unknown routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: '/api/docs'
  });
});

// Global error handler
router.use(globalErrorHandler);

export default router;
