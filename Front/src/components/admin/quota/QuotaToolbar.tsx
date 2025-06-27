// 🛠️ Quota Toolbar Component
// Toolbar with refresh and action buttons for quota management

import React from 'react';
import { RefreshCw, Plus } from 'lucide-react';

interface QuotaToolbarProps {
  loading: boolean;
  refreshing?: boolean;
  onRefresh: () => void;
  onCreateQuota: () => void;
  className?: string;
}

/**
 * QuotaToolbar Component
 * 
 * Provides refresh functionality and action buttons for quota management.
 * Follows the atomic component pattern used throughout the admin interface.
 */
const QuotaToolbar: React.FC<QuotaToolbarProps> = ({
  loading,
  refreshing = false,
  onRefresh,
  onCreateQuota,
  className = ''
}) => {
  return (
    <div className={`flex justify-between items-center ${className}`}>
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Quota Management</h2>
        <p className="text-blue-100 mt-1">
          Manage department usage limits and monitor consumption
        </p>
      </div>
      
      {/* Action buttons */}
      <div className="flex items-center space-x-3">
        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={loading || refreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 backdrop-blur-sm"
          title={refreshing ? 'Refreshing quotas...' : 'Refresh quota data'}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>

        {/* Create Quota Button */}
        <button
          onClick={onCreateQuota}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>Create Quota</span>
        </button>
      </div>
    </div>
  );
};

export default QuotaToolbar; 