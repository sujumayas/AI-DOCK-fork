// 🎯 Quota Pagination Component
// Pagination controls with page navigation and page size selector

import React from 'react';

// =============================================================================
// INTERFACES
// =============================================================================

interface PaginationData {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

interface QuotaPaginationProps {
  pagination: PaginationData;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Quota Pagination Component
 * 
 * Provides pagination controls with smart page number display,
 * navigation buttons, and page size selector.
 * Learning: This demonstrates creating reusable pagination logic
 * that can be used across different data tables.
 */
export const QuotaPagination: React.FC<QuotaPaginationProps> = ({
  pagination,
  onPageChange,
  onPageSizeChange,
  className = ''
}) => {
  const { page, totalPages, totalCount, pageSize, hasNext, hasPrevious } = pagination;

  // Don't render if there's only one page or no data
  if (totalPages <= 1) return null;

  // =============================================================================
  // HELPERS
  // =============================================================================

  /**
   * Calculate items shown info
   */
  const getItemsInfo = () => {
    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalCount);
    return { startItem, endItem };
  };

  /**
   * Generate page numbers to show
   * Smart algorithm that shows relevant pages with ellipsis
   */
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const delta = 2; // Pages to show on each side of current page
    const pages: (number | 'ellipsis')[] = [];
    
    // Always show first page
    pages.push(1);
    
    // Calculate range around current page
    const rangeStart = Math.max(2, page - delta);
    const rangeEnd = Math.min(totalPages - 1, page + delta);
    
    // Add ellipsis after first page if needed
    if (rangeStart > 2) {
      pages.push('ellipsis');
    }
    
    // Add pages around current page
    for (let i = rangeStart; i <= rangeEnd; i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }
    
    // Add ellipsis before last page if needed
    if (rangeEnd < totalPages - 1) {
      pages.push('ellipsis');
    }
    
    // Always show last page (if not already included)
    if (totalPages > 1 && !pages.includes(totalPages)) {
      pages.push(totalPages);
    }
    
    return pages;
  };

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render items info
   */
  const renderItemsInfo = () => {
    const { startItem, endItem } = getItemsInfo();
    
    return (
      <div className="text-sm text-gray-700">
        Showing <span className="font-medium">{startItem}</span> to{' '}
        <span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{totalCount}</span> quota(s)
      </div>
    );
  };

  /**
   * Render page navigation buttons
   */
  const renderPageNavigation = () => {
    const pageNumbers = getPageNumbers();
    
    return (
      <div className="flex items-center space-x-2">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrevious}
          className={`px-3 py-2 text-sm rounded-md transition-colors ${
            hasPrevious
              ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              : 'text-gray-300 cursor-not-allowed'
          }`}
          aria-label="Previous page"
        >
          Previous
        </button>
        
        {/* Page numbers */}
        <div className="flex space-x-1">
          {pageNumbers.map((pageNum, index) => {
            if (pageNum === 'ellipsis') {
              return (
                <span 
                  key={`ellipsis-${index}`} 
                  className="px-3 py-2 text-sm text-gray-500"
                  aria-hidden="true"
                >
                  ...
                </span>
              );
            }
            
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  pageNum === page
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                aria-label={`Page ${pageNum}`}
                aria-current={pageNum === page ? 'page' : undefined}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        
        {/* Next button */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className={`px-3 py-2 text-sm rounded-md transition-colors ${
            hasNext
              ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              : 'text-gray-300 cursor-not-allowed'
          }`}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    );
  };

  /**
   * Render page size selector
   */
  const renderPageSizeSelector = () => (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-700">Show:</span>
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Items per page"
      >
        <option value={10}>10</option>
        <option value={20}>20</option>
        <option value={50}>50</option>
        <option value={100}>100</option>
      </select>
      <span className="text-sm text-gray-700">per page</span>
    </div>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className={`quota-pagination px-6 py-4 border-t border-gray-200 ${className}`}>
      <div className="flex items-center justify-between">
        {/* Items info */}
        {renderItemsInfo()}
        
        {/* Page navigation controls */}
        {renderPageNavigation()}
        
        {/* Page size selector */}
        {renderPageSizeSelector()}
      </div>
    </div>
  );
};

export default QuotaPagination;