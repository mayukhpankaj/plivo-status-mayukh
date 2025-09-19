import { supabase } from './supabase';
import { Request } from 'express';

export interface AuditLogEntry {
  user_id: string;
  organization_id: string;
  team_id?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  metadata?: any;
}

export class AuditLogger {
  /**
   * Log an audit event
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert({
          ...entry,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to log audit entry:', error);
      }
    } catch (error) {
      console.error('Audit logging error:', error);
    }
  }

  /**
   * Log service creation
   */
  static async logServiceCreated(
    req: Request,
    serviceId: string,
    serviceData: any,
    teamId: string,
    organizationId: string
  ): Promise<void> {
    await this.log({
      user_id: req.userId!,
      organization_id: organizationId,
      team_id: teamId,
      action: 'CREATE',
      resource_type: 'SERVICE',
      resource_id: serviceId,
      new_values: serviceData,
      ip_address: this.getClientIP(req),
      user_agent: req.get('User-Agent'),
      metadata: {
        endpoint: req.originalUrl,
        method: req.method
      }
    });
  }

  /**
   * Log service status change
   */
  static async logServiceStatusChanged(
    req: Request,
    serviceId: string,
    oldStatus: string,
    newStatus: string,
    serviceName: string,
    teamId: string,
    organizationId: string
  ): Promise<void> {
    await this.log({
      user_id: req.userId!,
      organization_id: organizationId,
      team_id: teamId,
      action: 'STATUS_CHANGE',
      resource_type: 'SERVICE',
      resource_id: serviceId,
      old_values: { status: oldStatus },
      new_values: { status: newStatus },
      ip_address: this.getClientIP(req),
      user_agent: req.get('User-Agent'),
      metadata: {
        service_name: serviceName,
        endpoint: req.originalUrl,
        method: req.method,
        status_change: `${oldStatus} → ${newStatus}`
      }
    });
  }

  /**
   * Log service update
   */
  static async logServiceUpdated(
    req: Request,
    serviceId: string,
    oldValues: any,
    newValues: any,
    teamId: string,
    organizationId: string
  ): Promise<void> {
    await this.log({
      user_id: req.userId!,
      organization_id: organizationId,
      team_id: teamId,
      action: 'UPDATE',
      resource_type: 'SERVICE',
      resource_id: serviceId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: this.getClientIP(req),
      user_agent: req.get('User-Agent'),
      metadata: {
        endpoint: req.originalUrl,
        method: req.method
      }
    });
  }

  /**
   * Log service deletion
   */
  static async logServiceDeleted(
    req: Request,
    serviceId: string,
    serviceData: any,
    teamId: string,
    organizationId: string
  ): Promise<void> {
    await this.log({
      user_id: req.userId!,
      organization_id: organizationId,
      team_id: teamId,
      action: 'DELETE',
      resource_type: 'SERVICE',
      resource_id: serviceId,
      old_values: serviceData,
      ip_address: this.getClientIP(req),
      user_agent: req.get('User-Agent'),
      metadata: {
        endpoint: req.originalUrl,
        method: req.method
      }
    });
  }

  /**
   * Log incident creation
   */
  static async logIncidentCreated(
    req: Request,
    incidentId: string,
    incidentData: any,
    serviceId: string,
    teamId: string,
    organizationId: string
  ): Promise<void> {
    await this.log({
      user_id: req.userId!,
      organization_id: organizationId,
      team_id: teamId,
      action: 'CREATE',
      resource_type: 'INCIDENT',
      resource_id: incidentId,
      new_values: incidentData,
      ip_address: this.getClientIP(req),
      user_agent: req.get('User-Agent'),
      metadata: {
        service_id: serviceId,
        endpoint: req.originalUrl,
        method: req.method
      }
    });
  }

  /**
   * Log incident update
   */
  static async logIncidentUpdated(
    req: Request,
    incidentId: string,
    oldValues: any,
    newValues: any,
    serviceId: string,
    teamId: string,
    organizationId: string
  ): Promise<void> {
    await this.log({
      user_id: req.userId!,
      organization_id: organizationId,
      team_id: teamId,
      action: 'UPDATE',
      resource_type: 'INCIDENT',
      resource_id: incidentId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: this.getClientIP(req),
      user_agent: req.get('User-Agent'),
      metadata: {
        service_id: serviceId,
        endpoint: req.originalUrl,
        method: req.method
      }
    });
  }

  /**
   * Get audit logs for a resource
   */
  static async getAuditLogs(
    resourceType: string,
    resourceId: string,
    organizationId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to fetch audit logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
  }

  /**
   * Extract client IP address from request
   */
  private static getClientIP(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      req.get('X-Forwarded-For') ||
      req.get('X-Real-IP') ||
      'unknown'
    );
  }
}
