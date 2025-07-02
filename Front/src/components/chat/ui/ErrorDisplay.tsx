// 🚨 Comprehensive Error Display Component
// Handles all error states with proper styling and actions
// Extracted from ChatInterface.tsx for better modularity

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { QuotaErrorDisplay } from '../QuotaErrorDisplay';

export interface ErrorDisplayProps {
  // Standard error
  error: string | null;
  onDismissError: () => void;
  
  // Streaming error
  streamingHasError: boolean;
  streamingError: any;
  onDismissStreamingError?: () => void;
  
  // Quota error actions
  onContactAdmin?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onDismissError,
  streamingHasError,
  streamingError,
  onDismissStreamingError,
  onContactAdmin
}) => {
  return (
    <>
      {/* 🚨 Standard Error Display */}
      {error && (
        <div className="bg-red-500/20 backdrop-blur-sm border-l-4 border-red-300 p-3 md:p-4 mx-3 md:mx-4 mt-4 rounded-lg">
          <div className="flex items-start md:items-center gap-2">
            <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-red-200 flex-shrink-0 mt-0.5 md:mt-0" />
            <p className="text-red-100 text-xs md:text-sm flex-1 leading-relaxed">{error}</p>
            <button 
              onClick={onDismissError}
              className="text-red-200 hover:text-red-100 text-lg md:text-xl font-bold flex-shrink-0 touch-manipulation p-1"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      {/* 🚨 Streaming Error Display with Quota and Configuration Support */}
      {streamingHasError && streamingError && (
        <div className="mt-4">
          {streamingError.type === 'QUOTA_EXCEEDED' ? (
            <QuotaErrorDisplay
              error={streamingError}
              onContactAdmin={() => {
                if (onContactAdmin) {
                  onContactAdmin();
                } else {
                  // Default admin contact
                  window.open('mailto:admin@company.com?subject=AI%20Usage%20Quota%20Exceeded', '_blank');
                }
              }}
            />
          ) : streamingError.type === 'CONFIGURATION_ERROR' ? (
            // Configuration error display with specific styling and actions
            <div className="bg-yellow-500/20 backdrop-blur-sm border-l-4 border-yellow-300 p-3 md:p-4 mx-3 md:mx-4 rounded-lg">
              <div className="flex items-start md:items-center gap-2">
                <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-yellow-200 flex-shrink-0 mt-0.5 md:mt-0" />
                <div className="flex-1">
                  <p className="text-yellow-100 text-xs md:text-sm font-medium mb-1">
                    Configuration Error
                  </p>
                  <p className="text-yellow-200 text-xs leading-relaxed mb-2">
                    {streamingError.message}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => window.location.href = '/admin-settings?tab=llm-configs'}
                      className="px-3 py-1 bg-yellow-600/40 hover:bg-yellow-600/60 text-yellow-100 text-xs rounded border border-yellow-400/30 transition-colors"
                    >
                      🔧 Check LLM Configuration
                    </button>
                    {onContactAdmin && (
                      <button
                        onClick={() => onContactAdmin()}
                        className="px-3 py-1 bg-yellow-600/40 hover:bg-yellow-600/60 text-yellow-100 text-xs rounded border border-yellow-400/30 transition-colors"
                      >
                        📧 Contact Admin
                      </button>
                    )}
                  </div>
                </div>
                {onDismissStreamingError && (
                  <button 
                    onClick={onDismissStreamingError}
                    className="text-yellow-200 hover:text-yellow-100 text-lg md:text-xl font-bold flex-shrink-0 touch-manipulation p-1"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ) : (
            // Generic streaming error display
            <div className="bg-orange-500/20 backdrop-blur-sm border-l-4 border-orange-300 p-3 md:p-4 mx-3 md:mx-4 rounded-lg">
              <div className="flex items-start md:items-center gap-2">
                <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-orange-200 flex-shrink-0 mt-0.5 md:mt-0" />
                <div className="flex-1">
                  <p className="text-orange-100 text-xs md:text-sm font-medium mb-1">
                    Streaming Error: {streamingError.type}
                  </p>
                  <p className="text-orange-200 text-xs leading-relaxed">
                    {streamingError.message}
                  </p>
                  {streamingError.shouldFallback && (
                    <p className="text-orange-300 text-xs mt-1">
                      ℹ️ Automatically falling back to regular chat...
                    </p>
                  )}
                </div>
                {onDismissStreamingError && (
                  <button 
                    onClick={onDismissStreamingError}
                    className="text-orange-200 hover:text-orange-100 text-lg md:text-xl font-bold flex-shrink-0 touch-manipulation p-1"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};