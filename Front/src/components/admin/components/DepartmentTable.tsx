// 📋 Department Table Component
// Displays departments in a data table with actions

import React from 'react';
import { Building2, Edit3, Trash2, Plus } from 'lucide-react';
import { DepartmentWithStats } from '../../../services/departmentService';

interface DepartmentTableProps {
  departments: DepartmentWithStats[];
  selectedDepartments: number[];
  loading: boolean;
  onSelectDepartment: (id: number, selected: boolean) => void;
  onSelectAllDepartments: (selected: boolean) => void;
  onEditDepartment: (department: DepartmentWithStats) => void;
  onDeleteDepartment: (department: DepartmentWithStats) => void;
  onViewDepartment: (department: DepartmentWithStats) => void;
  onCreateDepartment: () => void;
  searchQuery?: string;
}

const DepartmentTable: React.FC<DepartmentTableProps> = ({
  departments,
  selectedDepartments,
  loading,
  onSelectDepartment,
  onSelectAllDepartments,
  onEditDepartment,
  onDeleteDepartment,
  onViewDepartment,
  onCreateDepartment,
  searchQuery
}) => {
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
      {/* Table header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Departments ({departments.length})
          </h3>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={selectedDepartments.length === departments.length && departments.length > 0}
              onChange={(e) => onSelectAllDepartments(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500">Select All</span>
          </div>
        </div>
      </div>

      {/* Table content */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={selectedDepartments.length === departments.length && departments.length > 0}
                  onChange={(e) => onSelectAllDepartments(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Users
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {departments.map((department) => (
              <tr 
                key={department.id}
                className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                  selectedDepartments.includes(department.id) ? 'bg-blue-50' : ''
                }`}
                onClick={(e) => {
                  // Don't trigger row click if clicking on checkbox or action buttons
                  if ((e.target as HTMLElement).closest('input, button')) return;
                  onViewDepartment(department);
                }}
              >
                {/* Selection checkbox */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedDepartments.includes(department.id)}
                    onChange={(e) => onSelectDepartment(department.id, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>

                {/* Department info */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mr-3">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{department.name}</div>
                      <div className="text-sm text-gray-500">{department.code}</div>
                      {department.description && (
                        <div className="text-xs text-gray-400 mt-1 max-w-xs truncate">
                          {department.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Users */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{department.user_count || 0}</div>
                  <div className="text-xs text-gray-500">
                    total users
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onEditDepartment(department)}
                      className="text-indigo-600 hover:text-indigo-900 transition-colors"
                      title="Edit department"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => onDeleteDepartment(department)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                      title="Delete department"
                      disabled={department.user_count > 0}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {departments.length === 0 && !loading && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No departments found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery 
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first department'
            }
          </p>
          {!searchQuery && (
            <button
              onClick={onCreateDepartment}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Department</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DepartmentTable;
