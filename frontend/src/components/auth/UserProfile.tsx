import React, { useState } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Settings, Building } from 'lucide-react';
import { useOrganization } from '../../contexts/OrganizationContext';

interface UserProfileProps {
  onClose?: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onClose }) => {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { currentOrganization, organizations, switchOrganization } = useOrganization();
  const navigate = useNavigate();
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

  const handleOrganizationSwitch = async (orgId: string) => {
    await switchOrganization(orgId);
    onClose?.();
  };

  const handleManageAccount = () => {
    navigate('/user-profile');
    onClose?.();
  };

  const handleOrganizationSettings = () => {
    navigate('/organization/settings');
    onClose?.();
  };

  if (!user) {
    return null;
  }

  return (
    <div className="w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
      {/* User Info */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            {user.imageUrl ? (
              <img
                className="h-10 w-10 rounded-full"
                src={user.imageUrl}
                alt={user.fullName || 'User avatar'}
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                <User className="h-6 w-6 text-gray-600" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.fullName || 'User'}
            </p>
            <p className="text-sm text-gray-500 truncate">
              {user.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </div>
      </div>

      {/* Current Organization */}
      {currentOrganization && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <Building className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">
              {currentOrganization.name}
            </span>
          </div>
        </div>
      )}

      {/* Organization Switcher */}
      {organizations.length > 1 && (
        <div className="px-4 py-2 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Switch Organization
          </p>
          <div className="space-y-1">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleOrganizationSwitch(org.id)}
                className={`w-full text-left px-2 py-1 text-sm rounded hover:bg-gray-100 ${
                  currentOrganization?.id === org.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700'
                }`}
              >
                {org.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div className="py-2">
        <button
          onClick={handleManageAccount}
          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
        >
          <Settings className="h-4 w-4" />
          <span>Manage Account</span>
        </button>

        {currentOrganization && (
          <button
            onClick={handleOrganizationSettings}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
          >
            <Building className="h-4 w-4" />
            <span>Organization Settings</span>
          </button>
        )}
      </div>

      {/* Sign Out */}
      <div className="border-t border-gray-100 py-2">
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
        </button>
      </div>
    </div>
  );
};

export default UserProfile;
