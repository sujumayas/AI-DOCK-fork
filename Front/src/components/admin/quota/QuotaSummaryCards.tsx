// 🎯 Quota Summary Cards Component
// Displays quota statistics overview cards

import React from 'react';

// =============================================================================
// INTERFACES
// =============================================================================

interface QuotaSummary {
  totalQuotas: number;
  activeQuotas: number;
  exceededQuotas: number;
  nearLimitQuotas: number;
}

interface QuotaSummaryCardsProps {
  summary: QuotaSummary;
  loading?: boolean;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Quota Summary Cards Component
 * 
 * Displays overview statistics in glassmorphism-themed cards.
 * Learning: This demonstrates the single responsibility principle - 
 * one component focused only on displaying summary data.
 */
export const QuotaSummaryCards: React.FC<QuotaSummaryCardsProps> = ({
  summary,
  loading = false,
  className = ''
}) => {
  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render a single summary card
   */
  const renderCard = (
    value: number,
    label: string,
    colorClass: string,
    icon?: string
  ) => (
    <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-2xl border border-white/20">
      <div className="flex items-center justify-between">
        <div>
          <div className={`text-2xl font-bold ${colorClass}`}>
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
            ) : (
              value.toLocaleString()
            )}
          </div>
          <div className="text-sm text-gray-700 mt-1">{label}</div>
        </div>
        {icon && (
          <div className="text-2xl opacity-60">
            {icon}
          </div>
        )}
      </div>
    </div>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className={`quota-summary-cards ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {renderCard(
          summary.totalQuotas,
          'Total Quotas',
          'text-gray-900',
          '📊'
        )}
        
        {renderCard(
          summary.activeQuotas,
          'Active Quotas',
          'text-green-600',
          '✅'
        )}
        
        {renderCard(
          summary.nearLimitQuotas,
          'Near Limit',
          'text-yellow-600',
          '⚠️'
        )}
        
        {renderCard(
          summary.exceededQuotas,
          'Exceeded',
          'text-red-600',
          '🚨'
        )}
      </div>
    </div>
  );
};

export default QuotaSummaryCards;