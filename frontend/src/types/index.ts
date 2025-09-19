// Database enums
export type ServiceStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type TeamMemberRole = 'owner' | 'admin' | 'member' | 'viewer';

// Base interfaces
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

// Database table interfaces
export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  owner_id: string; // Clerk user ID
}

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string; // Clerk user ID
  role: TeamMemberRole;
  created_at: string;
}

export interface Service {
  id: string;
  team_id: string;
  name: string;
  description?: string;
  status: ServiceStatus;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: string;
  service_id: string;
  title: string;
  description?: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface IncidentUpdate {
  id: string;
  incident_id: string;
  message: string;
  status: IncidentStatus;
  created_at: string;
  author_id: string; // Clerk user ID
}

export interface Maintenance {
  id: string;
  service_id: string;
  title: string;
  description?: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string;
  actual_end?: string;
  status: MaintenanceStatus;
  created_at: string;
  updated_at: string;
  created_by: string; // Clerk user ID
}

// Extended interfaces with relations
export interface OrganizationWithTeams extends Organization {
  teams?: Team[];
}

export interface TeamWithMembers extends Team {
  members?: (TeamMember & { user?: User })[];
  organization?: Organization;
}

export interface ServiceWithIncidents extends Service {
  incidents?: Incident[];
  maintenances?: Maintenance[];
  team?: Team;
}

export interface IncidentWithUpdates extends Incident {
  updates?: (IncidentUpdate & { author?: User })[];
  service?: Service;
}

// Dashboard/analytics types
export interface ServiceStatusSummary {
  operational: number;
  degraded: number;
  partial_outage: number;
  major_outage: number;
  total: number;
}

export interface IncidentSummary {
  total: number;
  active: number;
  resolved_today: number;
  avg_resolution_time: number; // in minutes
}

export interface TeamDashboard {
  team: Team;
  services: ServiceStatusSummary;
  incidents: IncidentSummary;
  upcoming_maintenances: number;
}

// UI-specific types
export interface StatusPageConfig {
  organization: Organization;
  teams: Team[];
  public_services: Service[];
  show_incident_history: boolean;
  show_maintenance_schedule: boolean;
}

export interface StatusBadgeProps {
  status: ServiceStatus;
  size?: 'sm' | 'md' | 'lg';
}

export interface SeverityBadgeProps {
  severity: IncidentSeverity;
  size?: 'sm' | 'md' | 'lg';
}

// Request/Response types for API calls
export interface CreateOrganizationRequest {
  name: string;
  slug: string;
}

export interface CreateTeamRequest {
  organization_id: string;
  name: string;
  slug: string;
}

export interface AddTeamMemberRequest {
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
}

export interface UpdateTeamMemberRequest {
  role: TeamMemberRole;
}

// Additional request types
export interface CreateServiceRequest {
  team_id: string;
  name: string;
  description?: string;
}

export interface CreateIncidentRequest {
  service_id: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
}

export interface CreateMaintenanceRequest {
  service_id: string;
  title: string;
  description?: string;
  scheduled_start: string;
  scheduled_end: string;
}
