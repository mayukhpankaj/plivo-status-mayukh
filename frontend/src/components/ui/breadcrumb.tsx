import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
}

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  services: 'Services',
  incidents: 'Incidents',
  maintenance: 'Maintenance',
  analytics: 'Analytics',
  team: 'Team',
  settings: 'Settings',
  'user-profile': 'Profile',
  organization: 'Organization',
};

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className }) => {
  const location = useLocation();

  // Generate breadcrumb items from current path if not provided
  const breadcrumbItems = items || generateBreadcrumbItems(location.pathname);

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav className={cn('flex items-center space-x-1 text-sm text-muted-foreground', className)}>
      {breadcrumbItems.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ChevronRight className="h-4 w-4" />}
          
          {item.href ? (
            <Link
              to={item.href}
              className="flex items-center space-x-1 hover:text-foreground transition-colors"
            >
              {item.icon && <item.icon className="h-4 w-4" />}
              <span>{item.label}</span>
            </Link>
          ) : (
            <div className="flex items-center space-x-1 text-foreground font-medium">
              {item.icon && <item.icon className="h-4 w-4" />}
              <span>{item.label}</span>
            </div>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

function generateBreadcrumbItems(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [];

  // Always start with home if not on root
  if (segments.length > 0) {
    items.push({
      label: 'Home',
      href: '/dashboard',
      icon: Home,
    });
  }

  // Build breadcrumb from path segments
  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;
    
    // Skip if this is a dynamic ID (UUID pattern)
    if (segment.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return;
    }

    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    
    items.push({
      label,
      href: isLast ? undefined : currentPath,
    });
  });

  return items;
}

export default Breadcrumb;
