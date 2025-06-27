// 🎨 Department Formatting Utilities
// Pure functions for formatting department data

/**
 * Format number as currency (USD)
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format number with thousands separators
 */
export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
};

/**
 * Format date string to readable format
 */
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Get text and background color classes for utilization percentage
 */
export const getUtilizationColor = (utilization: number): string => {
  if (utilization >= 90) return 'text-red-600 bg-red-50';
  if (utilization >= 75) return 'text-yellow-600 bg-yellow-50';
  if (utilization >= 50) return 'text-blue-600 bg-blue-50';
  return 'text-green-600 bg-green-50';
};

/**
 * Get progress bar color for utilization percentage
 */
export const getUtilizationBarColor = (utilization: number): string => {
  if (utilization >= 90) return 'bg-red-500';
  if (utilization >= 75) return 'bg-yellow-500';
  if (utilization >= 50) return 'bg-blue-500';
  return 'bg-green-500';
};
