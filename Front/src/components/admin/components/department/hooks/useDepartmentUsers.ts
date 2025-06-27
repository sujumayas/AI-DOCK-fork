// 👥 Department Users Management Hook
// Custom hook for loading and managing department users

import { useState, useEffect } from 'react';
import { departmentService, DepartmentUser } from '../../../../../services/departmentService';

interface UseDepartmentUsersOptions {
  departmentId?: number;
  autoLoad?: boolean;
}

interface UseDepartmentUsersReturn {
  users: DepartmentUser[];
  isLoading: boolean;
  error: string | null;
  loadUsers: (departmentId: number) => Promise<void>;
  clearUsers: () => void;
  clearError: () => void;
}

export const useDepartmentUsers = ({ 
  departmentId, 
  autoLoad = true 
}: UseDepartmentUsersOptions = {}): UseDepartmentUsersReturn => {
  const [users, setUsers] = useState<DepartmentUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load users for a specific department
  const loadUsers = async (deptId: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const departmentUsers = await departmentService.getDepartmentUsers(deptId);
      setUsers(departmentUsers);
    } catch (err) {
      console.error('Failed to load department users:', err);
      setError('Failed to load department users. Please try again.');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear users data
  const clearUsers = () => {
    setUsers([]);
    setError(null);
  };

  // Clear error state
  const clearError = () => {
    setError(null);
  };

  // Auto-load users when department ID changes
  useEffect(() => {
    if (autoLoad && departmentId) {
      loadUsers(departmentId);
    } else if (!departmentId) {
      clearUsers();
    }
  }, [departmentId, autoLoad]);

  return {
    users,
    isLoading,
    error,
    loadUsers,
    clearUsers,
    clearError,
  };
};
