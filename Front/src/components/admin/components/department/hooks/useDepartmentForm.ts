// 🎯 Department Form Management Hook
// Custom hook for managing department form state and validation

import { useState, useEffect } from 'react';
import { Department } from '../../../../../services/departmentService';
import {
  DepartmentFormData,
  ValidationErrors,
  validateDepartmentForm,
  clearFieldError,
  hasValidationErrors
} from '../utils/departmentValidation';

interface UseDepartmentFormOptions {
  editingDepartment?: Department | null;
  onSuccess?: () => void;
}

interface UseDepartmentFormReturn {
  form: DepartmentFormData;
  formErrors: ValidationErrors;
  submitError: string | null;
  isSubmitting: boolean;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (onSubmit: (data: DepartmentFormData) => Promise<void>) => (e: React.FormEvent) => Promise<void>;
  resetForm: () => void;
  setSubmitError: (error: string | null) => void;
}

const initialFormData: DepartmentFormData = {
  name: '',
  code: '',
  description: '',
  monthly_budget: '',
  manager_email: '',
};

export const useDepartmentForm = ({ 
  editingDepartment, 
  onSuccess 
}: UseDepartmentFormOptions = {}): UseDepartmentFormReturn => {
  const [form, setForm] = useState<DepartmentFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => clearFieldError(prev, name));
  };

  // Handle form submission
  const handleSubmit = (onSubmit: (data: DepartmentFormData) => Promise<void>) => {
    return async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);
      
      const errors = validateDepartmentForm(form);
      setFormErrors(errors);
      
      if (hasValidationErrors(errors)) return;
      
      setIsSubmitting(true);
      try {
        await onSubmit(form);
        resetForm();
        onSuccess?.();
      } catch (err: any) {
        setSubmitError(err?.message || 'Failed to save department.');
      } finally {
        setIsSubmitting(false);
      }
    };
  };

  // Reset form to initial state
  const resetForm = () => {
    setForm(initialFormData);
    setFormErrors({});
    setSubmitError(null);
  };

  // Prefill form when editing department changes
  useEffect(() => {
    if (editingDepartment) {
      setForm({
        name: editingDepartment.name || '',
        code: editingDepartment.code || '',
        description: editingDepartment.description || '',
        monthly_budget: editingDepartment.monthly_budget?.toString() || '',
        manager_email: editingDepartment.manager_email || '',
      });
      setFormErrors({});
      setSubmitError(null);
    } else {
      resetForm();
    }
  }, [editingDepartment]);

  return {
    form,
    formErrors,
    submitError,
    isSubmitting,
    handleInputChange,
    handleSubmit,
    resetForm,
    setSubmitError,
  };
};
