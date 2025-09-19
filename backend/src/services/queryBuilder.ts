import { supabase, rlsHelpers } from './supabase';
import {
  Service,
  Incident,
  Maintenance,
  ServiceFilters,
  IncidentFilters,
  MaintenanceFilters,
  PaginationParams,
  IncidentWithUpdates
} from '../types';

/**
 * Database query builder with automatic tenant context filtering
 */
export class TenantQueryBuilder {
  private clerkUserId: string;
  private contextSet: boolean = false;

  constructor(clerkUserId: string) {
    this.clerkUserId = clerkUserId;
  }

  /**
   * Set user context for RLS policies
   */
  private async ensureContext(): Promise<void> {
    if (!this.contextSet) {
      await rlsHelpers.setUserContext(this.clerkUserId);
      this.contextSet = true;
    }
  }

  /**
   * Clear user context
   */
  async clearContext(): Promise<void> {
    if (this.contextSet) {
      await rlsHelpers.clearUserContext();
      this.contextSet = false;
    }
  }

  /**
   * Get services with automatic team filtering
   */
  async getServices(filters: ServiceFilters = {}): Promise<Service[]> {
    await this.ensureContext();
    
    let query = supabase
      .from('services')
      .select(`
        *,
        teams!inner (
          id,
          name,
          slug,
          organization_id
        )
      `);

    // Apply filters
    if (filters.team_id) {
      query = query.eq('team_id', filters.team_id);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    // Apply pagination
    if (filters.page && filters.limit) {
      const offset = (filters.page - 1) * filters.limit;
      query = query.range(offset, offset + filters.limit - 1);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Get incidents with automatic service/team filtering
   */
  async getIncidents(filters: IncidentFilters = {}): Promise<IncidentWithUpdates[]> {
    await this.ensureContext();
    
    let query = supabase
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
      `);

    // Apply filters
    if (filters.service_id) {
      query = query.eq('service_id', filters.service_id);
    }

    if (filters.team_id) {
      query = query.eq('services.team_id', filters.team_id);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.severity) {
      query = query.eq('severity', filters.severity);
    }

    // Apply pagination
    if (filters.page && filters.limit) {
      const offset = (filters.page - 1) * filters.limit;
      query = query.range(offset, offset + filters.limit - 1);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Get maintenances with automatic service/team filtering
   */
  async getMaintenances(filters: MaintenanceFilters = {}): Promise<Maintenance[]> {
    await this.ensureContext();
    
    let query = supabase
      .from('maintenances')
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
      `);

    // Apply filters
    if (filters.service_id) {
      query = query.eq('service_id', filters.service_id);
    }

    if (filters.team_id) {
      query = query.eq('services.team_id', filters.team_id);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.upcoming) {
      query = query.gte('scheduled_start', new Date().toISOString());
    }

    // Apply pagination
    if (filters.page && filters.limit) {
      const offset = (filters.page - 1) * filters.limit;
      query = query.range(offset, offset + filters.limit - 1);
    }

    query = query.order('scheduled_start', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Get service by ID with access validation
   */
  async getServiceById(serviceId: string): Promise<Service | null> {
    await this.ensureContext();
    
    const { data, error } = await supabase
      .from('services')
      .select(`
        *,
        teams!inner (
          id,
          name,
          slug,
          organization_id
        )
      `)
      .eq('id', serviceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  /**
   * Get incident by ID with access validation
   */
  async getIncidentById(incidentId: string): Promise<IncidentWithUpdates | null> {
    await this.ensureContext();
    
    const { data, error } = await supabase
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
      .eq('id', incidentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  /**
   * Get maintenance by ID with access validation
   */
  async getMaintenanceById(maintenanceId: string): Promise<Maintenance | null> {
    await this.ensureContext();
    
    const { data, error } = await supabase
      .from('maintenances')
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
      .eq('id', maintenanceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  /**
   * Create service with automatic team validation
   */
  async createService(serviceData: {
    team_id: string;
    name: string;
    description?: string;
  }): Promise<Service> {
    await this.ensureContext();
    
    const { data, error } = await supabase
      .from('services')
      .insert({
        ...serviceData,
        status: 'operational'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update service with access validation
   */
  async updateService(
    serviceId: string, 
    updates: Partial<Service>
  ): Promise<Service> {
    await this.ensureContext();
    
    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', serviceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete service with access validation
   */
  async deleteService(serviceId: string): Promise<void> {
    await this.ensureContext();
    
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', serviceId);

    if (error) throw error;
  }
}
