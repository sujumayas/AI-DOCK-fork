// 🏢 Department Details Modal Component
// Comprehensive department information display

import React from 'react';
import { 
  X, 
  Building2, 
  Mail, 
  MapPin, 
  Hash, 
  Calendar 
} from 'lucide-react';
import { Department, DepartmentWithStats } from '../../../../../services/departmentService';
import { formatDate } from '../utils/departmentFormatters';
import { useDepartmentUsers } from '../hooks/useDepartmentUsers';
import { DepartmentStatsGrid } from '../components/DepartmentStatsGrid';
import { BudgetAnalysisCard } from '../components/BudgetAnalysisCard';
import { UsageStatisticsCard } from '../components/UsageStatisticsCard';
import { DepartmentUsersList } from '../components/DepartmentUsersList';

interface DepartmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  department: Department | null;
}

export const DepartmentDetailsModal: React.FC<DepartmentDetailsModalProps> = ({
  isOpen,
  onClose,
  department
}) => {
  const { users, isLoading: loadingUsers, error: userError } = useDepartmentUsers({
    departmentId: department?.id,
    autoLoad: isOpen && !!department
  });

  if (!isOpen || !department) return null;
  
  const dept = department as DepartmentWithStats;
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 text-left overflow-hidden w-full max-w-6xl">
          
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{dept.name}</h3>
                  <p className="text-blue-100">Department Code: {dept.code}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="px-6 py-6">
            {/* Quick Stats Row */}
            <DepartmentStatsGrid department={dept} />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Left Column - Basic Information & Budget */}
              <div className="space-y-6">
                
                {/* Basic Information Card */}
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Building2 className="h-5 w-5 text-gray-600 mr-2" />
                    Basic Information
                  </h4>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Department Name</span>
                      <span className="text-sm text-gray-900 font-medium">{dept.name}</span>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Department Code</span>
                      <span className="text-sm text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded">
                        {dept.code}
                      </span>
                    </div>
                    
                    {dept.description && (
                      <div className="py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-600 block mb-1">Description</span>
                        <p className="text-sm text-gray-900">{dept.description}</p>
                      </div>
                    )}
                    
                    {dept.manager_email && (
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-600 flex items-center">
                          <Mail className="h-4 w-4 mr-1" />
                          Manager Email
                        </span>
                        <span className="text-sm text-blue-600 font-medium">{dept.manager_email}</span>
                      </div>
                    )}
                    
                    {dept.location && (
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-600 flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          Location
                        </span>
                        <span className="text-sm text-gray-900">{dept.location}</span>
                      </div>
                    )}
                    
                    {dept.cost_center && (
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-600 flex items-center">
                          <Hash className="h-4 w-4 mr-1" />
                          Cost Center
                        </span>
                        <span className="text-sm text-gray-900 font-mono">{dept.cost_center}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm font-medium text-gray-600 flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        Created
                      </span>
                      <span className="text-sm text-gray-900">{formatDate(dept.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Budget Utilization Card */}
                <BudgetAnalysisCard department={dept} />
              </div>

              {/* Right Column - Usage Statistics & Users */}
              <div className="space-y-6">
                
                {/* Usage Statistics Card */}
                <UsageStatisticsCard department={dept} />

                {/* User List Card */}
                <DepartmentUsersList 
                  users={users}
                  isLoading={loadingUsers}
                  error={userError}
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
