// 🔍 Department Form Validation Utilities
// Pure validation functions for department forms

export interface DepartmentFormData {
  name: string;
  code: string;
  description: string;
  monthly_budget: string;
  manager_email: string;
}

export interface ValidationErrors {
  [key: string]: string;
}

/**
 * Validate email format
 */
const isValidEmail = (email: string): boolean => {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
};

/**
 * Validate complete department form
 */
export const validateDepartmentForm = (form: DepartmentFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Name validation
  if (!form.name.trim()) {
    errors.name = 'Department name is required.';
  } else if (form.name.trim().length < 2) {
    errors.name = 'Department name must be at least 2 characters.';
  }

  // Code validation
  if (!form.code.trim()) {
    errors.code = 'Department code is required.';
  } else if (form.code.trim().length < 2) {
    errors.code = 'Department code must be at least 2 characters.';
  }

  // Budget validation
  if (!form.monthly_budget || isNaN(Number(form.monthly_budget)) || Number(form.monthly_budget) < 0) {
    errors.monthly_budget = 'Monthly budget must be a positive number.';
  }

  // Email validation (optional field)
  if (form.manager_email && !isValidEmail(form.manager_email)) {
    errors.manager_email = 'Invalid email address.';
  }

  return errors;
};

/**
 * Check if form has any validation errors
 */
export const hasValidationErrors = (errors: ValidationErrors): boolean => {
  return Object.keys(errors).length > 0;
};

/**
 * Clear specific field error
 */
export const clearFieldError = (errors: ValidationErrors, fieldName: string): ValidationErrors => {
  const newErrors = { ...errors };
  delete newErrors[fieldName];
  return newErrors;
};
