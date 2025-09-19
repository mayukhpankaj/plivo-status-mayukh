import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import AppSidebar from './AppSidebar';
import Header from './Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  className
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(true);
    }
  }, [isMobile]);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <AppSidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Main content area */}
      <div
        className={cn(
          "flex flex-col min-h-screen transition-all duration-300",
          // Adjust margin based on sidebar state
          sidebarCollapsed ? "md:ml-16" : "md:ml-64"
        )}
      >
        {/* Header */}
        <Header sidebarCollapsed={sidebarCollapsed} />

        {/* Page content */}
        <main className={cn("flex-1 p-4 md:p-6", className)}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
