import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, User, MessageSquare, BarChart3 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface UnifiedTraversalButtonsProps {
  className?: string;
  onNewChat?: () => void; // Optional callback for new chat when in chat interface
  variant?: 'floating' | 'inline'; // New prop to control positioning
  size?: 'sm' | 'md'; // Size variant for different header contexts
}

/**
 * Unified Traversal Buttons Component
 * 
 * Provides consistent navigation buttons across all pages:
 * - 💬 Chat button: Always shows MessageSquare icon, navigates to chat or creates new chat when in chat interface
 * - 🏠 Dashboard button: Always navigates to main dashboard
 * - 👤 User Settings button: Always navigates to user settings
 * - 📊 Admin Dashboard button: Only visible to admin users, navigates to admin dashboard
 * 
 * Supports two variants:
 * - floating: Positioned in the top right corner (legacy behavior)
 * - inline: Integrated into page headers with responsive layout
 */
export const UnifiedTraversalButtons: React.FC<UnifiedTraversalButtonsProps> = ({
  className = '',
  onNewChat,
  variant = 'floating',
  size = 'md'
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const handleDashboard = () => {
    navigate('/dashboard');
  };

  const handleUserSettings = () => {
    navigate('/settings');
  };

  const handleAdminDashboard = () => {
    navigate('/admin');
  };

  const handleChat = () => {
    const isInChatInterface = location.pathname === '/chat';
    
    if (isInChatInterface && onNewChat) {
      // If we're in chat interface and have a callback, create new chat
      onNewChat();
    } else {
      // Otherwise, navigate to chat interface
      navigate('/chat');
    }
  };

  // Determine if we're in the chat interface
  const isInChatInterface = location.pathname === '/chat';
  
  // Check if user is admin
  const isAdmin = user?.is_admin === true;

  // Size configurations
  const sizeConfig = {
    sm: {
      button: 'w-8 h-8',
      icon: 'w-4 h-4',
      spacing: 'space-x-2'
    },
    md: {
      button: 'w-10 h-10 sm:w-12 sm:h-12',
      icon: 'w-4 h-4 sm:w-5 sm:h-5',
      spacing: 'space-x-2 sm:space-x-3'
    }
  };

  const config = sizeConfig[size];

  // Variant-specific styling
  const variantStyles = {
    floating: `fixed top-4 right-4 z-[60] flex items-center ${config.spacing}`,
    inline: `flex items-center ${config.spacing}`
  };

  // Base button styles
  const baseButtonClass = `${config.button} backdrop-blur-lg border rounded-full flex items-center justify-center text-white transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-xl group`;

  return (
    <div className={`${variantStyles[variant]} ${className}`}>
      {/* Chat Button */}
      <button
        onClick={handleChat}
        className={`${baseButtonClass} bg-green-600/80 hover:bg-green-500/90 border-green-400/30`}
        title={isInChatInterface ? "New Chat" : "Go to Chat"}
        aria-label={isInChatInterface ? "Create New Chat" : "Go to Chat Interface"}
      >
        <MessageSquare className={`${config.icon} group-hover:text-green-100 transition-colors`} />
      </button>

      {/* Admin Dashboard Button - Only visible to admins */}
      {isAdmin && (
        <button
          onClick={handleAdminDashboard}
          className={`${baseButtonClass} bg-orange-600/80 hover:bg-orange-500/90 border-orange-400/30`}
          title="Admin Dashboard"
          aria-label="Go to Admin Dashboard"
        >
          <BarChart3 className={`${config.icon} group-hover:text-orange-100 transition-colors`} />
        </button>
      )}

      {/* Dashboard Button */}
      <button
        onClick={handleDashboard}
        className={`${baseButtonClass} bg-blue-600/80 hover:bg-blue-500/90 border-blue-400/30`}
        title="Dashboard"
        aria-label="Go to Dashboard"
      >
        <Home className={`${config.icon} group-hover:text-blue-100 transition-colors`} />
      </button>

      {/* User Settings Button */}
      <button
        onClick={handleUserSettings}
        className={`${baseButtonClass} bg-gray-600/80 hover:bg-gray-500/90 border-gray-400/30 overflow-hidden`}
        title="User Settings"
        aria-label="Go to User Settings"
      >
        {user?.profile_picture_url ? (
          <img
            src={user.profile_picture_url}
            alt="Profile"
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <User className={`${config.icon} group-hover:text-gray-100 transition-colors`} />
        )}
      </button>
    </div>
  );
};