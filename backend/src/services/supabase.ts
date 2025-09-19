import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Organization,
  Team,
  TeamMember,
  Service,
  Incident,
  IncidentUpdate,
  Maintenance,
  TeamMemberRole,
  ServiceStatus,
  IncidentStatus,
  MaintenanceStatus
} from '../types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Main Supabase client with service role (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create a client for user-specific operations (respects RLS)
export const createUserSupabaseClient = (userToken?: string): SupabaseClient => {
  if (userToken) {
    return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!, {
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      }
    });
  }
  return supabase;
};

// RLS policy enforcement functions
export const rlsHelpers = {
  /**
   * Set the current user context for RLS policies
   */
  async setUserContext(clerkUserId: string): Promise<void> {
    const { error } = await supabase.rpc('set_current_user_id', {
      user_clerk_id: clerkUserId
    });

    if (error) {
      console.error('Failed to set user context:', error);
      throw new Error('Failed to set user context');
    }
  },

  /**
   * Clear the current user context
   */
  async clearUserContext(): Promise<void> {
    const { error } = await supabase.rpc('clear_current_user_id');

    if (error) {
      console.error('Failed to clear user context:', error);
    }
  }
};

// Organization access helpers
export const organizationHelpers = {
  /**
   * Get all organizations for a user (owned + member)
   */
  async getUserOrganizations(clerkUserId: string): Promise<Organization[]> {
    await rlsHelpers.setUserContext(clerkUserId);

    try {
      // Get organizations where user is owner
      const { data: ownedOrgs, error: ownedError } = await supabase
        .from('organizations')
        .select('*')
        .eq('owner_id', clerkUserId);

      if (ownedError) throw ownedError;

      // Get organizations where user is a team member
      const { data: memberOrgs, error: memberError } = await supabase
        .from('team_members')
        .select(`
          teams!inner (
            organization_id,
            organizations!inner (
              id,
              name,
              slug,
              created_at,
              updated_at,
              owner_id
            )
          )
        `)
        .eq('user_id', clerkUserId);

      if (memberError) throw memberError;

      // Combine and deduplicate organizations
      const allOrgs = new Map<string, Organization>();

      // Add owned organizations
      ownedOrgs?.forEach(org => allOrgs.set(org.id, org));

      // Add member organizations
      memberOrgs?.forEach((member: any) => {
        const org = member.teams.organizations;
        if (!allOrgs.has(org.id)) {
          allOrgs.set(org.id, org);
        }
      });

      return Array.from(allOrgs.values());
    } finally {
      await rlsHelpers.clearUserContext();
    }
  },

  /**
   * Check if user has access to organization
   */
  async validateOrganizationAccess(clerkUserId: string, organizationId: string): Promise<boolean> {
    await rlsHelpers.setUserContext(clerkUserId);

    try {
      // Check if user is organization owner
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', organizationId)
        .eq('owner_id', clerkUserId)
        .single();

      if (!orgError && org) return true;

      // Check if user is a team member in the organization
      const { data: membership, error: memberError } = await supabase
        .from('team_members')
        .select(`
          teams!inner (
            organization_id
          )
        `)
        .eq('user_id', clerkUserId)
        .eq('teams.organization_id', organizationId)
        .limit(1);

      return !memberError && membership && membership.length > 0;
    } finally {
      await rlsHelpers.clearUserContext();
    }
  },

  /**
   * Check if user is organization owner
   */
  async isOrganizationOwner(clerkUserId: string, organizationId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .eq('owner_id', clerkUserId)
      .single();

    return !error && !!data;
  },

  /**
   * Create new organization with default team
   */
  async createOrganization(
    clerkUserId: string,
    orgData: { name: string; slug: string }
  ): Promise<Organization> {
    await rlsHelpers.setUserContext(clerkUserId);

    try {
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgData.name,
          slug: orgData.slug,
          owner_id: clerkUserId,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Create default team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          organization_id: org.id,
          name: 'Default Team',
          slug: 'default',
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add user as owner of the default team
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: clerkUserId,
          role: 'owner',
        });

      if (memberError) throw memberError;

      return org;
    } finally {
      await rlsHelpers.clearUserContext();
    }
  }
};

// Team access helpers
export const teamHelpers = {
  /**
   * Get user's team memberships
   */
  async getUserTeams(clerkUserId: string): Promise<any[]> {
    await rlsHelpers.setUserContext(clerkUserId);

    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          id,
          role,
          created_at,
          teams!inner (
            id,
            name,
            slug,
            organization_id,
            created_at,
            updated_at,
            organizations!inner (
              id,
              name,
              slug,
              owner_id
            )
          )
        `)
        .eq('user_id', clerkUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } finally {
      await rlsHelpers.clearUserContext();
    }
  },

  /**
   * Check if user has access to team
   */
  async validateTeamAccess(clerkUserId: string, teamId: string): Promise<boolean> {
    await rlsHelpers.setUserContext(clerkUserId);

    try {
      // Check if user is organization owner
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select(`
          organization_id,
          organizations!inner (
            owner_id
          )
        `)
        .eq('id', teamId)
        .single();

      if (!teamError && team && (team.organizations as any).owner_id === clerkUserId) {
        return true;
      }

      // Check if user is a team member
      const { data: membership, error: memberError } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', clerkUserId)
        .single();

      return !memberError && !!membership;
    } finally {
      await rlsHelpers.clearUserContext();
    }
  },

  /**
   * Get user's role in a team
   */
  async getUserTeamRole(clerkUserId: string, teamId: string): Promise<TeamMemberRole | null> {
    await rlsHelpers.setUserContext(clerkUserId);

    try {
      // Check if user is organization owner first
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select(`
          organization_id,
          organizations!inner (
            owner_id
          )
        `)
        .eq('id', teamId)
        .single();

      if (!teamError && team && (team.organizations as any).owner_id === clerkUserId) {
        return 'owner';
      }

      // Get user's role in the team
      const { data: membership, error: memberError } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', clerkUserId)
        .single();

      if (memberError || !membership) return null;
      return membership.role as TeamMemberRole;
    } finally {
      await rlsHelpers.clearUserContext();
    }
  },

  /**
   * Check if user has minimum role in team
   */
  async hasMinimumTeamRole(
    clerkUserId: string,
    teamId: string,
    minRole: TeamMemberRole
  ): Promise<boolean> {
    const userRole = await this.getUserTeamRole(clerkUserId, teamId);
    if (!userRole) return false;

    const roleHierarchy = {
      viewer: 1,
      member: 2,
      admin: 3,
      owner: 4
    };

    const userRoleLevel = roleHierarchy[userRole];
    const minRoleLevel = roleHierarchy[minRole];

    return userRoleLevel >= minRoleLevel;
  },

  /**
   * Add user to team
   */
  async addTeamMember(
    clerkUserId: string,
    teamId: string,
    role: TeamMemberRole = 'member'
  ): Promise<TeamMember> {
    await rlsHelpers.setUserContext(clerkUserId);

    try {
      const { data, error } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: clerkUserId,
          role: role,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } finally {
      await rlsHelpers.clearUserContext();
    }
  },

  /**
   * Remove user from team
   */
  async removeTeamMember(clerkUserId: string, teamId: string): Promise<void> {
    await rlsHelpers.setUserContext(clerkUserId);

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', clerkUserId);

      if (error) throw error;
    } finally {
      await rlsHelpers.clearUserContext();
    }
  },

  /**
   * Update user's role in team
   */
  async updateTeamMemberRole(
    clerkUserId: string,
    teamId: string,
    newRole: TeamMemberRole
  ): Promise<TeamMember> {
    await rlsHelpers.setUserContext(clerkUserId);

    try {
      const { data, error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('team_id', teamId)
        .eq('user_id', clerkUserId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } finally {
      await rlsHelpers.clearUserContext();
    }
  }
};
