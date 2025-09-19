import { clerkClient } from '@clerk/clerk-sdk-node';
import { supabase } from './supabase';

export interface UserSyncData {
  clerkUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
}

export class UserSyncService {
  /**
   * Sync a user from Clerk to Supabase
   */
  static async syncUser(clerkUserId: string): Promise<UserSyncData | null> {
    try {
      // Get user from Clerk
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      
      if (!clerkUser) {
        console.error(`User not found in Clerk: ${clerkUserId}`);
        return null;
      }

      const userData: UserSyncData = {
        clerkUserId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        ...(clerkUser.firstName && { firstName: clerkUser.firstName }),
        ...(clerkUser.lastName && { lastName: clerkUser.lastName }),
        ...(clerkUser.imageUrl && { imageUrl: clerkUser.imageUrl }),
      };

      // Upsert user profile in Supabase
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          clerk_user_id: userData.clerkUserId,
          email: userData.email,
          first_name: userData.firstName,
          last_name: userData.lastName,
          image_url: userData.imageUrl,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'clerk_user_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to sync user to Supabase:', error);
        return null;
      }

      console.log(`User synced successfully: ${clerkUserId}`);
      return userData;
    } catch (error) {
      console.error('Error syncing user:', error);
      return null;
    }
  }

  /**
   * Create a new organization and assign the user as owner
   */
  static async createOrganizationForUser(
    clerkUserId: string, 
    organizationData: { name: string; slug: string }
  ): Promise<string | null> {
    try {
      // Ensure user is synced first
      await this.syncUser(clerkUserId);

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: organizationData.name,
          slug: organizationData.slug,
          owner_id: clerkUserId,
        })
        .select()
        .single();

      if (orgError) {
        console.error('Failed to create organization:', orgError);
        return null;
      }

      // Create default team for the organization
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          organization_id: org.id,
          name: 'Default Team',
          slug: 'default',
        })
        .select()
        .single();

      if (teamError) {
        console.error('Failed to create default team:', teamError);
        return null;
      }

      // Add user as owner of the default team
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: clerkUserId,
          role: 'owner',
        });

      if (memberError) {
        console.error('Failed to add user to default team:', memberError);
        return null;
      }

      console.log(`Organization created successfully: ${org.id}`);
      return org.id;
    } catch (error) {
      console.error('Error creating organization:', error);
      return null;
    }
  }

  /**
   * Add user to a team with specified role
   */
  static async addUserToTeam(
    clerkUserId: string,
    teamId: string,
    role: 'viewer' | 'member' | 'admin' | 'owner' = 'member'
  ): Promise<boolean> {
    try {
      // Ensure user is synced first
      await this.syncUser(clerkUserId);

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', clerkUserId)
        .single();

      if (existingMember) {
        console.log(`User ${clerkUserId} is already a member of team ${teamId}`);
        return true;
      }

      // Add user to team
      const { error } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: clerkUserId,
          role: role,
        });

      if (error) {
        console.error('Failed to add user to team:', error);
        return false;
      }

      console.log(`User ${clerkUserId} added to team ${teamId} with role ${role}`);
      return true;
    } catch (error) {
      console.error('Error adding user to team:', error);
      return false;
    }
  }

  /**
   * Remove user from a team
   */
  static async removeUserFromTeam(clerkUserId: string, teamId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', clerkUserId);

      if (error) {
        console.error('Failed to remove user from team:', error);
        return false;
      }

      console.log(`User ${clerkUserId} removed from team ${teamId}`);
      return true;
    } catch (error) {
      console.error('Error removing user from team:', error);
      return false;
    }
  }

  /**
   * Update user's role in a team
   */
  static async updateUserTeamRole(
    clerkUserId: string,
    teamId: string,
    newRole: 'viewer' | 'member' | 'admin' | 'owner'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('team_id', teamId)
        .eq('user_id', clerkUserId);

      if (error) {
        console.error('Failed to update user team role:', error);
        return false;
      }

      console.log(`User ${clerkUserId} role updated to ${newRole} in team ${teamId}`);
      return true;
    } catch (error) {
      console.error('Error updating user team role:', error);
      return false;
    }
  }

  /**
   * Get user's organizations and teams
   */
  static async getUserOrganizationsAndTeams(clerkUserId: string) {
    try {
      // Get organizations where user is owner
      const { data: ownedOrgs, error: ownedError } = await supabase
        .from('organizations')
        .select('*')
        .eq('owner_id', clerkUserId);

      if (ownedError) {
        console.error('Failed to fetch owned organizations:', ownedError);
      }

      // Get organizations where user is a team member
      const { data: memberOrgs, error: memberError } = await supabase
        .from('team_members')
        .select(`
          team_id,
          role,
          teams!inner (
            id,
            name,
            slug,
            organization_id,
            organizations!inner (
              id,
              name,
              slug,
              owner_id
            )
          )
        `)
        .eq('user_id', clerkUserId);

      if (memberError) {
        console.error('Failed to fetch member organizations:', memberError);
      }

      // Combine and deduplicate organizations
      const allOrgs = new Map();
      
      // Add owned organizations
      ownedOrgs?.forEach(org => {
        allOrgs.set(org.id, { ...org, role: 'owner', isOwner: true });
      });

      // Add member organizations
      memberOrgs?.forEach(member => {
        const teams = member.teams as any;
        const org = teams.organizations?.[0];
        if (org && !allOrgs.has(org.id)) {
          allOrgs.set(org.id, { ...org, role: member.role, isOwner: false });
        }
      });

      return {
        organizations: Array.from(allOrgs.values()),
        teams: memberOrgs?.map(member => ({
          ...(member.teams as any),
          role: member.role
        })) || []
      };
    } catch (error) {
      console.error('Error fetching user organizations and teams:', error);
      return { organizations: [], teams: [] };
    }
  }

  /**
   * Cleanup user data when user is deleted
   */
  static async cleanupUserData(clerkUserId: string): Promise<boolean> {
    try {
      // Remove from all teams
      const { error: teamError } = await supabase
        .from('team_members')
        .delete()
        .eq('user_id', clerkUserId);

      if (teamError) {
        console.error('Failed to remove user from teams:', teamError);
      }

      // Handle owned organizations
      const { data: ownedOrgs, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('owner_id', clerkUserId);

      if (orgError) {
        console.error('Failed to fetch owned organizations:', orgError);
      } else if (ownedOrgs && ownedOrgs.length > 0) {
        console.warn(`User ${clerkUserId} owns ${ownedOrgs.length} organizations. Manual intervention required.`);
        // In production, you might want to transfer ownership or mark for deletion
      }

      // Delete user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('clerk_user_id', clerkUserId);

      if (profileError) {
        console.error('Failed to delete user profile:', profileError);
      }

      console.log(`User data cleanup completed for: ${clerkUserId}`);
      return true;
    } catch (error) {
      console.error('Error cleaning up user data:', error);
      return false;
    }
  }
}
