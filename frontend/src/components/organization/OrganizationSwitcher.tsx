import React, { useState } from 'react';
import { ChevronDown, Building, Plus, Check } from 'lucide-react';
import { useOrganization } from '../../contexts/OrganizationContext';

interface OrganizationSwitcherProps {
  onCreateOrganization?: () => void;
}

export const OrganizationSwitcher: React.FC<OrganizationSwitcherProps> = ({
  onCreateOrganization
}) => {
  const { 
    currentOrganization, 
    organizations, 
    switchOrganization, 
    loading 
  } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);

  const handleOrganizationSwitch = async (orgId: string) => {
    await switchOrganization(orgId);
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    setIsOpen(false);
    onCreateOrganization?.();
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-md animate-pulse">
        <div className="h-4 w-4 bg-gray-300 rounded"></div>
        <div className="h-4 w-24 bg-gray-300 rounded"></div>
      </div>
    );
  }

  if (!currentOrganization) {
    return (
      <button
        onClick={onCreateOrganization}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Plus className="h-4 w-4" />
        <span>Create Organization</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Building className="h-4 w-4" />
        <span className="truncate max-w-32">{currentOrganization.name}</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              {/* Current Organization Header */}
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Current Organization
                </p>
              </div>

              {/* Organization List */}
              <div className="max-h-60 overflow-y-auto">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleOrganizationSwitch(org.id)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                      currentOrganization.id === org.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Building className="h-4 w-4" />
                      <div>
                        <p className="font-medium">{org.name}</p>
                        <p className="text-xs text-gray-500">/{org.slug}</p>
                      </div>
                    </div>
                    {currentOrganization.id === org.id && (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                ))}
              </div>

              {/* Create New Organization */}
              <div className="border-t border-gray-100">
                <button
                  onClick={handleCreateNew}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create New Organization</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OrganizationSwitcher;
