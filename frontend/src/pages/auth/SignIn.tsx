import React, { useState } from 'react';
import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Eye, EyeOff, Shield, Users, BarChart3, AlertTriangle } from 'lucide-react';

export const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });

  // Get the intended destination from location state
  const from = location.state?.from?.pathname || '/dashboard';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // This would integrate with your custom auth system
    console.log('Custom login attempt:', formData);
    // For now, redirect to dashboard (you'd implement actual auth logic here)
    navigate(from);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="flex min-h-screen">
        {/* Left side - Branding and Features */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 p-12 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10 flex flex-col justify-center max-w-md">
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-4">Status Page Platform</h1>
              <p className="text-xl text-blue-100">
                Monitor, communicate, and maintain trust with your users through transparent status updates.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Real-time Monitoring</h3>
                  <p className="text-blue-100 text-sm">Track service health and performance in real-time</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Team Collaboration</h3>
                  <p className="text-blue-100 text-sm">Coordinate incident response with your team</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-white/20 p-2 rounded-lg">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Analytics & Insights</h3>
                  <p className="text-blue-100 text-sm">Gain insights into service performance and incidents</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-8">
            {/* Header */}
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900">Welcome back</h2>
              <p className="mt-2 text-gray-600">
                Sign in to access your status page dashboard
              </p>
            </div>

            {/* Toggle between Clerk and Custom Form */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setShowCustomForm(false)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  !showCustomForm
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Quick Sign In
              </button>
              <button
                onClick={() => setShowCustomForm(true)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  showCustomForm
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Email & Password
              </button>
            </div>

            {/* Clerk Sign In */}
            {!showCustomForm && (
              <div className="space-y-6">
                <ClerkSignIn
                  routing="path"
                  path="/sign-in"
                  redirectUrl={from}
                  signUpUrl="/sign-up"
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      card: "shadow-lg border border-gray-200 rounded-xl",
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
              </div>
            )}

            {/* Custom Login Form */}
            {showCustomForm && (
              <form onSubmit={handleCustomLogin} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="rememberMe"
                      name="rememberMe"
                      type="checkbox"
                      checked={formData.rememberMe}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
                      Remember me
                    </label>
                  </div>

                  <Link
                    to="/forgot-password"
                    className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Sign in
                </Button>
              </form>
            )}

            {/* Footer */}
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link
                  to="/sign-up"
                  state={{ from: location.state?.from }}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Sign up here
                </Link>
              </p>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Secure login protected by enterprise-grade security
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
