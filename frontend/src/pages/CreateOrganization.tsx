import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const CreateOrganization = () => {
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [orgName, setOrgName] = useState('');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Add a small delay to ensure auth state is fully established
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Check if user is authenticated and wait a bit for session to be fully established
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) {
        throw new Error('User not authenticated. Please try signing in again.');
      }

      // Generate unique org ID and UUID
      const orgId = `org-${crypto.randomUUID()}`;
      const orgUuid = crypto.randomUUID();

      // Use a transaction-like approach with error handling
      let organizationCreated = false;

      try {
        // Create organization without selecting it back (to avoid RLS SELECT policy issue)
        const { error: orgError } = await supabase
          .from('organizations')
          .insert({
            id: orgUuid,
            name: orgName,
            org_id: orgId,
          });

        if (orgError) {
          // Provide more specific error message for RLS violations
          if (orgError.code === '42501' || orgError.message?.includes('policy')) {
            throw new Error('Permission denied. Please try signing out and signing in again.');
          }
          throw orgError;
        }

        organizationCreated = true;

        // Create user profile linked to organization
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: session.user.id,
            organization_id: orgUuid,
            email: session.user.email,
          });

        if (profileError) {
          throw profileError;
        }

      } catch (error) {
        // Clean up organization if it was created but profile creation failed
        if (organizationCreated) {
          await supabase.from('organizations').delete().eq('id', orgUuid);
        }
        throw error;
      }

      toast({
        title: "Organization Created!",
        description: `Successfully created ${orgName}`,
      });

      navigate('/dashboard');
    } catch (error: any) {
      let errorMessage = error.message || 'An unexpected error occurred';

      // Handle specific RLS policy errors
      if (error.message?.includes('policy') || error.code === '42501') {
        errorMessage = 'Authentication issue detected. Please sign out and sign in again to continue.';
      }

      toast({
        title: "Failed to create organization",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error('Sign out error:', error);
      // Force navigation even if sign out fails
      navigate('/auth', { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-end mb-2">
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
          <CardTitle className="text-2xl font-bold">Create Organization</CardTitle>
          <CardDescription>
            Set up your organization to get started with StatusMan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateOrganization} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                placeholder="Enter your organization name"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || !orgName.trim()}>
              {isLoading ? 'Creating Organization...' : 'Create Organization'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateOrganization;