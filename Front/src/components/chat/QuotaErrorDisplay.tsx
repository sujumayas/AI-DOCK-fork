// 🚨 Quota Error Display Component
// Displays user-friendly quota exceeded messages with guidance

import React from 'react';
import { AlertTriangle, Clock, TrendingUp, MessageCircle, HelpCircle } from 'lucide-react';
import { StreamingError } from '../../types/chat';

interface QuotaErrorDisplayProps {
  error: StreamingError;
  onDismiss?: () => void;
  onContactAdmin?: () => void;
  className?: string;
}

export const QuotaErrorDisplay: React.FC<QuotaErrorDisplayProps> = ({
  error,
  onDismiss,
  onContactAdmin,
  className = ''
}) => {
  // 🔍 Parse quota error details from error message
  const parseQuotaError = (message: string) => {
    // Extract key information from quota error messages
    const departmentMatch = message.match(/Department\s+'([^']+)'/);
    const quotaMatch = message.match(/Quota\s+'([^']+)'/);
    const statusMatch = message.match(/status:\s+(\w+)/);
    
    return {
      department: departmentMatch?.[1] || 'Unknown',
      quotaName: quotaMatch?.[1] || 'Usage quota',
      status: statusMatch?.[1] || 'exceeded',
      fullMessage: message
    };
  };

  const quotaInfo = parseQuotaError(error.message);

  // 🎨 Get appropriate styling based on quota status
  const getStatusStyling = (status: string) => {
    switch (status.toLowerCase()) {
      case 'exceeded':
        return {
          bgColor: 'bg-red-500/20',
          borderColor: 'border-red-400/50',
          iconColor: 'text-red-300',
          textColor: 'text-red-100'
        };
      case 'warning':
        return {
          bgColor: 'bg-yellow-500/20',
          borderColor: 'border-yellow-400/50',
          iconColor: 'text-yellow-300',
          textColor: 'text-yellow-100'
        };
      default:
        return {
          bgColor: 'bg-orange-500/20',
          borderColor: 'border-orange-400/50',
          iconColor: 'text-orange-300',
          textColor: 'text-orange-100'
        };
    }
  };

  const styling = getStatusStyling(quotaInfo.status);

  return (
    <div className={`
      ${styling.bgColor} 
      backdrop-blur-sm 
      border 
      ${styling.borderColor} 
      rounded-lg 
      p-4 
      mx-4 
      my-3
      ${className}
    `}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-5 h-5 ${styling.iconColor} flex-shrink-0 mt-0.5`} />
        
        <div className="flex-1 min-w-0">
          {/* 📊 Main error heading */}
          <h3 className={`font-semibold ${styling.textColor} mb-2`}>
            🚫 Usage Quota Exceeded
          </h3>
          
          {/* 📋 Quota details */}
          <div className="space-y-3">
            {/* Department and quota info */}
            <div className={`text-sm ${styling.textColor} space-y-1`}>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span><strong>Department:</strong> {quotaInfo.department}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span><strong>Quota:</strong> {quotaInfo.quotaName}</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                <span><strong>Status:</strong> {quotaInfo.status.toUpperCase()}</span>
              </div>
            </div>
            
            {/* 💡 User guidance */}
            <div className={`text-sm ${styling.textColor} bg-white/5 rounded-md p-3 border border-white/10`}>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                What can you do?
              </h4>
              <ul className="space-y-1 text-xs">
                <li>• Wait for the quota to reset (usually monthly)</li>
                <li>• Contact your department administrator for quota increases</li>
                <li>• Try using a different AI model if available</li>
                <li>• Check if other team members have available quota</li>
              </ul>
            </div>
            
            {/* 🔧 Technical details (expandable) */}
            <details className="group">
              <summary className={`cursor-pointer text-xs ${styling.textColor} opacity-70 hover:opacity-100`}>
                Technical details ▼
              </summary>
              <div className="mt-2 text-xs font-mono bg-black/20 rounded p-2 break-all">
                {quotaInfo.fullMessage}
              </div>
            </details>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          {onContactAdmin && (
            <button
              onClick={onContactAdmin}
              className="px-3 py-1.5 text-xs bg-blue-500/30 hover:bg-blue-500/50 text-blue-100 rounded-md transition-colors"
            >
              Contact Admin
            </button>
          )}
          
          {onDismiss && (
            <button
              onClick={onDismiss}
              className={`px-3 py-1.5 text-xs ${styling.bgColor} hover:bg-white/10 ${styling.textColor} rounded-md transition-colors`}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// 🎯 Default export for easy importing
export default QuotaErrorDisplay;

// 🎓 Usage Example:
/*
<QuotaErrorDisplay
  error={streamingError}
  onDismiss={() => setError(null)}
  onContactAdmin={() => window.open('mailto:admin@company.com')}
/>
*/
