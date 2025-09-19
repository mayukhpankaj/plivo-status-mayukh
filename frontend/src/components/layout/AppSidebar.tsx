import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Building,
  Menu,
  X
} from 'lucide-react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import OrganizationSwitcher from '../organization/OrganizationSwitcher';
import TeamSwitcher from './TeamSwitcher';
import NavigationMenu from './NavigationMenu';

interface AppSidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  collapsed = false,
  onCollapsedChange,
  className
}) => {
  const { currentOrganization } = useOrganization();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigation = (href: string) => {
    setMobileOpen(false);
  };

  const toggleCollapsed = () => {
    onCollapsedChange?.(!collapsed);
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 items-center border-b px-4">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <Building className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">StatusPage</span>
          </div>
        )}
        {collapsed && (
          <Building className="h-6 w-6 text-primary mx-auto" />
        )}
      </div>

      {/* Organization and Team Switchers */}
      <div className="p-4 space-y-3">
        <div className={cn("space-y-2", collapsed && "flex flex-col items-center")}>
          <OrganizationSwitcher />
          {currentOrganization && <TeamSwitcher />}
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <div className="flex-1 p-4">
        <NavigationMenu
          collapsed={collapsed}
          onNavigate={handleNavigation}
        />
      </div>

      {/* Collapse Toggle */}
      <div className="border-t p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          className={cn(
            "w-full",
            collapsed && "justify-center px-2"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={cn(
          "hidden md:flex md:flex-col md:fixed md:inset-y-0 md:z-50 md:bg-background md:border-r",
          collapsed ? "md:w-16" : "md:w-64",
          className
        )}
      >
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <div className="md:hidden">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-40"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <div className="fixed inset-y-0 left-0 z-50 w-64 bg-background border-r">
              <div className="flex h-16 items-center justify-between px-4 border-b">
                <div className="flex items-center space-x-2">
                  <Building className="h-6 w-6 text-primary" />
                  <span className="text-lg font-semibold">StatusPage</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SidebarContent />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AppSidebar;
