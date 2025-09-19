import React, { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Navigate, useLocation } from 'react-router-dom';
import { setAuthToken } from '../../services/organizationService';

interface RequireAuthProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ 
  children, 
  fallback = <Navigate to="/sign-in" replace /> 
}) => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const location = useLocation();

  // Set auth token when user is signed in
  useEffect(() => {
    const setToken = async () => {
      if (isSignedIn && user) {
        try {
          const token = await getToken();
          if (token) {
            setAuthToken(token);
          }
        } catch (error) {
          console.error('Failed to get auth token:', error);
        }
      }
    };

    setToken();
  }, [isSignedIn, user, getToken]);

  // Show loading state while Clerk is initializing
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to sign-in if not authenticated
  if (!isSignedIn) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
