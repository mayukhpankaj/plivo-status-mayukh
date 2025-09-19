import axios from 'axios';
import type {
  Organization,
  Team,
  TeamMember,
  CreateOrganizationRequest,
  CreateTeamRequest,
  AddTeamMemberRequest,
  UpdateTeamMemberRequest,
  ApiResponse
} from '../types/index';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Create axios instance with default config
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('clerk-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);

    if (error.response?.status === 401) {
      // Token expired or invalid, redirect to sign in
      localStorage.removeItem('clerk-token');
      window.location.href = '/sign-in';
    }

    // Extract error message for user feedback
    const errorMessage = error.response?.data?.message || 'An unexpected error occurred';

    return Promise.reject({
      ...error,
      userMessage: errorMessage
    });
  }
);

export const organizationService = {
  // Organization management
  async getUserOrganizations(): Promise<Organization[]> {
    const response = await api.get<ApiResponse<Organization[]>>('/organizations');
    return response.data.data || [];
  },

  async getOrganization(id: string): Promise<Organization> {
    const response = await api.get<ApiResponse<Organization>>(`/organizations/${id}`);
    if (!response.data.data) {
      throw new Error('Organization not found');
    }
    return response.data.data;
  },

  async createOrganization(data: CreateOrganizationRequest): Promise<Organization> {
    const response = await api.post<ApiResponse<Organization>>('/organizations', data);
    if (!response.data.data) {
      throw new Error('Failed to create organization');
    }
    return response.data.data;
  },

  async updateOrganization(id: string, data: Partial<CreateOrganizationRequest>): Promise<Organization> {
    const response = await api.put<ApiResponse<Organization>>(`/organizations/${id}`, data);
    if (!response.data.data) {
      throw new Error('Failed to update organization');
    }
    return response.data.data;
  },

  async deleteOrganization(id: string): Promise<void> {
    await api.delete(`/organizations/${id}`);
  },

  // Team management
  async getOrganizationTeams(organizationId: string): Promise<Team[]> {
    const response = await api.get<ApiResponse<Team[]>>(`/organizations/${organizationId}/teams`);
    return response.data.data || [];
  },

  async getTeam(id: string): Promise<Team> {
    const response = await api.get<ApiResponse<Team>>(`/teams/${id}`);
    if (!response.data.data) {
      throw new Error('Team not found');
    }
    return response.data.data;
  },

  async createTeam(data: CreateTeamRequest): Promise<Team> {
    const response = await api.post<ApiResponse<Team>>('/teams', data);
    if (!response.data.data) {
      throw new Error('Failed to create team');
    }
    return response.data.data;
  },

  async updateTeam(id: string, data: Partial<CreateTeamRequest>): Promise<Team> {
    const response = await api.put<ApiResponse<Team>>(`/teams/${id}`, data);
    if (!response.data.data) {
      throw new Error('Failed to update team');
    }
    return response.data.data;
  },

  async deleteTeam(id: string): Promise<void> {
    await api.delete(`/teams/${id}`);
  },

  // Team member management
  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const response = await api.get<ApiResponse<TeamMember[]>>(`/teams/${teamId}/members`);
    return response.data.data || [];
  },

  async getUserTeamMemberships(): Promise<TeamMember[]> {
    const response = await api.get<ApiResponse<TeamMember[]>>('/user/team-memberships');
    return response.data.data || [];
  },

  async addTeamMember(data: AddTeamMemberRequest): Promise<TeamMember> {
    const response = await api.post<ApiResponse<TeamMember>>('/team-members', data);
    if (!response.data.data) {
      throw new Error('Failed to add team member');
    }
    return response.data.data;
  },

  async updateTeamMember(id: string, data: UpdateTeamMemberRequest): Promise<TeamMember> {
    const response = await api.put<ApiResponse<TeamMember>>(`/team-members/${id}`, data);
    if (!response.data.data) {
      throw new Error('Failed to update team member');
    }
    return response.data.data;
  },

  async removeTeamMember(id: string): Promise<void> {
    await api.delete(`/team-members/${id}`);
  },

  // User profile
  async getCurrentUser(): Promise<any> {
    const response = await api.get<ApiResponse<any>>('/auth/profile');
    return response.data.data;
  },

  // Organization invitations
  async inviteUserToOrganization(organizationId: string, email: string, role: string = 'member'): Promise<void> {
    await api.post(`/organizations/${organizationId}/invitations`, { email, role });
  },

  async acceptInvitation(invitationId: string): Promise<void> {
    await api.post(`/invitations/${invitationId}/accept`);
  },

  async declineInvitation(invitationId: string): Promise<void> {
    await api.post(`/invitations/${invitationId}/decline`);
  },
};

// Helper function to set auth token
export const setAuthToken = (token: string) => {
  localStorage.setItem('clerk-token', token);
};

// Helper function to clear auth token
export const clearAuthToken = () => {
  localStorage.removeItem('clerk-token');
};
