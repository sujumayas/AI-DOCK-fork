// 🛠️ Department Toolbar Component
// Search, filters, and action buttons for department management

import React from 'react';
import { Search, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { DepartmentSearchFilters } from '../../../services/departmentService';

interface DepartmentToolbarProps {
  searchFilters: DepartmentSearchFilters;
  selectedDepartments: number[];
  loading: boolean;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onCreateDepartment: () => void;
  onBulkDelete: () => void;
}

const DepartmentToolbar: React.FC<DepartmentToolbarProps> = ({
  searchFilters,
  selectedDepartments,
  loading,
  onSearchChange,
  onRefresh,
  onCreateDepartment,
  onBulkDelete
}) => {
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left side - Search and filters */}
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search departments..."
              value={searchFilters.search_query || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex flex-wrap gap-3">
          {/* Bulk delete action - only show when departments are selected */}
          {selectedDepartments.length > 0 && (
            <button
              onClick={onBulkDelete}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete ({selectedDepartments.length})</span>
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Create department */}
          <button
            onClick={onCreateDepartment}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Department</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartmentToolbar;
