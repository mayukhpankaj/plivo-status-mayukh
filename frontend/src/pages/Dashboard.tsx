import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, LogOut, Activity, Trash2, BarChart3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Service {
  id: string;
  service_id: string;
  name: string;
  metric_url: string;
  created_at: string;
}

interface Profile {
  organization_id: string;
  organizations: {
    id: string;
    name: string;
    org_id: string;
  };
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [metricUrl, setMetricUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  useEffect(() => {
    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    if (profile) {
      fetchServices();
    }
  }, [profile]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          organization_id,
          organizations (
            id,
            name,
            org_id
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // User doesn't have a profile, redirect to create organization
        setIsRedirecting(true);
        setIsLoading(false); // Set loading to false before navigation
        navigate('/create-organization', { replace: true });
        return;
      }

      setProfile(data);
      setIsLoading(false);
    } catch (error: any) {
      toast({
        title: "Error loading profile",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const fetchServices = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setServices(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading services",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsCreating(true);

    try {
      const serviceId = `service-${crypto.randomUUID()}`;

      const { error } = await supabase
        .from('services')
        .insert({
          service_id: serviceId,
          name: serviceName,
          metric_url: metricUrl,
          user_id: user.id,
          organization_id: profile.organization_id,
        });

      if (error) throw error;

      toast({
        title: "Service Created!",
        description: `Successfully created ${serviceName}`,
      });

      setServiceName('');
      setMetricUrl('');
      setIsDialogOpen(false);
      fetchServices();
    } catch (error: any) {
      toast({
        title: "Failed to create service",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteService = async (serviceId: string, serviceName: string) => {
    setIsDeleting(serviceId);

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;

      toast({
        title: "Service Deleted!",
        description: `Successfully deleted ${serviceName}`,
      });

      fetchServices();
    } catch (error: any) {
      toast({
        title: "Failed to delete service",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSignOut = async () => {
    console.log('Dashboard handleSignOut called');
    try {
      console.log('Calling signOut()');
      await signOut();
      console.log('signOut() completed');

      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });

      // Force navigation to auth page
      console.log('Navigating to /auth');
      navigate('/auth', { replace: true });

      // Nuclear option: force page reload after a short delay
      setTimeout(() => {
        console.log('Force reloading page');
        window.location.href = '/auth';
      }, 1000);

    } catch (error) {
      console.error('Dashboard sign out error:', error);
      toast({
        title: "Sign out failed",
        description: "There was an error signing out. Please try again.",
        variant: "destructive",
      });
      // Try to navigate anyway
      navigate('/auth', { replace: true });

      // Nuclear option: force page reload
      setTimeout(() => {
        window.location.href = '/auth';
      }, 1000);
    }
  };

  const handleStatusPage = () => {
    // Use the hardcoded organization ID as requested
    const organizationId = 'a4e7b716-4490-423e-b27c-769c8f53846d';
    navigate(`/status/${organizationId}`);
  };

  if (isLoading || isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {isRedirecting ? 'Setting up your organization...' : 'Loading dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">StatusMan</h1>
            {profile?.organizations && (
              <p className="text-sm text-muted-foreground">
                {profile.organizations.name} ({profile.organizations.id})
              </p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={handleStatusPage}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Status Page
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-foreground">Services</h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Service</DialogTitle>
                <DialogDescription>
                  Add a new service to monitor its metrics and status.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateService}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="service-name">Service Name</Label>
                    <Input
                      id="service-name"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      placeholder="Enter service name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="metric-url">Metric URL</Label>
                    <Input
                      id="metric-url"
                      value={metricUrl}
                      onChange={(e) => setMetricUrl(e.target.value)}
                      placeholder="https://api.example.com/metrics"
                      required
                      type="url"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? 'Creating...' : 'Create Service'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {services.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Services Yet</h3>
            <p className="text-muted-foreground mb-6">
              Get started by adding your first service to monitor.
            </p>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Service
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <Card key={service.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-2 pr-8">
                    <Activity className="h-5 w-5 text-primary" />
                    {service.name}
                  </CardTitle>
                  <CardDescription>
                    Service ID: {service.service_id}
                  </CardDescription>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-4 right-4 h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                        disabled={isDeleting === service.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete service</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Service</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{service.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteService(service.id, service.name)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={isDeleting === service.id}
                        >
                          {isDeleting === service.id ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      <strong>Metric URL:</strong>
                    </p>
                    <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                      {service.metric_url}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(service.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;