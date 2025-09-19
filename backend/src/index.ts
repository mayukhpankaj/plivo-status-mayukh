import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import services
import { WebSocketService } from './services/websocket';

// Import API router
import apiRouter from './routes/index';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize WebSocket service
const wsService = WebSocketService.getInstance();
wsService.initialize(server);

// Basic middleware for parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Status Page API',
    version: process.env.API_VERSION || '1.0.0',
    documentation: '/api/docs',
    health: '/api/health'
  });
});

// Webhook routes (before other middleware to handle raw body for signature verification)
import webhookRoutes from './routes/webhooks';
app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// API routes with comprehensive middleware
app.use('/api', apiRouter);

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
    suggestion: 'Check /api/docs for available endpoints'
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Status Page API Server running on port ${PORT}`);
  console.log(`📖 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 WebSocket Server: Initialized`);

  if (process.env.NODE_ENV === 'development') {
    console.log(`🔧 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
