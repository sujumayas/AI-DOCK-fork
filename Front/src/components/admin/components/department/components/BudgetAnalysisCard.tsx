// 💳 Budget Analysis Card Component
// Detailed budget utilization display for department details

import React from 'react';
import { CreditCard } from 'lucide-react';
import { DepartmentWithStats } from '../../../../../services/departmentService';
import { formatCurrency, getUtilizationBarColor } from '../utils/departmentFormatters';

interface BudgetAnalysisCardProps {
  department: DepartmentWithStats;
}

export const BudgetAnalysisCard: React.FC<BudgetAnalysisCardProps> = ({ department }) => {
  const remainingBudget = Math.max(0, department.monthly_budget - (department.monthly_usage || 0));
  const utilization = department.budget_utilization || 0;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
        Budget Analysis
      </h4>
      
      <div className="space-y-4">
        {/* Monthly Budget */}
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">Monthly Budget</span>
          <span className="text-lg font-bold text-gray-900">
            {formatCurrency(department.monthly_budget)}
          </span>
        </div>
        
        {/* Current Usage */}
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">Current Usage</span>
          <span className="text-lg font-semibold text-blue-600">
            {formatCurrency(department.monthly_usage || 0)}
          </span>
        </div>
        
        {/* Remaining Budget */}
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">Remaining Budget</span>
          <span className="text-lg font-semibold text-green-600">
            {formatCurrency(remainingBudget)}
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Budget Utilization</span>
            <span className={`font-semibold ${
              utilization > 90 ? 'text-red-600' : 
              utilization > 75 ? 'text-yellow-600' : 
              'text-green-600'
            }`}>
              {Math.round(utilization * 100) / 100}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${getUtilizationBarColor(utilization)}`}
              style={{ width: `${Math.min(100, utilization)}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};
