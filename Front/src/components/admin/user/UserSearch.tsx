/**
 * 🔍 User Search Component
 * 
 * Extracted from UserManagement.tsx to improve maintainability and reusability.
 * This component encapsulates all search-related functionality including:
 * - Search input with icon
 * - Debounced search to prevent excessive API calls
 * - Clean callback interface for parent components
 * 
 * Learning Goals:
 * - Component extraction and refactoring patterns
 * - Debouncing for performance optimization
 * - Clean component interfaces with TypeScript
 * - Performance optimizations with React hooks
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

/**
 * Props interface for UserSearch component
 * 
 * Learning: Well-defined props make components reusable and maintainable
 */
export interface UserSearchProps {
  /** Callback function called when search query changes (debounced) */
  onSearch: (query: string) => void;
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Additional CSS classes for styling */
  className?: string;
  /** Initial search value */
  initialValue?: string;
  /** Debounce delay in milliseconds (default: 300) */
  debounceDelay?: number;
  /** Whether the search input is disabled */
  disabled?: boolean;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Generic debounce function type
 * Learning: TypeScript generics make utility functions type-safe
 */
type DebounceFunction = <T extends (...args: any[]) => any>(
  func: T, 
  wait: number
) => (...args: Parameters<T>) => void;

// =============================================================================
// USER SEARCH COMPONENT
// =============================================================================

/**
 * UserSearch Component
 * 
 * A reusable search input component with built-in debouncing and clean styling.
 * Follows the container-component pattern by managing its own internal state
 * while communicating with parent through callbacks.
 * 
 * Performance Features:
 * - Debounced search to prevent excessive API calls
 * - Memoized debounce function to prevent recreation
 * - useCallback for event handlers to prevent unnecessary re-renders
 * 
 * @param props - UserSearchProps interface
 * @returns JSX.Element
 */
export const UserSearch: React.FC<UserSearchProps> = ({
  onSearch,
  placeholder = "Search users by name, email, or username...",
  className = "",
  initialValue = "",
  debounceDelay = 300,
  disabled = false
}) => {
  
  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================
  
  /**
   * Internal search query state
   * Learning: Component manages its own input state for immediate UI feedback
   */
  const [searchQuery, setSearchQuery] = useState<string>(initialValue);
  
  /**
   * Ref to track if component is mounted
   * Learning: Prevents state updates on unmounted components
   */
  const mountedRef = useRef<boolean>(true);
  
  // =============================================================================
  // PERFORMANCE OPTIMIZATIONS
  // =============================================================================
  
  /**
   * Memoized debounce function
   * Learning: useMemo prevents recreation of the debounce utility on every render
   */
  const debounce: DebounceFunction = useMemo(() => {
    return <T extends (...args: any[]) => any>(func: T, wait: number) => {
      let timeout: ReturnType<typeof setTimeout>;
      
      return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          if (mountedRef.current) {
            func(...args);
          }
        }, wait);
      };
    };
  }, []); // Empty dependency array - debounce function never changes
  
  /**
   * Memoized debounced search function
   * Learning: Combines debouncing with memoization for optimal performance
   */
  const debouncedSearch = useMemo(() => {
    return debounce((query: string) => {
      if (mountedRef.current) {
        onSearch(query);
      }
    }, debounceDelay);
  }, [debounce, onSearch, debounceDelay]);
  
  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================
  
  /**
   * Handle search input changes
   * Learning: useCallback prevents function recreation and optimizes child re-renders
   */
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = event.target.value;
    
    // Update internal state immediately for responsive UI
    setSearchQuery(newQuery);
    
    // Trigger debounced search callback
    debouncedSearch(newQuery);
  }, [debouncedSearch]);
  
  /**
   * Handle search input clear
   * Learning: Provides user-friendly way to clear search
   */
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    onSearch("");
  }, [onSearch]);
  
  // =============================================================================
  // LIFECYCLE MANAGEMENT
  // =============================================================================
  
  /**
   * Cleanup effect to prevent memory leaks
   * Learning: Proper cleanup prevents state updates on unmounted components
   */
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  /**
   * Handle initial value changes from parent
   * Learning: Sync internal state when parent provides new initial value
   */
  useEffect(() => {
    if (initialValue !== searchQuery) {
      setSearchQuery(initialValue);
    }
  }, [initialValue]); // Only depend on initialValue, not searchQuery to avoid loops
  
  // =============================================================================
  // RENDER
  // =============================================================================
  
  return (
    <div className={`relative max-w-md ${className}`}>
      {/* Search Icon */}
      <Search 
        className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" 
        aria-hidden="true"
      />
      
      {/* Search Input */}
      <input
        id="user-search-input"
        name="user-search"
        type="text"
        placeholder={placeholder}
        value={searchQuery}
        onChange={handleSearchChange}
        disabled={disabled}
        className={`
          w-full pl-10 pr-10 py-2 
          border border-gray-300 rounded-md 
          focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-100 disabled:cursor-not-allowed
          transition-colors duration-200
        `}
        aria-label="Search users"
        aria-describedby="search-description"
      />
      
      {/* Clear Button (shows when there's text) */}
      {searchQuery && !disabled && (
        <button
          type="button"
          onClick={handleClearSearch}
          className="
            absolute right-3 top-1/2 transform -translate-y-1/2
            h-4 w-4 text-gray-400 hover:text-gray-600
            transition-colors duration-200
          "
          aria-label="Clear search"
          title="Clear search"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
      
      {/* Screen reader description */}
      <div id="search-description" className="sr-only">
        Search for users by name, email, or username. Results update automatically as you type.
      </div>
    </div>
  );
};

// =============================================================================
// COMPONENT DISPLAY NAME
// =============================================================================

UserSearch.displayName = 'UserSearch';

// =============================================================================
// EXPORTS
// =============================================================================

export default UserSearch;

/**
 * Additional exports for testing and development
 * Learning: Named exports make components easier to test and develop
 */
export type { UserSearchProps };
