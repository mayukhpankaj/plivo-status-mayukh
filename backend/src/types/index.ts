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
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
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

// API request/response types
export interface CreateOrganizationRequest {
  name: string;
  slug: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  slug?: string;
}

export interface CreateTeamRequest {
  organization_id: string;
  name: string;
  slug: string;
}

export interface UpdateTeamRequest {
  name?: string;
  slug?: string;
}

export interface AddTeamMemberRequest {
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
}

export interface UpdateTeamMemberRequest {
  role: TeamMemberRole;
}

export interface CreateServiceRequest {
  team_id: string;
  name: string;
  description?: string;
}

export interface UpdateServiceRequest {
  name?: string;
  description?: string;
  status?: ServiceStatus;
}

export interface CreateIncidentRequest {
  service_id: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
}

export interface UpdateIncidentRequest {
  title?: string;
  description?: string;
  status?: IncidentStatus;
  severity?: IncidentSeverity;
}

export interface CreateIncidentUpdateRequest {
  incident_id: string;
  message: string;
  status: IncidentStatus;
}

export interface CreateMaintenanceRequest {
  service_id: string;
  title: string;
  description?: string;
  scheduled_start: string;
  scheduled_end: string;
}

export interface UpdateMaintenanceRequest {
  title?: string;
  description?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  status?: MaintenanceStatus;
}

// Query parameters for filtering and pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface IncidentFilters extends PaginationParams {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  service_id?: string;
  team_id?: string;
}

export interface MaintenanceFilters extends PaginationParams {
  status?: MaintenanceStatus;
  service_id?: string;
  team_id?: string;
  upcoming?: boolean;
}

export interface ServiceFilters extends PaginationParams {
  status?: ServiceStatus;
  team_id?: string;
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

// User profile interface for Clerk integration
export interface UserProfile {
  id: string;
  clerk_user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

// Database error types
export interface DatabaseError {
  code: string;
  message: string;
  details?: any;
  hint?: string;
}

// Tenant access context
export interface TenantContext {
  userId: string;
  organizationId?: string;
  teamId?: string;
  serviceId?: string;
  incidentId?: string;
  maintenanceId?: string;
}

// Access validation results
export interface AccessValidationResult {
  hasAccess: boolean;
  role?: TeamMemberRole;
  reason?: string;
}

// Bulk operation results
export interface BulkOperationResult<T> {
  success: T[];
  failed: Array<{
    item: any;
    error: string;
  }>;
  total: number;
  successCount: number;
  failedCount: number;
}

// Search results
export interface SearchResult<T> {
  items: T[];
  total: number;
  query: string;
  filters?: any;
}

// Audit log interface
export interface AuditLog {
  id: string;
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
  created_at: string;
}

// Notification interface
export interface Notification {
  id: string;
  user_id: string;
  organization_id: string;
  team_id?: string;
  type: 'incident' | 'maintenance' | 'service' | 'team' | 'organization';
  title: string;
  message: string;
  read: boolean;
  data?: any;
  created_at: string;
}

// Webhook payload interfaces
export interface WebhookPayload {
  event: string;
  data: any;
  timestamp: string;
  organization_id?: string;
  team_id?: string;
}

// Status page configuration
export interface StatusPageConfig {
  id: string;
  organization_id: string;
  team_id?: string;
  title: string;
  description?: string;
  domain?: string;
  custom_css?: string;
  logo_url?: string;
  favicon_url?: string;
  theme: 'light' | 'dark' | 'auto';
  show_powered_by: boolean;
  created_at: string;
  updated_at: string;
}

// Subscriber interface for status page
export interface Subscriber {
  id: string;
  status_page_id: string;
  email: string;
  phone?: string;
  subscribed_services: string[];
  notification_preferences: {
    email: boolean;
    sms: boolean;
    incidents: boolean;
    maintenances: boolean;
  };
  verified: boolean;
  created_at: string;
  updated_at: string;
}
