import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { User, Menu, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ThemeToggle } from '../ui/theme-toggle';
import { NotificationBell } from '../ui/notification-bell';
import Breadcrumb from '../ui/breadcrumb';

interface HeaderProps {
  sidebarCollapsed?: boolean;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  sidebarCollapsed = false,
  className
}) => {
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const { currentOrganization, currentTeam } = useOrganization();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
      setIsSigningOut(false);
    }
  };

  const handleProfileClick = () => {
    navigate('/user-profile');
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const getUserInitials = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.fullName) {
      const names = user.fullName.split(' ');
      return names.length > 1
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : names[0][0].toUpperCase();
    }
    return user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || 'U';
  };

  return (
    <>
      <header className={cn(
        "sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}>
        <div className={cn(
          "flex h-16 items-center px-4",
          sidebarCollapsed ? "md:pl-20" : "md:pl-68"
        )}>
          {/* Mobile menu button - only show on mobile */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden mr-2"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumb */}
          <div className="flex-1">
            <Breadcrumb />
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-2">
            {/* Organization context info - hidden on mobile */}
            <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground mr-4">
              {currentOrganization && (
                <span>{currentOrganization.name}</span>
              )}
              {currentTeam && (
                <>
                  <span>/</span>
                  <span>{currentTeam.name}</span>
                </>
              )}
            </div>

            {/* Notifications */}
            <NotificationBell />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.imageUrl} alt={user?.fullName || 'User'} />
                    <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.fullName || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.primaryEmailAddress?.emailAddress}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleProfileClick}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSettingsClick}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{isSigningOut ? 'Signing out...' : 'Sign out'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
