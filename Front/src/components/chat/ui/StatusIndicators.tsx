// 📊 Connection Status Indicators Component
// Visual status indicators for connection and system state
// Extracted from ChatInterface.tsx for better modularity

import React from 'react';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export interface StatusIndicatorsProps {
  connectionStatus: 'checking' | 'connected' | 'error';
  isMobile: boolean;
}

export const StatusIndicators: React.FC<StatusIndicatorsProps> = ({
  connectionStatus,
  isMobile
}) => {
  return (
    <div className="flex items-center space-x-2">
      {connectionStatus === 'checking' && (
        <div className="flex items-center text-blue-200 text-xs md:text-sm">
          <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin mr-1" />
          <span className="hidden sm:inline">Connecting...</span>
          <span className="sm:hidden">...</span>
        </div>
      )}
      {connectionStatus === 'connected' && (
        <div className="flex items-center text-green-300 text-xs md:text-sm">
          <CheckCircle className="w-3 h-3 md:w-4 md:h-4 mr-1" />
          <span className="hidden sm:inline">Connected</span>
          <span className="sm:hidden">✓</span>
        </div>
      )}
      {connectionStatus === 'error' && (
        <div className="flex items-center text-red-300 text-xs md:text-sm">
          <AlertCircle className="w-3 h-3 md:w-4 md:h-4 mr-1" />
          <span className="hidden sm:inline">Connection Error</span>
          <span className="sm:hidden">Error</span>
        </div>
      )}
    </div>
  );
};