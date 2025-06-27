// 👥 Department Users List Component
// Display and manage users within a department

import React from 'react';
import { Users, AlertTriangle } from 'lucide-react';
import { DepartmentUser } from '../../../../../services/departmentService';
import { formatDate } from '../utils/departmentFormatters';

interface DepartmentUsersListProps {
  users: DepartmentUser[];
  isLoading: boolean;
  error: string | null;
}

export const DepartmentUsersList: React.FC<DepartmentUsersListProps> = ({
  users,
  isLoading,
  error
}) => {
  const renderLoadingState = () => (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white rounded-lg p-4 border border-indigo-100 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );

  const renderErrorState = () => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-center text-red-600 mb-2">
        <AlertTriangle className="h-4 w-4 mr-2" />
        <span className="font-medium">Error Loading Users</span>
      </div>
      <p className="text-sm text-red-600">{error}</p>
    </div>
  );

  const renderEmptyState = () => (
    <div className="text-center py-6 bg-white rounded-lg border border-indigo-100">
      <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
      <p className="text-gray-600">No users in this department</p>
    </div>
  );

  const renderUsersList = () => (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
      {users.map((user) => (
        <div 
          key={user.id} 
          className="bg-white rounded-lg p-4 border border-indigo-100 hover:border-indigo-300 transition-colors"
        >
          <div className="flex justify-between items-start">
            <div>
              <h5 className="font-medium text-gray-900">
                {user.full_name || user.username}
              </h5>
              <p className="text-sm text-gray-500">{user.email}</p>
              {user.job_title && (
                <p className="text-xs text-gray-600 mt-1">{user.job_title}</p>
              )}
            </div>
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              user.is_active 
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {user.is_active ? 'Active' : 'Inactive'}
            </div>
          </div>
          {user.last_login_at && (
            <div className="mt-2 text-xs text-gray-500">
              Last login: {formatDate(user.last_login_at)}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200">
      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
        <div className="flex items-center">
          <Users className="h-5 w-5 text-indigo-600 mr-2" />
          Department Users
        </div>
        {isLoading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
        )}
      </h4>
      
      {error ? renderErrorState() : 
       isLoading ? renderLoadingState() : 
       users.length === 0 ? renderEmptyState() : 
       renderUsersList()}
    </div>
  );
};
