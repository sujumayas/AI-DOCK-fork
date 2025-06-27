// 📝 Department Form Modal Component
// Reusable modal for creating and editing departments

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { 
  DepartmentCreate, 
  DepartmentUpdate, 
  Department 
} from '../../../../../services/departmentService';
import { useDepartmentForm } from '../hooks/useDepartmentForm';

interface DepartmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DepartmentCreate | DepartmentUpdate) => Promise<void>;
  editingDepartment?: Department | null;
  title: string;
  submitButtonText: string;
}

export const DepartmentFormModal: React.FC<DepartmentFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingDepartment,
  title,
  submitButtonText
}) => {
  const {
    form,
    formErrors,
    submitError,
    isSubmitting,
    handleInputChange,
    handleSubmit,
    resetForm
  } = useDepartmentForm({
    editingDepartment,
    onSuccess: onClose
  });

  const handleFormSubmit = handleSubmit(async (formData) => {
    await onSubmit({
      name: formData.name.trim(),
      code: formData.code.trim(),
      description: formData.description.trim() || undefined,
      monthly_budget: Number(formData.monthly_budget),
      manager_email: formData.manager_email.trim() || undefined,
    });
  });

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
          
          <form className="space-y-4" onSubmit={handleFormSubmit}>
            {/* Department Name */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department Name<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleInputChange}
                className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  form.name && formErrors.name ? 'border-red-400 pr-10' : 'border-gray-300'
                }`}
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

            {/* Department Code */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department Code<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="code"
                value={form.code}
                onChange={handleInputChange}
                className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  form.code && formErrors.code ? 'border-red-400 pr-10' : 'border-gray-300'
                }`}
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

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>

            {/* Monthly Budget */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Budget (USD)<span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="monthly_budget"
                min="0"
                step="0.01"
                value={form.monthly_budget}
                onChange={handleInputChange}
                className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  formErrors.monthly_budget ? 'border-red-400' : 'border-gray-300'
                }`}
                required
              />
              {formErrors.monthly_budget && (
                <p className="text-xs text-red-500 mt-1">{formErrors.monthly_budget}</p>
              )}
            </div>

            {/* Manager Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manager Email</label>
              <input
                type="email"
                name="manager_email"
                value={form.manager_email}
                onChange={handleInputChange}
                className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  formErrors.manager_email ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {formErrors.manager_email && (
                <p className="text-xs text-red-500 mt-1">{formErrors.manager_email}</p>
              )}
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600">
                {submitError}
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
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
                {isSubmitting ? 'Saving...' : submitButtonText}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
