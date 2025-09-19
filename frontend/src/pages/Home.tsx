import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { SignIn as ClerkSignIn, SignUp as ClerkSignUp } from '@clerk/clerk-react';
import { Button } from "../components/ui/button";
import { Shield, Users, BarChart3, ArrowRight, CheckCircle, Eye, EyeOff } from 'lucide-react';

export default function Home() {
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'landing'>('landing');
  const [showPassword, setShowPassword] = useState(false);
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Check URL path and parameters for direct navigation
  useEffect(() => {
    if (location.pathname === '/sign-in') {
      setAuthMode('signin');
    } else if (location.pathname === '/sign-up') {
      setAuthMode('signup');
    } else {
      const mode = searchParams.get('mode');
      if (mode === 'signin' || mode === 'signup') {
        setAuthMode(mode);
      }
    }
  }, [location.pathname, searchParams]);

  // Redirect if already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate('/onboarding');
    }
  }, [isLoaded, isSignedIn, navigate]);

  // Show loading while Clerk is initializing
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">StatusPage</span>
            </div>
            <div className="flex items-center space-x-4">
              {authMode === 'landing' && (
                <>
                  <button
                    onClick={() => setAuthMode('signin')}
                    className="text-gray-600 hover:text-gray-900 font-medium"
                  >
                    Sign In
                  </button>
                  <Button
                    onClick={() => setAuthMode('signup')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Get Started
                  </Button>
                </>
              )}
              {authMode !== 'landing' && (
                <button
                  onClick={() => {
                    setAuthMode('landing');
                    navigate('/');
                  }}
                  className="text-gray-600 hover:text-gray-900 font-medium"
                >
                  ← Back to Home
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {authMode === 'landing' && (
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Keep Your Users
              <span className="text-blue-600"> Informed</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Build trust with transparent status updates. Monitor services, communicate incidents,
              and maintain customer confidence with our comprehensive status page platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button
                size="lg"
                onClick={() => setAuthMode('signup')}
                className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setAuthMode('signin')}
                className="text-lg px-8 py-3"
              >
                Sign In
              </Button>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-8 mt-16">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Real-time Monitoring</h3>
                <p className="text-gray-600">
                  Monitor your services 24/7 with automated health checks and instant alerts.
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Team Collaboration</h3>
                <p className="text-gray-600">
                  Coordinate incident response with your team and keep everyone in the loop.
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Analytics & Insights</h3>
                <p className="text-gray-600">
                  Get detailed analytics on service performance and incident patterns.
                </p>
              </div>
            </div>

            {/* Social Proof */}
            <div className="mt-16 bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Trusted by teams worldwide</h3>
              <div className="grid md:grid-cols-3 gap-6 text-left">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">99.9% Uptime</p>
                    <p className="text-sm text-gray-600">Reliable monitoring you can count on</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Enterprise Security</p>
                    <p className="text-sm text-gray-600">SOC 2 compliant with end-to-end encryption</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">24/7 Support</p>
                    <p className="text-sm text-gray-600">Expert support when you need it most</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sign In Form */}
        {authMode === 'signin' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                <p className="text-gray-600">Sign in to your account to continue</p>
              </div>

              <ClerkSignIn
                routing="virtual"
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none border-none p-0",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    socialButtonsBlockButton: "border border-gray-300 hover:bg-gray-50 rounded-lg",
                    formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white rounded-lg",
                    footerActionLink: "text-blue-600 hover:text-blue-700",
                    formFieldInput: "rounded-lg border-gray-300",
                    dividerLine: "bg-gray-200",
                    dividerText: "text-gray-500",
                  },
                }}
              />

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button
                    onClick={() => setAuthMode('signup')}
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    Sign up here
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sign Up Form */}
        {authMode === 'signup' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Get Started</h2>
                <p className="text-gray-600">Create your account to build your status page</p>
              </div>

              <ClerkSignUp
                routing="virtual"
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none border-none p-0",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    socialButtonsBlockButton: "border border-gray-300 hover:bg-gray-50 rounded-lg",
                    formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white rounded-lg",
                    footerActionLink: "text-blue-600 hover:text-blue-700",
                    formFieldInput: "rounded-lg border-gray-300",
                    dividerLine: "bg-gray-200",
                    dividerText: "text-gray-500",
                  },
                }}
              />

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <button
                    onClick={() => setAuthMode('signin')}
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    Sign in here
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center space-x-2 mb-8">
            <Shield className="h-6 w-6 text-blue-400" />
            <span className="text-lg font-bold">StatusPage</span>
          </div>
          <div className="text-center text-gray-400">
            <p>&copy; 2024 StatusPage. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
