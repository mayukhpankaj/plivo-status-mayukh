import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Activity, 
  AlertTriangle, 
  Settings, 
  Users, 
  BarChart3, 
  Calendar,
  Building,
  Shield,
  FileText,
  Globe
} from 'lucide-react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  requiredRole?: string[];
  description?: string;
  category?: 'main' | 'management' | 'settings';
}

interface NavigationMenuProps {
  collapsed?: boolean;
  className?: string;
  onNavigate?: (href: string) => void;
}

const navigationItems: NavigationItem[] = [
  // Main navigation
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    description: 'Overview of your services and incidents',
    category: 'main',
  },
  {
    name: 'Services',
    href: '/services',
    icon: Activity,
    description: 'Manage your services and their status',
    category: 'main',
  },
  {
    name: 'Incidents',
    href: '/incidents',
    icon: AlertTriangle,
    description: 'Track and manage incidents',
    category: 'main',
  },
  {
    name: 'Maintenance',
    href: '/maintenance',
    icon: Calendar,
    description: 'Schedule and manage maintenance windows',
    category: 'main',
  },
  {
    name: 'Status Page',
    href: '/status-page',
    icon: Globe,
    description: 'Public status page configuration',
    category: 'main',
  },

  // Management
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    description: 'Service performance and incident analytics',
    requiredRole: ['owner', 'admin'],
    category: 'management',
  },
  {
    name: 'Team',
    href: '/team',
    icon: Users,
    description: 'Manage team members and permissions',
    requiredRole: ['owner', 'admin'],
    category: 'management',
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: FileText,
    description: 'Generate and view reports',
    requiredRole: ['owner', 'admin'],
    category: 'management',
  },

  // Settings
  {
    name: 'Organization',
    href: '/organization/settings',
    icon: Building,
    description: 'Organization settings and configuration',
    requiredRole: ['owner', 'admin'],
    category: 'settings',
  },
  {
    name: 'Security',
    href: '/security',
    icon: Shield,
    description: 'Security settings and access control',
    requiredRole: ['owner'],
    category: 'settings',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'General settings and preferences',
    requiredRole: ['owner', 'admin'],
    category: 'settings',
  },
];

export const NavigationMenu: React.FC<NavigationMenuProps> = ({
  collapsed = false,
  className,
  onNavigate
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentTeam, userTeams } = useOrganization();

  // Get user's role in current team
  const currentUserRole = currentTeam 
    ? userTeams.find(tm => tm.team_id === currentTeam.id)?.role 
    : null;

  // Filter navigation items based on user role
  const filteredNavItems = navigationItems.filter(item => {
    if (!item.requiredRole) return true;
    if (!currentUserRole) return false;
    return item.requiredRole.includes(currentUserRole);
  });

  // Group items by category
  const groupedItems = filteredNavItems.reduce((acc, item) => {
    const category = item.category || 'main';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, NavigationItem[]>);

  const handleNavigation = (href: string) => {
    navigate(href);
    onNavigate?.(href);
  };

  const renderNavigationItem = (item: NavigationItem) => {
    const isActive = location.pathname === item.href || 
                    location.pathname.startsWith(item.href + '/');
    
    const NavButton = (
      <Button
        variant={isActive ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-start",
          collapsed && "justify-center px-2",
          isActive && "bg-accent text-accent-foreground"
        )}
        onClick={() => handleNavigation(item.href)}
      >
        <item.icon className={cn("h-4 w-4", !collapsed && "mr-2")} />
        {!collapsed && (
          <>
            <span>{item.name}</span>
            {item.badge && (
              <Badge variant="secondary" className="ml-auto">
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </Button>
    );

    if (collapsed) {
      return (
        <TooltipProvider key={item.name}>
          <Tooltip>
            <TooltipTrigger asChild>
              {NavButton}
            </TooltipTrigger>
            <TooltipContent side="right">
              <div>
                <p className="font-medium">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.description}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return <div key={item.name}>{NavButton}</div>;
  };

  const renderCategory = (categoryName: string, items: NavigationItem[]) => {
    if (items.length === 0) return null;

    const categoryLabels = {
      main: 'Main',
      management: 'Management',
      settings: 'Settings'
    };

    return (
      <div key={categoryName} className="space-y-1">
        {!collapsed && categoryName !== 'main' && (
          <div className="px-2 py-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {categoryLabels[categoryName as keyof typeof categoryLabels] || categoryName}
            </h3>
          </div>
        )}
        {items.map(renderNavigationItem)}
      </div>
    );
  };

  return (
    <nav className={cn("space-y-4", className)}>
      {renderCategory('main', groupedItems.main || [])}
      {renderCategory('management', groupedItems.management || [])}
      {renderCategory('settings', groupedItems.settings || [])}
    </nav>
  );
};

export default NavigationMenu;
