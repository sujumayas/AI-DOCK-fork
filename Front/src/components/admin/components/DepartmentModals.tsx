// 🔧 Department Modals Component
// Manages all modal dialogs for department operations

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  Users, 
  DollarSign, 
  BarChart3, 
  Mail, 
  MapPin, 
  Hash, 
  Calendar, 
  TrendingUp,
  CreditCard,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';

import { 
  departmentService,
  DepartmentCreate, 
  DepartmentUpdate,
  Department,
  DepartmentWithStats,
  DepartmentUser
} from '../../../services/departmentService';

interface DepartmentModalsProps {
  state: {
    showCreateModal: boolean;
    showEditModal: boolean;
    showDeleteModal: boolean;
    showBulkDeleteModal: boolean;
    showDetailsModal: boolean;
    editingDepartment: Department | null;
    deletingDepartment: Department | null;
    viewingDepartment: Department | null;
    selectedDepartments: number[];
    departments: DepartmentWithStats[];
  };
  onCloseModals: () => void;
  onCreateDepartment: (data: DepartmentCreate) => Promise<void>;
  onUpdateDepartment: (id: number, data: DepartmentUpdate) => Promise<void>;
  onDeleteDepartment: (id: number) => Promise<void>;
  onBulkDelete: () => Promise<void>;
}

const DepartmentModals: React.FC<DepartmentModalsProps> = ({
  state,
  onCloseModals,
  onCreateDepartment,
  onUpdateDepartment,
  onDeleteDepartment,
  onBulkDelete
}) => {
  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================
  
  const [departmentUsers, setDepartmentUsers] = useState<DepartmentUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  // Create Department form state
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    monthly_budget: '',
    manager_email: '',
    // location: '',
    // cost_center: '',
  });

  // Validation and submission state
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle input changes for the form
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: '' })); // Clear error on change
  };

  // Validate form fields
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!form.name.trim()) {
      errors.name = 'Department name is required.';
    } else if (form.name.trim().length < 2) {
      errors.name = 'Department name must be at least 2 characters.';
    }
    if (!form.code.trim()) {
      errors.code = 'Department code is required.';
    } else if (form.code.trim().length < 2) {
      errors.code = 'Department code must be at least 2 characters.';
    }
    if (!form.monthly_budget || isNaN(Number(form.monthly_budget)) || Number(form.monthly_budget) < 0) {
      errors.monthly_budget = 'Monthly budget must be a positive number.';
    }
    if (form.manager_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.manager_email)) {
      errors.manager_email = 'Invalid email address.';
    }
    return errors;
  };

  // Handle form submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setIsSubmitting(true);
    try {
      await onCreateDepartment({
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim() || undefined,
        monthly_budget: Number(form.monthly_budget),
        manager_email: form.manager_email.trim() || undefined,
        // location: form.location.trim() || undefined,
        // cost_center: form.cost_center.trim() || undefined,
      });
      setForm({ name: '', code: '', description: '', monthly_budget: '', manager_email: '' });
      setFormErrors({});
      onCloseModals();
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to create department.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =============================================================================
  // EFFECTS
  // =============================================================================

  useEffect(() => {
    const loadUsers = async () => {
      if (!state.showDetailsModal || !state.viewingDepartment) return;
      
      setLoadingUsers(true);
      setUserError(null);
      try {
        const users = await departmentService.getDepartmentUsers(state.viewingDepartment.id);
        setDepartmentUsers(users);
      } catch (error) {
        console.error('Failed to load department users:', error);
        setUserError('Failed to load department users. Please try again.');
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, [state.showDetailsModal, state.viewingDepartment]);

  // Prefill form when editingDepartment changes (Edit Modal)
  useEffect(() => {
    if (state.showEditModal && state.editingDepartment) {
      setForm({
        name: state.editingDepartment.name || '',
        code: state.editingDepartment.code || '',
        description: state.editingDepartment.description || '',
        monthly_budget: state.editingDepartment.monthly_budget?.toString() || '',
        manager_email: state.editingDepartment.manager_email || '',
        // location: state.editingDepartment.location || '',
        // cost_center: state.editingDepartment.cost_center || '',
      });
      setFormErrors({});
      setSubmitError(null);
    } else if (!state.showEditModal) {
      setForm({ name: '', code: '', description: '', monthly_budget: '', manager_email: '' });
      setFormErrors({});
      setSubmitError(null);
    }
  }, [state.showEditModal, state.editingDepartment]);

  // Reset form when create modal is opened or closed
  useEffect(() => {
    if (state.showCreateModal) {
      setForm({ name: '', code: '', description: '', monthly_budget: '', manager_email: '' });
      setFormErrors({});
      setSubmitError(null);
      // Optionally, focus the first input
      // setTimeout(() => { document.getElementById('create-dept-name')?.focus(); }, 100);
    }
  }, [state.showCreateModal]);

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================
  
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUtilizationColor = (utilization: number): string => {
    if (utilization >= 90) return 'text-red-600 bg-red-50';
    if (utilization >= 75) return 'text-yellow-600 bg-yellow-50';
    if (utilization >= 50) return 'text-blue-600 bg-blue-50';
    return 'text-green-600 bg-green-50';
  };

  const getUtilizationBarColor = (utilization: number): string => {
    if (utilization >= 90) return 'bg-red-500';
    if (utilization >= 75) return 'bg-yellow-500';
    if (utilization >= 50) return 'bg-blue-500';
    return 'bg-green-500';
  };

  // =============================================================================
  // DEPARTMENT DETAILS MODAL
  // =============================================================================

  const renderDepartmentDetailsModal = () => {
    if (!state.showDetailsModal || !state.viewingDepartment) return null;
    
    const dept = state.viewingDepartment as DepartmentWithStats;
    
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
                  onClick={onCloseModals}
                  className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-6">
              {/* Quick Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">Total Users</p>
                      <p className="text-2xl font-bold text-blue-900">{formatNumber(dept.user_count || 0)}</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-500" />
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">Monthly Budget</p>
                      <p className="text-2xl font-bold text-green-900">{formatCurrency(dept.monthly_budget)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-500" />
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600">Monthly Usage</p>
                      <p className="text-2xl font-bold text-purple-900">{formatCurrency(dept.monthly_usage || 0)}</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-purple-500" />
                  </div>
                </div>

                <div className={`p-4 rounded-xl border ${getUtilizationColor(dept.budget_utilization || 0)}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Budget Usage</p>
                      <p className="text-2xl font-bold">{Math.round((dept.budget_utilization || 0) * 100) / 100}%</p>
                    </div>
                    <TrendingUp className="h-8 w-8" />
                  </div>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Left Column - Basic Information */}
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
                        <span className="text-sm text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded">{dept.code}</span>
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
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
                      Budget Analysis
                    </h4>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Monthly Budget</span>
                        <span className="text-lg font-bold text-gray-900">{formatCurrency(dept.monthly_budget)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Current Usage</span>
                        <span className="text-lg font-semibold text-blue-600">{formatCurrency(dept.monthly_usage || 0)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Remaining Budget</span>
                        <span className="text-lg font-semibold text-green-600">
                          {formatCurrency(Math.max(0, dept.monthly_budget - (dept.monthly_usage || 0)))}
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mt-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Budget Utilization</span>
                          <span className={`font-semibold ${(dept.budget_utilization || 0) > 90 ? 'text-red-600' : (dept.budget_utilization || 0) > 75 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {Math.round((dept.budget_utilization || 0) * 100) / 100}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full transition-all duration-300 ${getUtilizationBarColor(dept.budget_utilization || 0)}`}
                            style={{ width: `${Math.min(100, dept.budget_utilization || 0)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Usage Statistics & Users */}
                <div className="space-y-6">
                  
                  {/* Usage Statistics Card */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <BarChart3 className="h-5 w-5 text-green-600 mr-2" />
                      Usage Statistics
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-lg border border-green-100">
                        <div className="text-2xl font-bold text-green-600">{formatNumber(dept.monthly_requests || 0)}</div>
                        <div className="text-sm text-gray-600">Monthly Requests</div>
                      </div>
                      
                      <div className="bg-white p-4 rounded-lg border border-green-100">
                        <div className="text-2xl font-bold text-green-600">{formatNumber(dept.monthly_tokens || 0)}</div>
                        <div className="text-sm text-gray-600">Monthly Tokens</div>
                      </div>
                      
                      <div className="bg-white p-4 rounded-lg border border-green-100">
                        <div className="text-2xl font-bold text-blue-600">{formatNumber(dept.active_users_today || 0)}</div>
                        <div className="text-sm text-gray-600">Active Today</div>
                      </div>
                      
                      <div className="bg-white p-4 rounded-lg border border-green-100">
                        <div className="text-2xl font-bold text-purple-600">{formatNumber(dept.admin_user_count || 0)}</div>
                        <div className="text-sm text-gray-600">Admin Users</div>
                      </div>
                    </div>
                  </div>

                  {/* User List Card */}
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
                      <div className="flex items-center">
                        <Users className="h-5 w-5 text-indigo-600 mr-2" />
                        Department Users
                      </div>
                      {loadingUsers && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                      )}
                    </h4>
                    
                    {userError ? (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center text-red-600 mb-2">
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          <span className="font-medium">Error Loading Users</span>
                        </div>
                        <p className="text-sm text-red-600">{userError}</p>
                      </div>
                    ) : loadingUsers ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="bg-white rounded-lg p-4 border border-indigo-100 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    ) : departmentUsers.length === 0 ? (
                      <div className="text-center py-6 bg-white rounded-lg border border-indigo-100">
                        <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">No users in this department</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {departmentUsers.map((user) => (
                          <div key={user.id} className="bg-white rounded-lg p-4 border border-indigo-100 hover:border-indigo-300 transition-colors">
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-medium text-gray-900">{user.full_name || user.username}</h5>
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
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200">
              <button
                onClick={onCloseModals}
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

  // =============================================================================
  // RENDER ALL MODALS
  // =============================================================================

  return (
    <>
      {/* Department Details Modal */}
      {renderDepartmentDetailsModal()}

      {/* Create Department Modal */}
      {state.showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Department</h3>
              <form className="space-y-4" onSubmit={handleCreateSubmit}>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Name<span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="name"
                    id="create-dept-name"
                    value={form.name}
                    onChange={handleInputChange}
                    className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${form.name && formErrors.name ? 'border-red-400 pr-10' : 'border-gray-300'}`}
                    required
                  />
                  {form.name && formErrors.name && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 group">
                      <AlertCircle className="h-5 w-5 text-red-500 cursor-pointer" tabIndex={0} />
                      <div className="absolute z-10 right-8 top-1/2 -translate-y-1/2 bg-white border border-red-200 text-red-700 text-xs rounded shadow-lg px-3 py-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-200 min-w-max">
                        {formErrors.name}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Code<span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="code"
                    value={form.code}
                    onChange={handleInputChange}
                    className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${form.code && formErrors.code ? 'border-red-400 pr-10' : 'border-gray-300'}`}
                    required
                  />
                  {form.code && formErrors.code && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 group">
                      <AlertCircle className="h-5 w-5 text-red-500 cursor-pointer" tabIndex={0} />
                      <div className="absolute z-10 right-8 top-1/2 -translate-y-1/2 bg-white border border-red-200 text-red-700 text-xs rounded shadow-lg px-3 py-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-200 min-w-max">
                        {formErrors.code}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Budget (USD)<span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    name="monthly_budget"
                    min="0"
                    step="0.01"
                    value={form.monthly_budget}
                    onChange={handleInputChange}
                    className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.monthly_budget ? 'border-red-400' : 'border-gray-300'}`}
                    required
                  />
                  {formErrors.monthly_budget && <p className="text-xs text-red-500 mt-1">{formErrors.monthly_budget}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manager Email</label>
                  <input
                    type="email"
                    name="manager_email"
                    value={form.manager_email}
                    onChange={handleInputChange}
                    className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.manager_email ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {formErrors.manager_email && <p className="text-xs text-red-500 mt-1">{formErrors.manager_email}</p>}
                </div>
                {submitError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600">{submitError}</div>
                )}
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={onCloseModals}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-60"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Department Modal */}
      {state.showEditModal && state.editingDepartment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Edit Department: {state.editingDepartment?.name}
              </h3>
              <form className="space-y-4" onSubmit={async (e) => {
                e.preventDefault();
                setSubmitError(null);
                const errors = validateForm();
                setFormErrors(errors);
                if (Object.keys(errors).length > 0 || !state.editingDepartment) return;
                setIsSubmitting(true);
                try {
                  await onUpdateDepartment(state.editingDepartment.id, {
                    name: form.name.trim(),
                    code: form.code.trim(),
                    description: form.description.trim() || undefined,
                    monthly_budget: Number(form.monthly_budget),
                    manager_email: form.manager_email.trim() || undefined,
                    // location: form.location.trim() || undefined,
                    // cost_center: form.cost_center.trim() || undefined,
                  });
                  setForm({ name: '', code: '', description: '', monthly_budget: '', manager_email: '' });
                  setFormErrors({});
                  onCloseModals();
                } catch (err: any) {
                  setSubmitError(err?.message || 'Failed to update department.');
                } finally {
                  setIsSubmitting(false);
                }
              }}>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Name<span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleInputChange}
                    className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.name ? 'border-red-400 pr-10' : 'border-gray-300'}`}
                    required
                  />
                  {form.name && formErrors.name && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 group">
                      <AlertCircle className="h-5 w-5 text-red-500 cursor-pointer" tabIndex={0} />
                      <div className="absolute z-10 right-8 top-1/2 -translate-y-1/2 bg-white border border-red-200 text-red-700 text-xs rounded shadow-lg px-3 py-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-200 min-w-max">
                        {formErrors.name}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Code<span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="code"
                    value={form.code}
                    onChange={handleInputChange}
                    className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.code ? 'border-red-400 pr-10' : 'border-gray-300'}`}
                    required
                  />
                  {form.code && formErrors.code && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 group">
                      <AlertCircle className="h-5 w-5 text-red-500 cursor-pointer" tabIndex={0} />
                      <div className="absolute z-10 right-8 top-1/2 -translate-y-1/2 bg-white border border-red-200 text-red-700 text-xs rounded shadow-lg px-3 py-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-200 min-w-max">
                        {formErrors.code}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Budget (USD)<span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    name="monthly_budget"
                    min="0"
                    step="0.01"
                    value={form.monthly_budget}
                    onChange={handleInputChange}
                    className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.monthly_budget ? 'border-red-400' : 'border-gray-300'}`}
                    required
                  />
                  {formErrors.monthly_budget && <p className="text-xs text-red-500 mt-1">{formErrors.monthly_budget}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manager Email</label>
                  <input
                    type="email"
                    name="manager_email"
                    value={form.manager_email}
                    onChange={handleInputChange}
                    className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.manager_email ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {formErrors.manager_email && <p className="text-xs text-red-500 mt-1">{formErrors.manager_email}</p>}
                </div>
                {submitError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600">{submitError}</div>
                )}
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={onCloseModals}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-60"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Department Modal */}
      {state.showDeleteModal && state.deletingDepartment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Delete Department: {state.deletingDepartment?.name}
              </h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete this department? This action cannot be undone.
              </p>
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600 mb-2">{submitError}</div>
              )}
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onCloseModals}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setSubmitError(null);
                    setIsSubmitting(true);
                    if (!state.deletingDepartment) return;
                    try {
                      await onDeleteDepartment(state.deletingDepartment.id);
                      onCloseModals();
                    } catch (err: any) {
                      setSubmitError(err?.message || 'Failed to delete department.');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-60"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {state.showBulkDeleteModal && state.selectedDepartments.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Bulk Delete ({state.selectedDepartments.length} departments)
              </h3>
              <p className="text-gray-600 mb-4">
                Modal implementation coming soon...
              </p>
              <button
                onClick={onCloseModals}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DepartmentModals;
