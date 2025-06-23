// 🤖 Assistant Change Divider Component
// Shows a visual divider when the assistant changes during a conversation
// Provides clear context about which assistant is now responding

import React from 'react';
import { Bot, ArrowRight } from 'lucide-react';

interface AssistantDividerProps {
  previousAssistantName?: string;
  newAssistantName: string;
  className?: string;
}

/**
 * Visual divider component that appears when assistants change mid-conversation
 * 
 * 🎓 LEARNING: Component Composition
 * =================================
 * This component demonstrates:
 * - Clean prop interfaces with optional parameters
 * - Conditional rendering based on available data
 * - Professional visual hierarchy with glassmorphism styling
 * - Accessible design with proper contrast and icons
 * - Responsive design for mobile and desktop
 */
export const AssistantDivider: React.FC<AssistantDividerProps> = ({
  previousAssistantName,
  newAssistantName,
  className = ''
}) => {
  return (
    <div className={`flex items-center justify-center my-6 ${className}`}>
      <div className="flex items-center space-x-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-2.5 shadow-lg">
        {/* Previous assistant indicator (if switching from one assistant to another) */}
        {previousAssistantName && (
          <>
            <div className="flex items-center space-x-2 text-white/80">
              <Bot className="w-4 h-4" />
              <span className="text-sm font-medium">{previousAssistantName}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-white/60" />
          </>
        )}
        
        {/* New assistant indicator */}
        <div className="flex items-center space-x-2 text-white">
          <Bot className="w-4 h-4 text-blue-200" />
          <span className="text-sm font-semibold">{newAssistantName}</span>
          <span className="text-xs bg-blue-500/30 text-blue-100 px-2 py-1 rounded-full">
            {previousAssistantName ? 'Switched' : 'Assistant'}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * 🎨 Component Features:
 * =====================
 * 
 * 1. **Visual Hierarchy**: Clear before/after assistant indication
 * 2. **Glassmorphism Design**: Matches the chat interface aesthetic  
 * 3. **Conditional Display**: Shows different content based on context
 * 4. **Mobile Responsive**: Works well on all screen sizes
 * 5. **Accessibility**: Proper contrast and semantic markup
 * 
 * Usage Examples:
 * ===============
 * 
 * ```tsx
 * // When switching from one assistant to another
 * <AssistantDivider 
 *   previousAssistantName="Customer Support Bot"
 *   newAssistantName="Technical Expert"
 * />
 * 
 * // When starting with an assistant (no previous)
 * <AssistantDivider 
 *   newAssistantName="Creative Writing Assistant"
 * />
 * ```
 */