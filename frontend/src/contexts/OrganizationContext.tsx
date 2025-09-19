import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Organization, Team, TeamMember } from '../types/index';
import { organizationService } from '../services/organizationService';

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  currentTeam: Team | null;
  teams: Team[];
  userTeams: TeamMember[];
  loading: boolean;
  error: string | null;
  
  // Actions
  setCurrentOrganization: (org: Organization | null) => void;
  setCurrentTeam: (team: Team | null) => void;
  refreshOrganizations: () => Promise<void>;
  refreshTeams: () => Promise<void>;
  createOrganization: (data: { name: string; slug: string }) => Promise<Organization>;
  switchOrganization: (organizationId: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

interface OrganizationProviderProps {
  children: ReactNode;
}

export const OrganizationProvider: React.FC<OrganizationProviderProps> = ({ children }) => {
  const { user, isLoaded } = useUser();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [userTeams, setUserTeams] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user's organizations when user is loaded
  useEffect(() => {
    if (isLoaded && user) {
      refreshOrganizations();
    } else if (isLoaded && !user) {
      // User is not signed in, reset state
      setCurrentOrganization(null);
      setOrganizations([]);
      setCurrentTeam(null);
      setTeams([]);
      setUserTeams([]);
      setLoading(false);
    }
  }, [isLoaded, user]);

  // Load teams when current organization changes
  useEffect(() => {
    if (currentOrganization) {
      refreshTeams();
    } else {
      setTeams([]);
      setCurrentTeam(null);
    }
  }, [currentOrganization]);

  const refreshOrganizations = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const userOrgs = await organizationService.getUserOrganizations();
      setOrganizations(userOrgs);
      
      // Set current organization from localStorage or first available
      const savedOrgId = localStorage.getItem('currentOrganizationId');
      const savedOrg = userOrgs.find(org => org.id === savedOrgId);
      
      if (savedOrg) {
        setCurrentOrganization(savedOrg);
      } else if (userOrgs.length > 0) {
        setCurrentOrganization(userOrgs[0]);
        localStorage.setItem('currentOrganizationId', userOrgs[0].id);
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
      setError('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const refreshTeams = async () => {
    if (!currentOrganization) return;
    
    try {
      setError(null);
      
      const [orgTeams, memberTeams] = await Promise.all([
        organizationService.getOrganizationTeams(currentOrganization.id),
        organizationService.getUserTeamMemberships()
      ]);
      
      setTeams(orgTeams);
      setUserTeams(memberTeams);
      
      // Set current team from localStorage or first available
      const savedTeamId = localStorage.getItem('currentTeamId');
      const savedTeam = orgTeams.find(team => team.id === savedTeamId);
      
      if (savedTeam) {
        setCurrentTeam(savedTeam);
      } else if (orgTeams.length > 0) {
        setCurrentTeam(orgTeams[0]);
        localStorage.setItem('currentTeamId', orgTeams[0].id);
      }
    } catch (err) {
      console.error('Failed to load teams:', err);
      setError('Failed to load teams');
    }
  };

  const createOrganization = async (data: { name: string; slug: string }): Promise<Organization> => {
    try {
      setError(null);
      const newOrg = await organizationService.createOrganization(data);
      
      // Refresh organizations list
      await refreshOrganizations();
      
      // Switch to the new organization
      await switchOrganization(newOrg.id);
      
      return newOrg;
    } catch (err) {
      console.error('Failed to create organization:', err);
      setError('Failed to create organization');
      throw err;
    }
  };

  const switchOrganization = async (organizationId: string) => {
    try {
      setError(null);
      const org = organizations.find(o => o.id === organizationId);
      
      if (org) {
        setCurrentOrganization(org);
        localStorage.setItem('currentOrganizationId', org.id);
        
        // Clear current team when switching organizations
        setCurrentTeam(null);
        localStorage.removeItem('currentTeamId');
      }
    } catch (err) {
      console.error('Failed to switch organization:', err);
      setError('Failed to switch organization');
    }
  };

  const handleSetCurrentTeam = (team: Team | null) => {
    setCurrentTeam(team);
    if (team) {
      localStorage.setItem('currentTeamId', team.id);
    } else {
      localStorage.removeItem('currentTeamId');
    }
  };

  const value: OrganizationContextType = {
    currentOrganization,
    organizations,
    currentTeam,
    teams,
    userTeams,
    loading,
    error,
    setCurrentOrganization,
    setCurrentTeam: handleSetCurrentTeam,
    refreshOrganizations,
    refreshTeams,
    createOrganization,
    switchOrganization,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = (): OrganizationContextType => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
