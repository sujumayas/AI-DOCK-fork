// 📊 Department Stats Grid Component
// Quick stats overview cards for department details

import React from 'react';
import { Users, DollarSign, BarChart3, TrendingUp } from 'lucide-react';
import { DepartmentWithStats } from '../../../../../services/departmentService';
import { formatCurrency, formatNumber, getUtilizationColor } from '../utils/departmentFormatters';

interface DepartmentStatsGridProps {
  department: DepartmentWithStats;
}

export const DepartmentStatsGrid: React.FC<DepartmentStatsGridProps> = ({ department }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {/* Total Users */}
      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Total Users</p>
            <p className="text-2xl font-bold text-blue-900">
              {formatNumber(department.user_count || 0)}
            </p>
          </div>
          <Users className="h-8 w-8 text-blue-500" />
        </div>
      </div>

      {/* Monthly Budget */}
      <div className="bg-green-50 p-4 rounded-xl border border-green-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-600">Monthly Budget</p>
            <p className="text-2xl font-bold text-green-900">
              {formatCurrency(department.monthly_budget)}
            </p>
          </div>
          <DollarSign className="h-8 w-8 text-green-500" />
        </div>
      </div>

      {/* Monthly Usage */}
      <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-purple-600">Monthly Usage</p>
            <p className="text-2xl font-bold text-purple-900">
              {formatCurrency(department.monthly_usage || 0)}
            </p>
          </div>
          <BarChart3 className="h-8 w-8 text-purple-500" />
        </div>
      </div>

      {/* Budget Usage Percentage */}
      <div className={`p-4 rounded-xl border ${getUtilizationColor(department.budget_utilization || 0)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Budget Usage</p>
            <p className="text-2xl font-bold">
              {Math.round((department.budget_utilization || 0) * 100) / 100}%
            </p>
          </div>
          <TrendingUp className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
};
