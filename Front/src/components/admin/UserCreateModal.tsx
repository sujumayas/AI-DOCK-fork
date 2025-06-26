// ✨ User Creation Modal
// Modal component for creating new users with comprehensive form validation
// This showcases advanced form patterns and modal UX design

import React, { useState, useEffect } from 'react';
import { X, User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

import { adminService } from '../../services/adminService';
import { departmentService, DepartmentDropdownOption } from '../../services/departmentService';
import { roleService, RoleDropdownOption } from '../../services/roleService';
import { CreateUserRequest, FormState, FormErrors } from '../../types/admin';

interface UserCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: () => void; // Callback to refresh user list
}

/**
 * UserCreateModal Component
 * 
 * Learning: This component demonstrates advanced modal and form patterns:
 * - Controlled form inputs with validation
 * - Real-time validation feedback
 * - Loading states during submission
 * - Error handling and success states
 * - Accessibility considerations (ESC key, focus management)
 * - Form reset on close/success
 */
export const UserCreateModal: React.FC<UserCreateModalProps> = ({
  isOpen,
  onClose,
  onUserCreated
}) => {

  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================

  // Form data state
  const [formData, setFormData] = useState<CreateUserRequest>({
    email: '',
    username: '',
    full_name: '',
    password: '',
    role_id: 2, // Default to standard user role
    department_id: undefined,
    job_title: '',
    is_active: true,
    is_admin: false,
    bio: ''
  });

  // Form state management
  const [formState, setFormState] = useState<FormState<CreateUserRequest>>({
    data: formData,
    errors: {},
    isSubmitting: false,
    isDirty: false
  });

  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Department data - dynamic from API
  const [departments, setDepartments] = useState<DepartmentDropdownOption[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departmentsError, setDepartmentsError] = useState<string | null>(null);

  // Role data - dynamic from API
  const [roles, setRoles] = useState<RoleDropdownOption[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);

  // =============================================================================
  // FORM VALIDATION
  // =============================================================================

  /**
   * Validate individual form fields
   * 
   * Learning: Real-time validation provides immediate feedback to users,
   * improving the form completion experience.
   */
  const validateField = (name: keyof CreateUserRequest, value: any): string | undefined => {
    switch (name) {
      case 'email':
        if (!value) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
        break;
        
      case 'username':
        if (!value) return 'Username is required';
        if (value.length < 3) return 'Username must be at least 3 characters';
        if (!/^[a-zA-Z0-9._-]+$/.test(value)) return 'Username can only contain letters, numbers, dots, hyphens, and underscores';
        break;
        
      case 'full_name':
        if (!value) return 'Full name is required';
        if (value.length < 2) return 'Full name must be at least 2 characters';
        break;
        
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
        }
        break;
        
      case 'role_id':
        if (!value) return 'Role is required';
        break;
        
      default:
        break;
    }
    return undefined;
  };

  /**
   * Validate entire form
   * 
   * Learning: Form-level validation ensures all required fields are valid
   * before submission, preventing unnecessary API calls.
   */
  const validateForm = (data: CreateUserRequest): FormErrors => {
    const errors: FormErrors = {};
    
    // Validate required fields
    const requiredFields: (keyof CreateUserRequest)[] = [
      'email', 'username', 'full_name', 'password', 'role_id'
    ];
    
    requiredFields.forEach(field => {
      const error = validateField(field, data[field]);
      if (error) {
        errors[field] = error;
      }
    });
    
    return errors;
  };

  // =============================================================================
  // DEPARTMENT DATA LOADING
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
      
      console.log('✅ Departments loaded:', departmentOptions.length);
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
      
      console.log('✅ Roles loaded:', roleOptions.length);
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
  // EVENT HANDLERS
  // =============================================================================

  /**
   * Handle input changes with validation
   * 
   * Learning: This pattern provides immediate feedback while typing,
   * but only shows errors after the user has interacted with the field.
   */
  const handleInputChange = (name: keyof CreateUserRequest, value: any) => {
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
   * 
   * Learning: Validating on blur provides feedback without being too aggressive.
   * Users get validation feedback after they finish with a field.
   */
  const handleFieldBlur = (name: keyof CreateUserRequest) => {
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
   * 
   * Learning: Form submission includes comprehensive validation,
   * loading states, and proper error handling.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate entire form
    const errors = validateForm(formData);
    setFormState(prev => ({ ...prev, errors }));
    
    // Stop if there are validation errors
    if (Object.keys(errors).length > 0) {
      return;
    }
    
    try {
      setFormState(prev => ({ ...prev, isSubmitting: true }));
      
      // Create user via admin service
      await adminService.createUser(formData);
      
      // Show success state
      setSubmitSuccess(true);
      
      // Notify parent component to refresh user list
      onUserCreated();
      
      // Close modal after short delay to show success
      setTimeout(() => {
        handleClose();
      }, 1500);
      
    } catch (error) {
      console.error('Failed to create user:', error);
      
      // Set form-level error
      setFormState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          submit: error instanceof Error ? error.message : 'Failed to create user'
        }
      }));
    } finally {
      setFormState(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  /**
   * Handle modal close with cleanup
   * 
   * Learning: Proper cleanup prevents state from leaking between modal opens.
   */
  const handleClose = () => {
    // Reset form state
    setFormData({
      email: '',
      username: '',
      full_name: '',
      password: '',
      role_id: 2,
      department_id: undefined,
      job_title: '',
      is_active: true,
      is_admin: false,
      bio: ''
    });
    
    setFormState({
      data: formData,
      errors: {},
      isSubmitting: false,
      isDirty: false
    });
    
    setShowPassword(false);
    setSubmitSuccess(false);
    
    onClose();
  };

  // =============================================================================
  // EFFECTS
  // =============================================================================

  /**
   * Handle ESC key to close modal
   * 
   * Learning: Keyboard accessibility is important for modal UX.
   */
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      // Prevent body scroll when modal is open
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
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render input field with validation
   * 
   * Learning: Reusable input component reduces code duplication
   * and ensures consistent styling and validation display.
   */
  const renderInputField = (
    name: keyof CreateUserRequest,
    label: string,
    type: string = 'text',
    placeholder?: string,
    required: boolean = false
  ) => {
    const hasError = !!formState.errors[name];
    const value = formData[name] as string;

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
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
          {name === 'password' && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
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
   * Render select field with validation
   */
  const renderSelectField = (
    name: keyof CreateUserRequest,
    label: string,
    options: { value: any; label: string }[],
    required: boolean = false
  ) => {
    const hasError = !!formState.errors[name];
    const value = formData[name];

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <select
          value={value || ''}
          onChange={(e) => handleInputChange(name, e.target.value === '' ? undefined : Number(e.target.value))}
          onBlur={() => handleFieldBlur(name)}
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 transition-colors ${
            hasError
              ? 'border-red-300 focus:border-red-500'
              : 'border-gray-300 focus:border-blue-500'
          }`}
        >
          <option value="">Select {label}</option>
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
                No departments available. Create departments in the Admin Panel first.
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
   * Learning: This follows the same pattern as departments,
   * showing how to create consistent dropdown components with dynamic data.
   */
  const renderRoleField = () => {
    const hasError = !!formState.errors.role_id;
    const value = formData.role_id;

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Role
          <span className="text-red-500 ml-1">*</span>
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
              required
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
      <h3 className="text-lg font-semibold text-gray-900 mb-2">User Created Successfully!</h3>
      <p className="text-gray-600">
        The new user account has been created and added to the system.
      </p>
    </div>
  );

  // Don't render if modal is not open
  if (!isOpen) return null;

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border border-white/20 w-full max-w-2xl shadow-2xl rounded-2xl bg-white/95 backdrop-blur-sm">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <User className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Create New User</h3>
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
              {renderInputField('full_name', 'Full Name', 'text', 'John Doe', true)}
              {renderInputField('username', 'Username', 'text', 'john.doe', true)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderInputField('email', 'Email Address', 'email', 'john@company.com', true)}
              {renderInputField('password', showPassword ? 'text' : 'password', 'password', 'Enter secure password', true)}
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

            {/* Admin Settings */}
            <div className="flex items-center space-x-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_admin}
                  onChange={(e) => handleInputChange('is_admin', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Admin Privileges</span>
              </label>
            </div>

            {/* UX Note: New users are active by default. 
                Account status can be managed later via the user dashboard. */}

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
                disabled={formState.isSubmitting || Object.keys(validateForm(formData)).length > 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {formState.isSubmitting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>{formState.isSubmitting ? 'Creating...' : 'Create User'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
