import React, { useState } from 'react';
import { ChevronDown, Users, Plus, Check } from 'lucide-react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface TeamSwitcherProps {
  onCreateTeam?: () => void;
}

export const TeamSwitcher: React.FC<TeamSwitcherProps> = ({
  onCreateTeam
}) => {
  const { 
    currentTeam, 
    teams, 
    setCurrentTeam, 
    loading,
    currentOrganization 
  } = useOrganization();

  const handleTeamSwitch = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (team) {
      setCurrentTeam(team);
    }
  };

  const handleCreateNew = () => {
    onCreateTeam?.();
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-muted rounded-md animate-pulse">
        <div className="h-4 w-4 bg-muted-foreground/30 rounded"></div>
        <div className="h-4 w-24 bg-muted-foreground/30 rounded"></div>
      </div>
    );
  }

  if (!currentOrganization) {
    return null;
  }

  if (!currentTeam && teams.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onCreateTeam}
        className="w-full justify-start"
      >
        <Plus className="h-4 w-4 mr-2" />
        <span>Create Team</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between"
        >
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span className="truncate">
              {currentTeam ? currentTeam.name : 'Select Team'}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <DropdownMenuLabel>Teams</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {teams.length > 0 ? (
          <>
            {teams.map((team) => (
              <DropdownMenuItem
                key={team.id}
                onClick={() => handleTeamSwitch(team.id)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <div>
                    <p className="font-medium">{team.name}</p>
                    <p className="text-xs text-muted-foreground">/{team.slug}</p>
                  </div>
                </div>
                {currentTeam?.id === team.id && (
                  <Check className="h-4 w-4" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        ) : (
          <DropdownMenuItem disabled>
            <span className="text-muted-foreground">No teams available</span>
          </DropdownMenuItem>
        )}
        
        <DropdownMenuItem onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          <span>Create New Team</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TeamSwitcher;
