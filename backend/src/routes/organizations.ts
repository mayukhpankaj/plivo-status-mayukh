import { Router } from 'express';
import { authenticateUser, requireAuth } from '../middleware/auth';
import { setOrganizationContext, requireOrganization, requireOrganizationOwner } from '../middleware/organization';
import { supabase } from '../services/supabase';
import { UserSyncService } from '../services/userSync';

const router = Router();

// Apply authentication to all routes
router.use(authenticateUser, requireAuth);

// Get user's organizations
router.get('/', async (req, res) => {
  try {
    const userId = req.userId!;
    
    const result = await UserSyncService.getUserOrganizationsAndTeams(userId);
    
    res.json({
      success: true,
      data: result.organizations
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organizations'
    });
  }
});

// Create new organization
router.post('/', async (req, res): Promise<any> => {
  try {
    const userId = req.userId!;
    const { name, slug } = req.body;

    // Validate input
    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: 'Name and slug are required'
      });
    }

    // Check if slug is already taken
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingOrg) {
      return res.status(409).json({
        success: false,
        message: 'Organization slug already exists'
      });
    }

    // Create organization using UserSyncService
    const organizationId = await UserSyncService.createOrganizationForUser(userId, { name, slug });

    if (!organizationId) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create organization'
      });
    }

    // Fetch the created organization
    const { data: organization, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Organization created but failed to fetch details'
      });
    }

    res.status(201).json({
      success: true,
      data: organization
    });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create organization'
    });
  }
});

// Get specific organization
router.get('/:organizationId', setOrganizationContext, requireOrganization, async (req, res): Promise<any> => {
  try {
    const { organizationId } = req.params;

    const { data: organization, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    res.json({
      success: true,
      data: organization
    });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organization'
    });
  }
});

// Update organization
router.put('/:organizationId', setOrganizationContext, requireOrganization, requireOrganizationOwner, async (req, res): Promise<any> => {
  try {
    const { organizationId } = req.params;
    const { name, slug } = req.body;

    // Validate input
    if (!name && !slug) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (name or slug) is required'
      });
    }

    // Check if new slug is already taken (if slug is being updated)
    if (slug) {
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .neq('id', organizationId)
        .single();

      if (existingOrg) {
        return res.status(409).json({
          success: false,
          message: 'Organization slug already exists'
        });
      }
    }

    // Update organization
    const updateData: any = {};
    if (name) updateData.name = name;
    if (slug) updateData.slug = slug;

    const { data: organization, error } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', organizationId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update organization'
      });
    }

    res.json({
      success: true,
      data: organization
    });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update organization'
    });
  }
});

// Delete organization
router.delete('/:organizationId', setOrganizationContext, requireOrganization, requireOrganizationOwner, async (req, res): Promise<any> => {
  try {
    const { organizationId } = req.params;

    // Delete organization (cascade will handle related records)
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', organizationId);

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete organization'
      });
    }

    res.json({
      success: true,
      message: 'Organization deleted successfully'
    });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete organization'
    });
  }
});

// Get organization teams
router.get('/:organizationId/teams', setOrganizationContext, requireOrganization, async (req, res): Promise<any> => {
  try {
    const { organizationId } = req.params;

    const { data: teams, error } = await supabase
      .from('teams')
      .select(`
        *,
        team_members (
          id,
          user_id,
          role,
          created_at
        )
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch teams'
      });
    }

    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Get organization teams error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teams'
    });
  }
});

// Create team in organization
router.post('/:organizationId/teams', setOrganizationContext, requireOrganization, async (req, res): Promise<any> => {
  try {
    const { organizationId } = req.params;
    const userId = req.userId!;
    const { name, slug } = req.body;

    // Validate input
    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: 'Name and slug are required'
      });
    }

    // Check if slug is already taken within the organization
    const { data: existingTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('slug', slug)
      .single();

    if (existingTeam) {
      return res.status(409).json({
        success: false,
        message: 'Team slug already exists in this organization'
      });
    }

    // Create team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        organization_id: organizationId,
        name,
        slug
      })
      .select()
      .single();

    if (teamError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create team'
      });
    }

    // Add creator as team owner
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: userId,
        role: 'owner'
      });

    if (memberError) {
      console.error('Failed to add creator to team:', memberError);
      // Team was created but user wasn't added - this is recoverable
    }

    res.status(201).json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create team'
    });
  }
});

export default router;
