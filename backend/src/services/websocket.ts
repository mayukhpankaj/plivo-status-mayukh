import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { teamHelpers, organizationHelpers } from './supabase';

export interface WebSocketNotification {
  type: 'service_status_change' | 'incident_created' | 'incident_updated' | 'maintenance_scheduled';
  data: any;
  organizationId: string;
  teamId?: string;
  serviceId?: string;
  timestamp: string;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    if (!this.io) return;

    // Authentication middleware for WebSocket connections
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || 
                     socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify token using Clerk
        const payload = await clerkClient.verifyToken(token);
        
        if (!payload || !payload.sub) {
          return next(new Error('Invalid token'));
        }

        // Get user details
        const user = await clerkClient.users.getUser(payload.sub);
        socket.data.user = user;
        socket.data.userId = user.id;

        next();
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      const userId = socket.data.userId;
      console.log(`User ${userId} connected via WebSocket`);

      // Track connected user
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(socket.id);

      // Join user to their organization and team rooms
      this.joinUserRooms(socket);

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${userId} disconnected from WebSocket`);
        
        const userSockets = this.connectedUsers.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            this.connectedUsers.delete(userId);
          }
        }
      });

      // Handle room subscription
      socket.on('subscribe_to_team', async (teamId: string) => {
        try {
          const hasAccess = await teamHelpers.validateTeamAccess(userId, teamId);
          if (hasAccess) {
            socket.join(`team:${teamId}`);
            socket.emit('subscribed', { room: `team:${teamId}` });
          } else {
            socket.emit('error', { message: 'Access denied to team' });
          }
        } catch (error) {
          socket.emit('error', { message: 'Failed to subscribe to team' });
        }
      });

      socket.on('unsubscribe_from_team', (teamId: string) => {
        socket.leave(`team:${teamId}`);
        socket.emit('unsubscribed', { room: `team:${teamId}` });
      });
    });
  }

  private async joinUserRooms(socket: any): Promise<void> {
    try {
      const userId = socket.data.userId;

      // Get user's organizations and teams
      const [organizations, teams] = await Promise.all([
        organizationHelpers.getUserOrganizations(userId),
        teamHelpers.getUserTeams(userId)
      ]);

      // Join organization rooms
      organizations.forEach(org => {
        socket.join(`org:${org.id}`);
      });

      // Join team rooms
      teams.forEach((teamMember: any) => {
        socket.join(`team:${teamMember.teams.id}`);
      });

      console.log(`User ${userId} joined ${organizations.length} org rooms and ${teams.length} team rooms`);
    } catch (error) {
      console.error('Error joining user rooms:', error);
    }
  }

  // Notification methods
  public async notifyServiceStatusChange(
    serviceId: string,
    teamId: string,
    organizationId: string,
    oldStatus: string,
    newStatus: string,
    serviceName: string,
    changedBy: string
  ): Promise<void> {
    if (!this.io) return;

    const notification: WebSocketNotification = {
      type: 'service_status_change',
      data: {
        serviceId,
        serviceName,
        oldStatus,
        newStatus,
        changedBy
      },
      organizationId,
      teamId,
      serviceId,
      timestamp: new Date().toISOString()
    };

    // Notify team members
    this.io.to(`team:${teamId}`).emit('service_status_changed', notification);

    // Notify organization members
    this.io.to(`org:${organizationId}`).emit('service_status_changed', notification);
  }

  public async notifyIncidentCreated(
    incidentId: string,
    serviceId: string,
    teamId: string,
    organizationId: string,
    incidentData: any
  ): Promise<void> {
    if (!this.io) return;

    const notification: WebSocketNotification = {
      type: 'incident_created',
      data: {
        incidentId,
        serviceId,
        ...incidentData
      },
      organizationId,
      teamId,
      serviceId,
      timestamp: new Date().toISOString()
    };

    this.io.to(`team:${teamId}`).emit('incident_created', notification);
    this.io.to(`org:${organizationId}`).emit('incident_created', notification);
  }

  public async notifyIncidentUpdated(
    incidentId: string,
    serviceId: string,
    teamId: string,
    organizationId: string,
    updateData: any
  ): Promise<void> {
    if (!this.io) return;

    const notification: WebSocketNotification = {
      type: 'incident_updated',
      data: {
        incidentId,
        serviceId,
        ...updateData
      },
      organizationId,
      teamId,
      serviceId,
      timestamp: new Date().toISOString()
    };

    this.io.to(`team:${teamId}`).emit('incident_updated', notification);
    this.io.to(`org:${organizationId}`).emit('incident_updated', notification);
  }

  public async notifyMaintenanceScheduled(
    maintenanceId: string,
    serviceId: string,
    teamId: string,
    organizationId: string,
    maintenanceData: any
  ): Promise<void> {
    if (!this.io) return;

    const notification: WebSocketNotification = {
      type: 'maintenance_scheduled',
      data: {
        maintenanceId,
        serviceId,
        ...maintenanceData
      },
      organizationId,
      teamId,
      serviceId,
      timestamp: new Date().toISOString()
    };

    this.io.to(`team:${teamId}`).emit('maintenance_scheduled', notification);
    this.io.to(`org:${organizationId}`).emit('maintenance_scheduled', notification);
  }

  // Utility methods
  public isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getConnectedUserCount(): number {
    return this.connectedUsers.size;
  }

  public async sendToUser(userId: string, event: string, data: any): Promise<void> {
    if (!this.io) return;

    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        this.io!.to(socketId).emit(event, data);
      });
    }
  }

  public broadcast(event: string, data: any): void {
    if (!this.io) return;
    this.io.emit(event, data);
  }
}
