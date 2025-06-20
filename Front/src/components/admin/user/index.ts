/**
 * 📁 User Management Components - Clean Exports
 * 
 * This index file provides clean, organized exports for all user management
 * components, making imports cleaner and more maintainable.
 * 
 * Learning Goals:
 * - Clean export patterns for component libraries
 * - Organized component structure
 * - Better developer experience with centralized imports
 */

// =============================================================================
// COMPONENT EXPORTS
// =============================================================================

/**
 * User Search Component
 * Handles search input with debouncing and clean callback interface
 */
export { UserSearch, type UserSearchProps } from './UserSearch';

// =============================================================================
// FUTURE COMPONENT EXPORTS
// =============================================================================

/**
 * Components that will be extracted in subsequent tasks:
 * 
 * export { UserFilters, type UserFiltersProps } from './UserFilters';
 * export { UserTable, type UserTableProps } from './UserTable';
 * export { UserActions, type UserActionsProps } from './UserActions';
 */

// =============================================================================
// CONVENIENCE RE-EXPORTS
// =============================================================================

/**
 * Re-export everything for convenience
 * Learning: Allows both named and default imports from the same location
 */
export * from './UserSearch';
