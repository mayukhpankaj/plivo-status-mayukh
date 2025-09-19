import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useOrganization } from '../contexts/OrganizationContext';

export const Onboarding: React.FC = () => {
  const { user } = useUser();
  const { createOrganization, loading } = useOrganization();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    organizationName: '',
    organizationSlug: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData({
      organizationName: name,
      organizationSlug: generateSlug(name),
    });
    
    // Clear errors when user starts typing
    if (errors.organizationName) {
      setErrors(prev => ({ ...prev, organizationName: '' }));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = generateSlug(e.target.value);
    setFormData(prev => ({ ...prev, organizationSlug: slug }));
    
    // Clear errors when user starts typing
    if (errors.organizationSlug) {
      setErrors(prev => ({ ...prev, organizationSlug: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.organizationName.trim()) {
      newErrors.organizationName = 'Organization name is required';
    }
    
    if (!formData.organizationSlug.trim()) {
      newErrors.organizationSlug = 'Organization slug is required';
    } else if (formData.organizationSlug.length < 3) {
      newErrors.organizationSlug = 'Organization slug must be at least 3 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await createOrganization({
        name: formData.organizationName.trim(),
        slug: formData.organizationSlug.trim(),
      });
      
      // Redirect to dashboard after successful creation
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to create organization:', error);
      setErrors({ submit: 'Failed to create organization. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    // Navigate to dashboard without creating an organization
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome, {user?.firstName || 'there'}!
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Let's set up your first organization to get started
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700">
                Organization Name
              </label>
              <input
                id="organizationName"
                name="organizationName"
                type="text"
                required
                value={formData.organizationName}
                onChange={handleNameChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Enter your organization name"
              />
              {errors.organizationName && (
                <p className="mt-1 text-sm text-red-600">{errors.organizationName}</p>
              )}
            </div>

            <div>
              <label htmlFor="organizationSlug" className="block text-sm font-medium text-gray-700">
                Organization Slug
              </label>
              <input
                id="organizationSlug"
                name="organizationSlug"
                type="text"
                required
                value={formData.organizationSlug}
                onChange={handleSlugChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="organization-slug"
              />
              <p className="mt-1 text-xs text-gray-500">
                This will be used in your status page URL: status.example.com/{formData.organizationSlug}
              </p>
              {errors.organizationSlug && (
                <p className="mt-1 text-sm text-red-600">{errors.organizationSlug}</p>
              )}
            </div>
          </div>

          {errors.submit && (
            <div className="text-sm text-red-600 text-center">{errors.submit}</div>
          )}

          <div className="flex flex-col space-y-3">
            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting || loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Organization...
                </div>
              ) : (
                'Create Organization'
              )}
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;
