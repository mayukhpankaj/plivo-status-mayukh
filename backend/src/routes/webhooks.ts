import { Router, Request, Response } from 'express';
import { Webhook } from 'svix';
import { supabase } from '../services/supabase';

const router = Router();

// Webhook secret from Clerk dashboard
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  console.warn('CLERK_WEBHOOK_SECRET not set. Webhooks will not work properly.');
}

// Middleware to verify webhook signature
const verifyWebhook = (req: Request, res: Response, next: any) => {
  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  try {
    const headers = req.headers;
    const payload = req.body;

    const wh = new Webhook(WEBHOOK_SECRET);
    const evt = wh.verify(payload, headers as any);
    
    req.body = evt;
    next();
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return res.status(400).json({ error: 'Webhook verification failed' });
  }
};

// User created webhook
router.post('/clerk/user.created', verifyWebhook, async (req: Request, res: Response) => {
  try {
    const { data: userData } = req.body;

    if (!userData) {
      console.error('No user data in webhook payload');
      return res.status(400).json({ error: 'No user data provided' });
    }

    console.log('User created webhook received:', userData.id);

    // Create user profile in Supabase
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        clerk_user_id: userData.id,
        email: userData.email_addresses?.[0]?.email_address,
        first_name: userData.first_name,
        last_name: userData.last_name,
        image_url: userData.image_url,
        created_at: new Date(userData.created_at),
        updated_at: new Date(userData.updated_at)
      });

    if (profileError && profileError.code !== '23505') { // Ignore duplicate key errors
      console.error('Failed to create user profile:', profileError);
    }

    // Create a default organization for the new user
    const orgName = `${userData.first_name || 'User'}'s Organization`;
    const orgSlug = `${userData.first_name || 'user'}-${userData.id.slice(-8)}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        slug: orgSlug,
        owner_id: userData.id
      })
      .select()
      .single();

    if (orgError) {
      console.error('Failed to create default organization:', orgError);
    } else {
      console.log('Created default organization:', orgData.id, 'for user:', userData.id);

      // Create a default team within the organization
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert({
          organization_id: orgData.id,
          name: 'Default Team',
          slug: 'default'
        })
        .select()
        .single();

      if (teamError) {
        console.error('Failed to create default team:', teamError);
      } else {
        console.log('Created default team:', teamData.id, 'for organization:', orgData.id);

        // Add the user as owner of the default team
        const { error: memberError } = await supabase
          .from('team_members')
          .insert({
            team_id: teamData.id,
            user_id: userData.id,
            role: 'owner'
          });

        if (memberError) {
          console.error('Failed to add user to default team:', memberError);
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('User created webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User updated webhook
router.post('/clerk/user.updated', verifyWebhook, async (req: Request, res: Response) => {
  try {
    const { data: userData } = req.body;
    
    console.log('User updated webhook received:', userData.id);

    // Update user record in Supabase (if using user_profiles table)
    const { error } = await supabase
      .from('user_profiles')
      .update({
        email: userData.email_addresses?.[0]?.email_address,
        first_name: userData.first_name,
        last_name: userData.last_name,
        updated_at: new Date(userData.updated_at)
      })
      .eq('clerk_user_id', userData.id);

    if (error) {
      console.error('Failed to update user profile:', error);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('User updated webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User deleted webhook
router.post('/clerk/user.deleted', verifyWebhook, async (req: Request, res: Response) => {
  try {
    const { data: userData } = req.body;
    
    console.log('User deleted webhook received:', userData.id);

    // Handle user deletion
    // Note: Due to foreign key constraints, we might want to:
    // 1. Transfer ownership of organizations to another user
    // 2. Remove user from all teams
    // 3. Delete user profile

    // Remove user from all teams
    const { error: teamMemberError } = await supabase
      .from('team_members')
      .delete()
      .eq('user_id', userData.id);

    if (teamMemberError) {
      console.error('Failed to remove user from teams:', teamMemberError);
    }

    // Handle organizations owned by this user
    const { data: ownedOrgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('owner_id', userData.id);

    if (orgError) {
      console.error('Failed to fetch owned organizations:', orgError);
    } else if (ownedOrgs && ownedOrgs.length > 0) {
      console.warn(`User ${userData.id} owns ${ownedOrgs.length} organizations. Manual intervention may be required.`);
      // In a production system, you might want to:
      // - Transfer ownership to another admin
      // - Send notifications to other admins
      // - Mark organizations for deletion
    }

    // Delete user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('clerk_user_id', userData.id);

    if (profileError) {
      console.error('Failed to delete user profile:', profileError);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('User deleted webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Organization created webhook (if using Clerk organizations)
router.post('/clerk/organization.created', verifyWebhook, async (req: Request, res: Response) => {
  try {
    const { data: orgData } = req.body;
    
    console.log('Organization created webhook received:', orgData.id);

    // Sync Clerk organization with Supabase
    const { error } = await supabase
      .from('organizations')
      .insert({
        id: orgData.id, // Use Clerk org ID
        name: orgData.name,
        slug: orgData.slug || orgData.name.toLowerCase().replace(/\s+/g, '-'),
        owner_id: orgData.created_by,
        created_at: new Date(orgData.created_at),
        updated_at: new Date(orgData.updated_at)
      });

    if (error && error.code !== '23505') { // Ignore duplicate key errors
      console.error('Failed to create organization:', error);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Organization created webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Organization updated webhook
router.post('/clerk/organization.updated', verifyWebhook, async (req: Request, res: Response) => {
  try {
    const { data: orgData } = req.body;
    
    console.log('Organization updated webhook received:', orgData.id);

    const { error } = await supabase
      .from('organizations')
      .update({
        name: orgData.name,
        slug: orgData.slug || orgData.name.toLowerCase().replace(/\s+/g, '-'),
        updated_at: new Date(orgData.updated_at)
      })
      .eq('id', orgData.id);

    if (error) {
      console.error('Failed to update organization:', error);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Organization updated webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Organization deleted webhook
router.post('/clerk/organization.deleted', verifyWebhook, async (req: Request, res: Response) => {
  try {
    const { data: orgData } = req.body;
    
    console.log('Organization deleted webhook received:', orgData.id);

    // Delete organization (cascade will handle related records)
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgData.id);

    if (error) {
      console.error('Failed to delete organization:', error);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Organization deleted webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Organization membership created webhook
router.post('/clerk/organizationMembership.created', verifyWebhook, async (req: Request, res: Response) => {
  try {
    const { data: membershipData } = req.body;
    
    console.log('Organization membership created webhook received:', membershipData.id);

    // Add user to default team or handle organization membership
    // This depends on your specific business logic

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Organization membership created webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check for webhooks
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Webhook endpoint is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
