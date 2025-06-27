// 📈 Usage Statistics Card Component
// Department usage metrics display

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { DepartmentWithStats } from '../../../../../services/departmentService';
import { formatNumber } from '../utils/departmentFormatters';

interface UsageStatisticsCardProps {
  department: DepartmentWithStats;
}

export const UsageStatisticsCard: React.FC<UsageStatisticsCardProps> = ({ department }) => {
  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <BarChart3 className="h-5 w-5 text-green-600 mr-2" />
        Usage Statistics
      </h4>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Monthly Requests */}
        <div className="bg-white p-4 rounded-lg border border-green-100">
          <div className="text-2xl font-bold text-green-600">
            {formatNumber(department.monthly_requests || 0)}
          </div>
          <div className="text-sm text-gray-600">Monthly Requests</div>
        </div>
        
        {/* Monthly Tokens */}
        <div className="bg-white p-4 rounded-lg border border-green-100">
          <div className="text-2xl font-bold text-green-600">
            {formatNumber(department.monthly_tokens || 0)}
          </div>
          <div className="text-sm text-gray-600">Monthly Tokens</div>
        </div>
        
        {/* Active Users Today */}
        <div className="bg-white p-4 rounded-lg border border-green-100">
          <div className="text-2xl font-bold text-blue-600">
            {formatNumber(department.active_users_today || 0)}
          </div>
          <div className="text-sm text-gray-600">Active Today</div>
        </div>
        
        {/* Admin Users */}
        <div className="bg-white p-4 rounded-lg border border-green-100">
          <div className="text-2xl font-bold text-purple-600">
            {formatNumber(department.admin_user_count || 0)}
          </div>
          <div className="text-sm text-gray-600">Admin Users</div>
        </div>
      </div>
    </div>
  );
};
