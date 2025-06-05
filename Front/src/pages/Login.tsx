// 🔐 Login Page Component - Updated for React Router
// This is where users enter their credentials to access AI Dock

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { authService } from '../services/authService';
import { useAuth } from '../hooks/useAuth';
import { LoginCredentials } from '../types/auth';

export const LoginPage: React.FC = () => {
  // 🧭 React Router navigation hook
  const navigate = useNavigate();
  
  // 🔐 Use our custom authentication hook
  const { isAuthenticated, login } = useAuth();

  // 📊 REACT STATE: These values change over time and trigger UI updates
  
  // Form data - what user types
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });

  // UI state - how the form behaves
  const [isLoading, setIsLoading] = useState(false); // Show spinner during login
  const [error, setError] = useState<string | null>(null); // Error message to show
  const [showPassword, setShowPassword] = useState(false); // Toggle password visibility

  // 🚀 Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      console.log('✅ User already authenticated, redirecting to dashboard...')
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // 🔄 FORM HANDLERS: Functions that respond to user interactions

  // Handle input field changes (email and password)
  const handleInputChange = (field: keyof LoginCredentials, value: string) => {
    setCredentials(prev => ({
      ...prev, // Keep other fields unchanged
      [field]: value // Update only the field that changed
    }));
    // Clear error when user starts typing again
    if (error) setError(null);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent page refresh (default form behavior)
    
    // Basic validation
    if (!credentials.email || !credentials.password) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true); // Show loading spinner
    setError(null); // Clear any previous errors

    try {
      // Call our authService to login
      const response = await authService.login(credentials);
      
      // Login successful! 🎉
      console.log('Login successful:', response);
      
      // Update authentication state using our hook
      login();
      
      // Navigate to dashboard
      console.log('🎯 Redirecting to dashboard...');
      navigate('/dashboard', { replace: true });
      
    } catch (err) {
      // Login failed - show error message
      console.error('Login error:', err); // Debug info
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
    } finally {
      setIsLoading(false); // Hide loading spinner
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 p-3 rounded-full">
              <Shield className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to AI Dock</h1>
          <p className="text-gray-600">Sign in to access your secure AI gateway</p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={credentials.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Enter your email"
                  autoComplete="email"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Need access? Contact your system administrator
            </p>
          </div>
        </div>

        {/* Development Note */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Development Mode:</strong> Use the test account created in your backend
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            🚀 Router-enabled login with automatic redirect to dashboard
          </p>
        </div>
      </div>
    </div>
  );
};
