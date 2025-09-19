import { Router } from 'express';
import { authenticateUser, requireAuth } from '../middleware/auth';
import { setTeamContext, requireTeam, requireTeamRole } from '../middleware/organization';
import { supabase } from '../services/supabase';
import { UserSyncService } from '../services/userSync';

const router = Router();

// Apply authentication to all routes
router.use(authenticateUser, requireAuth);

// Get user's team memberships
router.get('/memberships', async (req, res): Promise<any> => {
  try {
    const userId = req.userId!;
    
    const { data: memberships, error } = await supabase
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
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch team memberships'
      });
    }

    res.json({
      success: true,
      data: memberships
    });
  } catch (error) {
    console.error('Get team memberships error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team memberships'
    });
  }
});

// Get specific team
router.get('/:teamId', setTeamContext, requireTeam, async (req, res): Promise<any> => {
  try {
    const { teamId } = req.params;

    const { data: team, error } = await supabase
      .from('teams')
      .select(`
        *,
        organizations!inner (
          id,
          name,
          slug,
          owner_id
        ),
        team_members (
          id,
          user_id,
          role,
          created_at
        )
      `)
      .eq('id', teamId)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team'
    });
  }
});

// Update team
router.put('/:teamId', setTeamContext, requireTeam, requireTeamRole('admin'), async (req, res): Promise<any> => {
  try {
    const { teamId } = req.params;
    const { name, slug } = req.body;

    // Validate input
    if (!name && !slug) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (name or slug) is required'
      });
    }

    // If updating slug, check if it's already taken within the organization
    if (slug) {
      const { data: currentTeam } = await supabase
        .from('teams')
        .select('organization_id')
        .eq('id', teamId)
        .single();

      if (currentTeam) {
        const { data: existingTeam } = await supabase
          .from('teams')
          .select('id')
          .eq('organization_id', currentTeam.organization_id)
          .eq('slug', slug)
          .neq('id', teamId)
          .single();

        if (existingTeam) {
          return res.status(409).json({
            success: false,
            message: 'Team slug already exists in this organization'
          });
        }
      }
    }

    // Update team
    const updateData: any = {};
    if (name) updateData.name = name;
    if (slug) updateData.slug = slug;

    const { data: team, error } = await supabase
      .from('teams')
      .update(updateData)
      .eq('id', teamId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update team'
      });
    }

    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update team'
    });
  }
});

// Delete team
router.delete('/:teamId', setTeamContext, requireTeam, requireTeamRole('admin'), async (req, res): Promise<any> => {
  try {
    const { teamId } = req.params;

    // Check if this is the last team in the organization
    const { data: currentTeam } = await supabase
      .from('teams')
      .select('organization_id')
      .eq('id', teamId)
      .single();

    if (currentTeam) {
      const { data: teamCount } = await supabase
        .from('teams')
        .select('id', { count: 'exact' })
        .eq('organization_id', currentTeam.organization_id);

      if (teamCount && teamCount.length <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last team in an organization'
        });
      }
    }

    // Delete team (cascade will handle related records)
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete team'
      });
    }

    res.json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete team'
    });
  }
});

// Get team members
router.get('/:teamId/members', setTeamContext, requireTeam, async (req, res): Promise<any> => {
  try {
    const { teamId } = req.params;

    const { data: members, error } = await supabase
      .from('team_members')
      .select(`
        id,
        user_id,
        role,
        created_at
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch team members'
      });
    }

    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team members'
    });
  }
});

// Add team member
router.post('/:teamId/members', setTeamContext, requireTeam, requireTeamRole('admin'), async (req, res): Promise<any> => {
  try {
    const { teamId } = req.params;
    const { user_id, role = 'member' } = req.body;

    // Validate input
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Validate role
    const validRoles = ['viewer', 'member', 'admin', 'owner'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    // Add user to team using UserSyncService
    const success = await UserSyncService.addUserToTeam(user_id, teamId!, role);

    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to add user to team'
      });
    }

    // Fetch the created membership
    const { data: membership, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', user_id)
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'User added but failed to fetch membership details'
      });
    }

    res.status(201).json({
      success: true,
      data: membership
    });
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add team member'
    });
  }
});

// Update team member role
router.put('/:teamId/members/:memberId', setTeamContext, requireTeam, requireTeamRole('admin'), async (req, res): Promise<any> => {
  try {
    const { teamId, memberId } = req.params;
    const { role } = req.body;

    // Validate role
    const validRoles = ['viewer', 'member', 'admin', 'owner'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    // Get current membership
    const { data: currentMember, error: fetchError } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('id', memberId)
      .eq('team_id', teamId)
      .single();

    if (fetchError || !currentMember) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    // Update role using UserSyncService
    const success = await UserSyncService.updateUserTeamRole(currentMember.user_id, teamId!, role);

    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update team member role'
      });
    }

    // Fetch updated membership
    const { data: membership, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Role updated but failed to fetch updated details'
      });
    }

    res.json({
      success: true,
      data: membership
    });
  } catch (error) {
    console.error('Update team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update team member'
    });
  }
});

// Remove team member
router.delete('/:teamId/members/:memberId', setTeamContext, requireTeam, requireTeamRole('admin'), async (req, res): Promise<any> => {
  try {
    const { teamId, memberId } = req.params;

    // Get current membership
    const { data: currentMember, error: fetchError } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('id', memberId)
      .eq('team_id', teamId)
      .single();

    if (fetchError || !currentMember) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    // Remove user from team using UserSyncService
    const success = await UserSyncService.removeUserFromTeam(currentMember.user_id, teamId!);

    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to remove team member'
      });
    }

    res.json({
      success: true,
      message: 'Team member removed successfully'
    });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove team member'
    });
  }
});

export default router;
