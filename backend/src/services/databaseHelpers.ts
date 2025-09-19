import { supabase, rlsHelpers, organizationHelpers, teamHelpers } from './supabase';
import { TenantQueryBuilder } from './queryBuilder';
import {
  Organization,
  Team,
  TeamMember,
  Service,
  Incident,
  Maintenance,
  TeamMemberRole,
  ServiceStatus,
  IncidentStatus,
  MaintenanceStatus,
  ServiceStatusSummary,
  IncidentSummary,
  TeamDashboard,
  IncidentWithUpdates
} from '../types';

/**
 * High-level database operations with automatic tenant context
 */
export class DatabaseHelpers {
  private clerkUserId: string;
  private queryBuilder: TenantQueryBuilder;

  constructor(clerkUserId: string) {
    this.clerkUserId = clerkUserId;
    this.queryBuilder = new TenantQueryBuilder(clerkUserId);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.queryBuilder.clearContext();
  }

  // Organization operations
  async getUserOrganizations(): Promise<Organization[]> {
    return organizationHelpers.getUserOrganizations(this.clerkUserId);
  }

  async createOrganization(orgData: { name: string; slug: string }): Promise<Organization> {
    return organizationHelpers.createOrganization(this.clerkUserId, orgData);
  }

  async isOrganizationOwner(organizationId: string): Promise<boolean> {
    return organizationHelpers.isOrganizationOwner(this.clerkUserId, organizationId);
  }

  // Team operations
  async getUserTeams(): Promise<any[]> {
    return teamHelpers.getUserTeams(this.clerkUserId);
  }

  async getUserTeamRole(teamId: string): Promise<TeamMemberRole | null> {
    return teamHelpers.getUserTeamRole(this.clerkUserId, teamId);
  }

  async hasMinimumTeamRole(teamId: string, minRole: TeamMemberRole): Promise<boolean> {
    return teamHelpers.hasMinimumTeamRole(this.clerkUserId, teamId, minRole);
  }

  // Service operations
  async getServices(filters: any = {}): Promise<Service[]> {
    return this.queryBuilder.getServices(filters);
  }

  async getServiceById(serviceId: string): Promise<Service | null> {
    return this.queryBuilder.getServiceById(serviceId);
  }

  async createService(serviceData: {
    team_id: string;
    name: string;
    description?: string;
  }): Promise<Service> {
    return this.queryBuilder.createService(serviceData);
  }

  async updateService(serviceId: string, updates: Partial<Service>): Promise<Service> {
    return this.queryBuilder.updateService(serviceId, updates);
  }

  async deleteService(serviceId: string): Promise<void> {
    return this.queryBuilder.deleteService(serviceId);
  }

  // Incident operations
  async getIncidents(filters: any = {}): Promise<IncidentWithUpdates[]> {
    return this.queryBuilder.getIncidents(filters);
  }

  async getIncidentById(incidentId: string): Promise<IncidentWithUpdates | null> {
    return this.queryBuilder.getIncidentById(incidentId);
  }

  async createIncident(incidentData: {
    service_id: string;
    title: string;
    description?: string;
    severity: string;
  }): Promise<Incident> {
    await rlsHelpers.setUserContext(this.clerkUserId);
    
    try {
      const { data, error } = await supabase
        .from('incidents')
        .insert({
          ...incidentData,
          status: 'investigating'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } finally {
      await rlsHelpers.clearUserContext();
    }
  }

  async updateIncident(incidentId: string, updates: Partial<Incident>): Promise<Incident> {
    await rlsHelpers.setUserContext(this.clerkUserId);

    try {
      // If resolving incident, set resolved_at timestamp
      if (updates.status === 'resolved' && !updates.resolved_at) {
        updates.resolved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('incidents')
        .update(updates)
        .eq('id', incidentId)
        .select(`
          *,
          services (
            id,
            name,
            status,
            team_id,
            teams (
              id,
              name,
              organization_id
            )
          )
        `)
        .single();

      if (error) throw error;
      return data;
    } finally {
      await rlsHelpers.clearUserContext();
    }
  }

  async deleteIncident(incidentId: string): Promise<void> {
    await rlsHelpers.setUserContext(this.clerkUserId);

    try {
      const { error } = await supabase
        .from('incidents')
        .delete()
        .eq('id', incidentId);

      if (error) throw error;
    } finally {
      await rlsHelpers.clearUserContext();
    }
  }

  async createIncidentUpdate(updateData: {
    incident_id: string;
    message: string;
    status: string;
    author_id: string;
  }): Promise<any> {
    await rlsHelpers.setUserContext(this.clerkUserId);

    try {
      const { data, error } = await supabase
        .from('incident_updates')
        .insert(updateData)
        .select(`
          *,
          incidents (
            id,
            title,
            service_id,
            services (
              id,
              name,
              team_id
            )
          )
        `)
        .single();

      if (error) throw error;
      return data;
    } finally {
      await rlsHelpers.clearUserContext();
    }
  }

  async getIncidentUpdates(incidentId: string): Promise<any[]> {
    await rlsHelpers.setUserContext(this.clerkUserId);

    try {
      const { data, error } = await supabase
        .from('incident_updates')
        .select('*')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } finally {
      await rlsHelpers.clearUserContext();
    }
  }

  async resolveIncident(incidentId: string, resolutionMessage?: string): Promise<Incident> {
    await rlsHelpers.setUserContext(this.clerkUserId);

    try {
      // Get current incident to check service
      const incident = await this.getIncidentById(incidentId);
      if (!incident) {
        throw new Error('Incident not found');
      }

      // Update incident status to resolved
      const resolvedIncident = await this.updateIncident(incidentId, {
        status: 'resolved',
        resolved_at: new Date().toISOString()
      });

      // Add resolution update if message provided
      if (resolutionMessage) {
        await this.createIncidentUpdate({
          incident_id: incidentId,
          message: resolutionMessage,
          status: 'resolved',
          author_id: this.clerkUserId
        });
      }

      // Check if service should be restored to operational
      await this.updateServiceStatusBasedOnIncidents(incident.service_id);

      return resolvedIncident;
    } finally {
      await rlsHelpers.clearUserContext();
    }
  }

  async updateServiceStatusBasedOnIncidents(serviceId: string): Promise<void> {
    await rlsHelpers.setUserContext(this.clerkUserId);

    try {
      // Get all active incidents for this service
      const { data: activeIncidents, error } = await supabase
        .from('incidents')
        .select('severity, status')
        .eq('service_id', serviceId)
        .neq('status', 'resolved');

      if (error) throw error;

      let newStatus: string = 'operational';

      if (activeIncidents && activeIncidents.length > 0) {
        // Determine service status based on highest severity active incident
        const hasCritical = activeIncidents.some(i => i.severity === 'critical');
        const hasHigh = activeIncidents.some(i => i.severity === 'high');
        const hasMedium = activeIncidents.some(i => i.severity === 'medium');

        if (hasCritical) {
          newStatus = 'major_outage';
        } else if (hasHigh) {
          newStatus = 'partial_outage';
        } else if (hasMedium) {
          newStatus = 'degraded';
        } else {
          newStatus = 'degraded'; // Low severity incidents
        }
      }

      // Update service status
      await supabase
        .from('services')
        .update({ status: newStatus })
        .eq('id', serviceId);

    } finally {
      await rlsHelpers.clearUserContext();
    }
  }

  // Maintenance operations
  async getMaintenances(filters: any = {}): Promise<Maintenance[]> {
    return this.queryBuilder.getMaintenances(filters);
  }

  async getMaintenanceById(maintenanceId: string): Promise<Maintenance | null> {
    return this.queryBuilder.getMaintenanceById(maintenanceId);
  }

  async createMaintenance(maintenanceData: {
    service_id: string;
    title: string;
    description?: string;
    scheduled_start: string;
    scheduled_end: string;
  }): Promise<Maintenance> {
    await rlsHelpers.setUserContext(this.clerkUserId);

    try {
      const { data, error } = await supabase
        .from('maintenances')
        .insert({
          ...maintenanceData,
          status: 'scheduled',
          created_by: this.clerkUserId
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } finally {
      await rlsHelpers.clearUserContext();
    }
  }

  async updateMaintenance(maintenanceId: string, updates: any): Promise<Maintenance> {
    await rlsHelpers.setUserContext(this.clerkUserId);

    try {
      const { data, error } = await supabase
        .from('maintenances')
        .update(updates)
        .eq('id', maintenanceId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } finally {
      await rlsHelpers.clearUserContext();
    }
  }

  // Dashboard and analytics operations
  async getServiceStatusSummary(teamId?: string): Promise<ServiceStatusSummary> {
    const services = await this.getServices(teamId ? { team_id: teamId } : {});
    
    const summary: ServiceStatusSummary = {
      operational: 0,
      degraded: 0,
      partial_outage: 0,
      major_outage: 0,
      total: services.length
    };

    services.forEach(service => {
      summary[service.status as keyof ServiceStatusSummary]++;
    });

    return summary;
  }

  async getIncidentSummary(teamId?: string): Promise<IncidentSummary> {
    const incidents = await this.getIncidents(teamId ? { team_id: teamId } : {});
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const activeIncidents = incidents.filter(i => i.status !== 'resolved');
    const resolvedToday = incidents.filter(i => 
      i.status === 'resolved' && 
      i.resolved_at && 
      new Date(i.resolved_at) >= todayStart
    );

    // Calculate average resolution time (simplified)
    const resolvedIncidents = incidents.filter(i => i.resolved_at);
    let avgResolutionTime = 0;
    
    if (resolvedIncidents.length > 0) {
      const totalTime = resolvedIncidents.reduce((sum, incident) => {
        const created = new Date(incident.created_at);
        const resolved = new Date(incident.resolved_at!);
        return sum + (resolved.getTime() - created.getTime());
      }, 0);
      
      avgResolutionTime = Math.round(totalTime / resolvedIncidents.length / (1000 * 60)); // minutes
    }

    return {
      total: incidents.length,
      active: activeIncidents.length,
      resolved_today: resolvedToday.length,
      avg_resolution_time: avgResolutionTime
    };
  }

  async getTeamDashboard(teamId: string): Promise<TeamDashboard> {
    await rlsHelpers.setUserContext(this.clerkUserId);
    
    try {
      // Get team details
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (teamError) throw teamError;

      // Get dashboard data
      const [services, incidents, upcomingMaintenances] = await Promise.all([
        this.getServiceStatusSummary(teamId),
        this.getIncidentSummary(teamId),
        this.getMaintenances({ 
          team_id: teamId, 
          upcoming: true,
          status: 'scheduled'
        })
      ]);

      return {
        team,
        services,
        incidents,
        upcoming_maintenances: upcomingMaintenances.length
      };
    } finally {
      await rlsHelpers.clearUserContext();
    }
  }

  // Bulk operations
  async bulkUpdateServiceStatus(
    serviceIds: string[], 
    status: ServiceStatus
  ): Promise<Service[]> {
    await rlsHelpers.setUserContext(this.clerkUserId);
    
    try {
      const { data, error } = await supabase
        .from('services')
        .update({ status })
        .in('id', serviceIds)
        .select();

      if (error) throw error;
      return data || [];
    } finally {
      await rlsHelpers.clearUserContext();
    }
  }

  // Search operations
  async searchServices(query: string, teamId?: string): Promise<Service[]> {
    await rlsHelpers.setUserContext(this.clerkUserId);
    
    try {
      let dbQuery = supabase
        .from('services')
        .select(`
          *,
          teams!inner (
            id,
            name,
            organization_id
          )
        `)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`);

      if (teamId) {
        dbQuery = dbQuery.eq('team_id', teamId);
      }

      const { data, error } = await dbQuery.limit(20);
      if (error) throw error;
      return data || [];
    } finally {
      await rlsHelpers.clearUserContext();
    }
  }

  async searchIncidents(query: string, teamId?: string): Promise<Incident[]> {
    await rlsHelpers.setUserContext(this.clerkUserId);
    
    try {
      let dbQuery = supabase
        .from('incidents')
        .select(`
          *,
          services!inner (
            id,
            name,
            team_id,
            teams!inner (
              id,
              name,
              organization_id
            )
          )
        `)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`);

      if (teamId) {
        dbQuery = dbQuery.eq('services.team_id', teamId);
      }

      const { data, error } = await dbQuery
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (error) throw error;
      return data || [];
    } finally {
      await rlsHelpers.clearUserContext();
    }
  }
}
