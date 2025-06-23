// 🤖 Assistant Badge Component
// Shows which assistant generated an AI response
// Displays as a small badge on AI message bubbles

import React from 'react';
import { Bot, Sparkles } from 'lucide-react';

interface AssistantBadgeProps {
  assistantName: string;
  isIntroduction?: boolean;
  className?: string;
}

/**
 * Badge component that shows which assistant generated a message
 * 
 * 🎓 LEARNING: Component Design Patterns
 * ======================================
 * This component demonstrates:
 * - Small, focused component with single responsibility
 * - Conditional styling based on message type
 * - Semantic props that convey meaning
 * - Professional badge design with proper typography
 * - Icon usage for visual hierarchy
 */
export const AssistantBadge: React.FC<AssistantBadgeProps> = ({
  assistantName,
  isIntroduction = false,
  className = ''
}) => {
  return (
    <div className={`inline-flex items-center space-x-1.5 ${className}`}>
      {/* Icon varies based on message type */}
      {isIntroduction ? (
        <Sparkles className="w-3 h-3 text-blue-400" />
      ) : (
        <Bot className="w-3 h-3 text-blue-500" />
      )}
      
      {/* Assistant name with conditional styling */}
      <span className={`text-xs font-medium ${
        isIntroduction 
          ? 'text-blue-600 font-semibold' 
          : 'text-gray-600'
      }`}>
        {assistantName}
        {isIntroduction && (
          <span className="ml-1 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs">
            Introduction
          </span>
        )}
      </span>
    </div>
  );
};

/**
 * 🎨 Component Features:
 * =====================
 * 
 * 1. **Visual Differentiation**: Different icons for introductions vs regular messages
 * 2. **Professional Typography**: Consistent with chat interface design
 * 3. **Conditional Styling**: Introduction messages get special visual treatment
 * 4. **Compact Design**: Small footprint that doesn't overwhelm the message
 * 5. **Semantic Markup**: Clear meaning through props and styling
 * 
 * Usage Examples:
 * ===============
 * 
 * ```tsx
 * // Regular AI response badge
 * <AssistantBadge assistantName="Customer Support Bot" />
 * 
 * // Introduction message badge
 * <AssistantBadge 
 *   assistantName="Creative Writing Assistant" 
 *   isIntroduction={true} 
 * />
 * ```
 */