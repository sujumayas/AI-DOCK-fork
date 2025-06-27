// 📝 User Edit Modal
// Modal component for editing existing users with pre-filled data
// Similar to create modal but with update functionality

import React, { useState, useEffect } from 'react';
import { X, User, Mail, Eye, EyeOff, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

import { adminService } from '../../services/adminService';
import { departmentService, DepartmentDropdownOption } from '../../services/departmentService';
import { roleService, RoleDropdownOption } from '../../services/roleService';
import { User as UserType, UpdateUserRequest, FormState, FormErrors } from '../../types/admin';

interface UserEditModalProps {
  isOpen: boolean;
  user: UserType | null; // User to edit
  onClose: () => void;
  onUserUpdated: () => void; // Callback to refresh user list
}

/**
 * UserEditModal Component
 * 
 * Learning: This component demonstrates editing patterns:
 * - Pre-populating forms with existing data
 * - Handling partial updates (only changed fields)
 * - Comparing original vs current state
 * - Different validation for updates vs creates
 */
export const UserEditModal: React.FC<UserEditModalProps> = ({
  isOpen,
  user,
  onClose,
  onUserUpdated
}) => {

  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================

  // Form data state - initialize with user data when user prop changes
  const [formData, setFormData] = useState<UpdateUserRequest>({});
  const [originalData, setOriginalData] = useState<UpdateUserRequest>({});

  // Form state management
  const [formState, setFormState] = useState<FormState<UpdateUserRequest>>({
    data: formData,
    errors: {},
    isSubmitting: false,
    isDirty: false
  });

  // UI states
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Department data - dynamic from API
  const [departments, setDepartments] = useState<DepartmentDropdownOption[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departmentsError, setDepartmentsError] = useState<string | null>(null);

  // Role data - dynamic from API
  const [roles, setRoles] = useState<RoleDropdownOption[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  /**
   * Initialize form data when user changes
   * 
   * Learning: When editing, we need to populate the form with existing data.
   * We also keep track of original data to detect changes.
   */
  useEffect(() => {
    if (user && isOpen) {
      const userData: UpdateUserRequest = {
        email: user.email,
        username: user.username,
        full_name: user.full_name || undefined,
        role_id: user.role_id,
        department_id: user.department_id || undefined,
        job_title: user.job_title || undefined,
        is_active: user.is_active,
        is_admin: user.is_admin,
        bio: user.bio || undefined
      };
      
      setFormData(userData);
      setOriginalData(userData);
      setFormState({
        data: userData,
        errors: {},
        isSubmitting: false,
        isDirty: false
      });
    }
  }, [user, isOpen]);

  /**
   * Handle ESC key to close modal
   */
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  /**
   * Load reference data when modal opens
   * 
   * Learning: This useEffect demonstrates dependency arrays:
   * - Runs when `isOpen` changes from false to true
   * - Only fetches data when we actually need it
   * - Prevents unnecessary API calls when modal is closed
   * - Loads both departments and roles in parallel for efficiency
   */
  useEffect(() => {
    if (isOpen) {
      // Load departments and roles in parallel for better performance
      Promise.all([
        fetchDepartments(),
        fetchRoles()
      ]).catch(error => {
        console.error('❌ Failed to load reference data:', error);
      });
    }
  }, [isOpen]);

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  /**
   * Fetch departments for dropdown
   * 
   * Learning: This function demonstrates API integration patterns:
   * - Loading states to show user something is happening
   * - Error handling for when API calls fail
   * - Async/await for clean promise handling
   */
  const fetchDepartments = async () => {
    try {
      setDepartmentsLoading(true);
      setDepartmentsError(null);
      
      // Call the department service to get dropdown options
      const departmentOptions = await departmentService.getDepartmentsForDropdown();
      
      // Update state with the fetched departments
      setDepartments(departmentOptions);
      
      console.log('✅ Departments loaded for edit modal:', departmentOptions.length);
    } catch (error) {
      console.error('❌ Failed to load departments:', error);
      setDepartmentsError('Failed to load departments. Please try again.');
      
      // Fallback: Use empty array so form still works
      setDepartments([]);
    } finally {
      setDepartmentsLoading(false);
    }
  };

  /**
   * Fetch roles for dropdown
   * 
   * Learning: This follows the same pattern as departments,
   * demonstrating consistent API integration across different entity types.
   */
  const fetchRoles = async () => {
    try {
      setRolesLoading(true);
      setRolesError(null);
      
      // Call the role service to get dropdown options
      const roleOptions = await roleService.getRolesForDropdown();
      
      // Update state with the fetched roles
      setRoles(roleOptions);
      
      console.log('✅ Roles loaded for edit modal:', roleOptions.length);
    } catch (error) {
      console.error('❌ Failed to load roles:', error);
      setRolesError('Failed to load roles. Please try again.');
      
      // Fallback: Use empty array so form still works
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  };

  // =============================================================================
  // FORM VALIDATION
  // =============================================================================

  /**
   * Validate individual form fields
   * 
   * Learning: Edit validation is often more lenient than create validation
   * since some fields might be optional in updates.
   */
  const validateField = (name: keyof UpdateUserRequest, value: any): string | undefined => {
    switch (name) {
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Please enter a valid email address';
        }
        break;
        
      case 'username':
        if (value && value.length < 3) {
          return 'Username must be at least 3 characters';
        }
        if (value && !/^[a-zA-Z0-9._-]+$/.test(value)) {
          return 'Username can only contain letters, numbers, dots, hyphens, and underscores';
        }
        break;
        
      case 'full_name':
        if (value && value.length < 2) {
          return 'Full name must be at least 2 characters';
        }
        break;
        
      default:
        break;
    }
    return undefined;
  };

  /**
   * Check if form has changes
   * 
   * Learning: Only submit updates if data has actually changed.
   * This prevents unnecessary API calls and provides better UX.
   */
  const hasChanges = (): boolean => {
    return Object.keys(formData).some(key => {
      const formValue = formData[key as keyof UpdateUserRequest];
      const originalValue = originalData[key as keyof UpdateUserRequest];
      return formValue !== originalValue;
    });
  };

  /**
   * Get only the changed fields for update
   * 
   * Learning: Send only modified data to the API for efficiency.
   */
  const getChangedFields = (): UpdateUserRequest => {
    const changes: Partial<UpdateUserRequest> = {};
    
    Object.keys(formData).forEach(key => {
      const fieldKey = key as keyof UpdateUserRequest;
      const formValue = formData[fieldKey];
      const originalValue = originalData[fieldKey];
      
      if (formValue !== originalValue) {
        (changes as any)[fieldKey] = formValue;
      }
    });
    
    return changes as UpdateUserRequest;
  };

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  /**
   * Handle input changes with validation
   */
  const handleInputChange = (name: keyof UpdateUserRequest, value: any) => {
    // Update form data
    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);
    
    // Mark form as dirty
    setFormState(prev => ({ ...prev, isDirty: true }));
    
    // Validate field if it has been touched and has errors
    if (formState.errors[name]) {
      const fieldError = validateField(name, value);
      setFormState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [name]: fieldError
        }
      }));
    }
  };

  /**
   * Handle field blur (when user leaves a field)
   */
  const handleFieldBlur = (name: keyof UpdateUserRequest) => {
    const fieldError = validateField(name, formData[name]);
    setFormState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [name]: fieldError
      }
    }));
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    // Check if there are any changes
    if (!hasChanges()) {
      setFormState(prev => ({
        ...prev,
        errors: { submit: 'No changes detected' }
      }));
      return;
    }
    
    // Validate all fields
    const errors: FormErrors = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key as keyof UpdateUserRequest, formData[key as keyof UpdateUserRequest]);
      if (error) {
        errors[key] = error;
      }
    });
    
    if (Object.keys(errors).length > 0) {
      setFormState(prev => ({ ...prev, errors }));
      return;
    }
    
    try {
      setFormState(prev => ({ ...prev, isSubmitting: true }));
      
      // Update user with only changed fields
      const changes = getChangedFields();
      await adminService.updateUser(user.id, changes);
      
      // Show success state
      setSubmitSuccess(true);
      
      // Notify parent component to refresh user list
      onUserUpdated();
      
      // Close modal after short delay to show success
      setTimeout(() => {
        handleClose();
      }, 1500);
      
    } catch (error) {
      console.error('Failed to update user:', error);
      
      setFormState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          submit: error instanceof Error ? error.message : 'Failed to update user'
        }
      }));
    } finally {
      setFormState(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  /**
   * Handle modal close with cleanup
   */
  const handleClose = () => {
    // Reset all states
    setFormData({});
    setOriginalData({});
    setFormState({
      data: {},
      errors: {},
      isSubmitting: false,
      isDirty: false
    });
    setSubmitSuccess(false);
    setIsLoading(false);
    
    // Reset department and role data
    setDepartments([]);
    setDepartmentsLoading(false);
    setDepartmentsError(null);
    setRoles([]);
    setRolesLoading(false);
    setRolesError(null);
    
    onClose();
  };

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render input field with validation
   */
  const renderInputField = (
    name: keyof UpdateUserRequest,
    label: string,
    type: string = 'text',
    placeholder?: string
  ) => {
    const hasError = !!formState.errors[name];
    const value = formData[name] as string;

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <div className="relative">
          <input
            type={type}
            value={value || ''}
            onChange={(e) => handleInputChange(name, e.target.value)}
            onBlur={() => handleFieldBlur(name)}
            placeholder={placeholder}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 transition-colors ${
              hasError
                ? 'border-red-300 focus:border-red-500'
                : 'border-gray-300 focus:border-blue-500'
            }`}
          />
        </div>
        {hasError && (
          <p className="mt-1 text-sm text-red-600 flex items-center">
            <AlertCircle className="h-4 w-4 mr-1" />
            {formState.errors[name]}
          </p>
        )}
      </div>
    );
  };

  /**
   * Render department field with dynamic loading
   * 
   * Learning: This function demonstrates dynamic dropdown patterns:
   * - Loading states while fetching data
   * - Error handling for failed API calls
   * - Real-time data from backend
   * - Graceful fallback when no data available
   */
  const renderDepartmentField = () => {
    const hasError = !!formState.errors.department_id;
    const value = formData.department_id;

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Department
        </label>
        
        {/* Show loading state while departments are being fetched */}
        {departmentsLoading ? (
          <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            <span className="text-gray-500">Loading departments...</span>
          </div>
        ) : (
          <>
            <select
              value={value || ''}
              onChange={(e) => handleInputChange('department_id', e.target.value === '' ? undefined : Number(e.target.value))}
              onBlur={() => handleFieldBlur('department_id')}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 transition-colors ${
                hasError
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
            >
              <option value="">Select Department</option>
              {departments.map(dept => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </select>
            
            {/* Show error state if departments failed to load */}
            {departmentsError && (
              <p className="mt-1 text-sm text-amber-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {departmentsError}
              </p>
            )}
            
            {/* Show validation error if user hasn't selected a department */}
            {hasError && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {formState.errors.department_id}
              </p>
            )}
            
            {/* Show helpful info about department management */}
            {!departmentsLoading && departments.length === 0 && !departmentsError && (
              <p className="mt-1 text-sm text-blue-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                No departments available. Contact your system administrator.
              </p>
            )}
          </>
        )}
      </div>
    );
  };

  /**
   * Render role field with dynamic loading
   * 
   * Learning: This function demonstrates comprehensive dropdown UX patterns,
   * showing how to create consistent dropdown components with dynamic data.
   */
  const renderRoleField = () => {
    const hasError = !!formState.errors.role_id;
    const value = formData.role_id;

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Role
        </label>
        
        {/* Show loading state while roles are being fetched */}
        {rolesLoading ? (
          <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            <span className="text-gray-500">Loading roles...</span>
          </div>
        ) : (
          <>
            <select
              value={value || ''}
              onChange={(e) => handleInputChange('role_id', e.target.value === '' ? undefined : Number(e.target.value))}
              onBlur={() => handleFieldBlur('role_id')}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 transition-colors ${
                hasError
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
            >
              <option value="">Select Role</option>
              {roles.map(role => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            
            {/* Show error state if roles failed to load */}
            {rolesError && (
              <p className="mt-1 text-sm text-amber-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {rolesError}
              </p>
            )}
            
            {/* Show validation error if user hasn't selected a role */}
            {hasError && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {formState.errors.role_id}
              </p>
            )}
            
            {/* Show helpful info about role management */}
            {!rolesLoading && roles.length === 0 && !rolesError && (
              <p className="mt-1 text-sm text-blue-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                No roles available. Contact your system administrator.
              </p>
            )}
          </>
        )}
      </div>
    );
  };

  /**
   * Render success state
   */
  const renderSuccessState = () => (
    <div className="text-center py-8">
      <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">User Updated Successfully!</h3>
      <p className="text-gray-600">
        The user information has been updated in the system.
      </p>
    </div>
  );

  // Don't render if modal is not open or no user
  if (!isOpen || !user) return null;

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <User className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Edit User: {user.full_name || user.username}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Modal Content */}
        {submitSuccess ? (
          renderSuccessState()
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderInputField('full_name', 'Full Name', 'text', 'John Doe')}
              {renderInputField('username', 'Username', 'text', 'john.doe')}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              {renderInputField('email', 'Email Address', 'email', 'john@company.com')}
            </div>

            {/* Role and Department */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderRoleField()}
              
              {renderDepartmentField()}
            </div>

            {/* Optional Information */}
            {renderInputField('job_title', 'Job Title', 'text', 'Senior Developer')}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={formData.bio || ''}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="Brief description about the user..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* User Settings */}
            <div className="flex items-center space-x-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active ?? false}
                  onChange={(e) => handleInputChange('is_active', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Active Account</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_admin ?? false}
                  onChange={(e) => handleInputChange('is_admin', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Admin Privileges</span>
              </label>
            </div>

            {/* Changes indicator */}
            {hasChanges() && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <p className="text-sm text-amber-800">
                  💾 You have unsaved changes that will be updated.
                </p>
              </div>
            )}

            {/* Form-level error */}
            {formState.errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                  <span className="text-sm text-red-800">{formState.errors.submit}</span>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                disabled={formState.isSubmitting}
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={formState.isSubmitting || !hasChanges()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {formState.isSubmitting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>{formState.isSubmitting ? 'Updating...' : 'Update User'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
