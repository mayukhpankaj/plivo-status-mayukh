import { Router } from 'express';
import { authenticateUser, requireAuth } from '../middleware/auth';
import { supabase } from '../services/supabase';

const router = Router();

// Get current user profile
router.get('/profile', authenticateUser, requireAuth, (req, res) => {
  try {
    const user = req.user;
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get user profile' 
    });
  }
});

// Verify token endpoint
router.post('/verify', authenticateUser, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Token is valid',
    user: req.user 
  });
});

// Ensure user profile exists (called from frontend after Clerk login)
router.post('/ensure-profile', requireAuth, async (req, res) => {
  try {
    const { clerk_user_id, email, first_name, last_name, image_url } = req.body;

    // Verify the authenticated user matches the profile being created
    if (req.user?.userId !== clerk_user_id) {
      return res.status(403).json({
        success: false,
        message: 'Cannot create profile for different user'
      });
    }

    console.log('Ensuring user profile for:', clerk_user_id);

    // Check if user profile already exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_user_id', clerk_user_id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing profile:', checkError);
      return res.status(500).json({
        success: false,
        message: 'Failed to check existing profile'
      });
    }

    let userProfile;

    if (existingProfile) {
      // Update existing profile
      const { data: updatedProfile, error: updateError } = await supabase
        .from('user_profiles')
        .update({
          email,
          first_name,
          last_name,
          image_url,
          updated_at: new Date().toISOString()
        })
        .eq('clerk_user_id', clerk_user_id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user profile:', updateError);
        return res.status(500).json({
          success: false,
          message: 'Failed to update user profile'
        });
      }

      userProfile = updatedProfile;
      console.log('Updated existing user profile:', clerk_user_id);
    } else {
      // Create new user profile
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          clerk_user_id,
          email,
          first_name,
          last_name,
          image_url,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user profile:', createError);
        return res.status(500).json({
          success: false,
          message: 'Failed to create user profile'
        });
      }

      userProfile = newProfile;
      console.log('Created new user profile:', clerk_user_id);

      // Create default organization for new user
      const orgName = `${first_name || 'User'}'s Organization`;
      const orgSlug = `${(first_name || 'user').toLowerCase()}-${clerk_user_id.slice(-8)}`.replace(/[^a-z0-9-]/g, '-');

      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          slug: orgSlug,
          owner_id: clerk_user_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (orgError) {
        console.error('Error creating organization:', orgError);
        // Don't fail the request if org creation fails
      } else {
        console.log('Created default organization:', orgData.id, 'for user:', clerk_user_id);

        // Create default team
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .insert({
            organization_id: orgData.id,
            name: 'Default Team',
            slug: 'default',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (teamError) {
          console.error('Error creating default team:', teamError);
        } else {
          console.log('Created default team:', teamData.id, 'for organization:', orgData.id);

          // Add user as team owner
          const { error: memberError } = await supabase
            .from('team_members')
            .insert({
              team_id: teamData.id,
              user_id: clerk_user_id,
              role: 'owner',
              created_at: new Date().toISOString()
            });

          if (memberError) {
            console.error('Error adding user to team:', memberError);
          } else {
            console.log('Added user as team owner:', clerk_user_id);
          }
        }
      }
    }

    res.json({
      success: true,
      data: userProfile,
      message: existingProfile ? 'User profile updated' : 'User profile created'
    });

  } catch (error) {
    console.error('Ensure profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Test endpoint without authentication (for debugging)
router.post('/test-profile-creation', async (req, res) => {
  try {
    console.log('=== TEST PROFILE CREATION ===');
    const { clerk_user_id, email, first_name, last_name } = req.body;

    console.log('Received data:', { clerk_user_id, email, first_name, last_name });

    // Test database connection first
    const { data: testQuery, error: testError } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('Database connection test failed:', testError);
      return res.status(500).json({
        success: false,
        message: 'Database connection failed',
        error: testError
      });
    }

    console.log('Database connection test passed');

    // Try to create user profile
    const { data: newProfile, error: createError } = await supabase
      .from('user_profiles')
      .insert({
        clerk_user_id: clerk_user_id || `test_${Date.now()}`,
        email: email || `test${Date.now()}@example.com`,
        first_name: first_name || 'Test',
        last_name: last_name || 'User',
        image_url: 'https://example.com/avatar.jpg',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating user profile:', createError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create user profile',
        error: createError
      });
    }

    console.log('✅ User profile created:', newProfile);

    // Try to create organization
    const orgName = `${first_name || 'Test'}'s Test Organization`;
    const orgSlug = `test-org-${Date.now()}`;

    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        slug: orgSlug,
        owner_id: newProfile.clerk_user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (orgError) {
      console.error('Error creating organization:', orgError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create organization',
        error: orgError,
        profile: newProfile
      });
    }

    console.log('✅ Organization created:', orgData);

    res.json({
      success: true,
      message: 'Test profile and organization created successfully',
      data: {
        profile: newProfile,
        organization: orgData
      }
    });

  } catch (error) {
    console.error('Test profile creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

export default router;
