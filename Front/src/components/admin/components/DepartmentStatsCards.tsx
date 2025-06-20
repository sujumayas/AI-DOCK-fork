// 📊 Department Statistics Cards Component
// Displays key metrics and statistics for department overview

import React from 'react';
import { Building2, Users, DollarSign, BarChart3 } from 'lucide-react';
import { DepartmentWithStats, departmentService } from '../../../services/departmentService';

interface DepartmentStatsCardsProps {
  departmentStats: {
    total: number;
    totalBudget: number;
    totalUsage: number;
    avgUtilization: number;
  };
  departments: DepartmentWithStats[];
}

const DepartmentStatsCards: React.FC<DepartmentStatsCardsProps> = ({ 
  departmentStats, 
  departments 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Total Departments */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Departments</p>
            <p className="text-3xl font-bold text-gray-900">{departmentStats.total}</p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm">
          <span className="text-gray-500">{departmentStats.total} total departments</span>
        </div>
      </div>

      {/* Total Budget */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Monthly Budget</p>
            <p className="text-3xl font-bold text-gray-900">
              {departmentService.formatBudget(departmentStats.totalBudget)}
            </p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-sm text-gray-500">
            {departmentService.formatBudget(departmentStats.totalUsage)} used
          </div>
        </div>
      </div>

      {/* Average Utilization */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Avg Utilization</p>
            <p className="text-3xl font-bold text-gray-900">
              {departmentService.formatUtilization(departmentStats.avgUtilization)}
            </p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${departmentService.getBudgetUtilizationColor(departmentStats.avgUtilization)}`}
              style={{ width: `${Math.min(departmentStats.avgUtilization, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Total Users */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Users</p>
            <p className="text-3xl font-bold text-gray-900">
              {departments.reduce((sum, d) => sum + (d.user_count || 0), 0)}
            </p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-500">
          Across all departments
        </div>
      </div>
    </div>
  );
};

export default DepartmentStatsCards;
