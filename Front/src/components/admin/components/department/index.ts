// 📁 Department Components Index
// Clean exports for all department-related components

// Modal Components
export { DepartmentDetailsModal } from './modals/DepartmentDetailsModal';
export { DepartmentFormModal } from './modals/DepartmentFormModal';
export { DeleteConfirmationModal } from './modals/DeleteConfirmationModal';
export { BulkDeleteModal } from './modals/BulkDeleteModal';

// Display Components
export { DepartmentStatsGrid } from './components/DepartmentStatsGrid';
export { BudgetAnalysisCard } from './components/BudgetAnalysisCard';
export { UsageStatisticsCard } from './components/UsageStatisticsCard';
export { DepartmentUsersList } from './components/DepartmentUsersList';

// Custom Hooks
export { useDepartmentForm } from './hooks/useDepartmentForm';
export { useDepartmentUsers } from './hooks/useDepartmentUsers';

// Utilities
export * from './utils/departmentFormatters';
export * from './utils/departmentValidation';
