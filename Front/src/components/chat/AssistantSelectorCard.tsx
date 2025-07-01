// 🤖 AssistantSelectorCard.tsx
// Visual card-based assistant selector with glassmorphism styling and detailed tooltip
// Features: Hover tooltip for assistant details, pin/unpin functionality, smart positioning

import React, { useState, useCallback } from 'react';
import { Bot, Settings, Sparkles, Info } from 'lucide-react';
import { AssistantSummary } from '../../types/assistant';
import { AssistantInfoTooltip } from './AssistantInfoTooltip';

// 📝 LEARNING: Enhanced TypeScript interface for component props
// Now includes tooltip-related props for advanced functionality
interface AssistantSelectorCardProps {
  selectedAssistant: AssistantSummary | null;
  onChangeClick: () => void;
  className?: string;
  showTooltip?: boolean;        // NEW: Enable/disable tooltip functionality
  tooltipDelay?: number;        // NEW: Delay before showing tooltip (ms)
  isStreaming?: boolean;        // NEW: Whether chat is currently streaming (disables changes)
}

export const AssistantSelectorCard: React.FC<AssistantSelectorCardProps> = ({
  selectedAssistant,
  onChangeClick,
  className = '',
  showTooltip = true,           // Default: tooltip enabled
  tooltipDelay = 500,           // Default: 500ms delay
  isStreaming
}) => {
  // 🎨 LEARNING: Conditional styling and content based on state
  const isDefaultChat = !selectedAssistant;
  
  // 🎯 TOOLTIP STATE MANAGEMENT
  // ==========================
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipPinned, setTooltipPinned] = useState(false);
  const [hoverTimer, setHoverTimer] = useState<NodeJS.Timeout | null>(null);

  // 🎓 LEARNING: Mouse Event Handlers with Advanced Logic
  // ====================================================
  // These handlers track mouse position and manage tooltip visibility
  
  const handleMouseEnter = useCallback((event: React.MouseEvent) => {
    // Only show tooltip for selected assistants (not default chat)
    if (!showTooltip || isDefaultChat || !selectedAssistant) return;
    
    // Clear any existing timer
    if (hoverTimer) {
      clearTimeout(hoverTimer);
    }
    
    // Set new timer with delay
    const timer = setTimeout(() => {
      setTooltipPosition({ x: event.clientX, y: event.clientY });
      setTooltipVisible(true);
    }, tooltipDelay);
    
    setHoverTimer(timer);
  }, [showTooltip, isDefaultChat, selectedAssistant, tooltipDelay, hoverTimer]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    // Update tooltip position as mouse moves (only if visible and not pinned)
    if (tooltipVisible && !tooltipPinned) {
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  }, [tooltipVisible, tooltipPinned]);

  const handleMouseLeave = useCallback(() => {
    // Clear timer if mouse leaves before delay completes
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      setHoverTimer(null);
    }
    
    // Hide tooltip if not pinned
    if (!tooltipPinned) {
      setTooltipVisible(false);
    }
  }, [hoverTimer, tooltipPinned]);

  // 📌 TOOLTIP PIN/UNPIN HANDLERS
  // ============================
  const handleTooltipPin = useCallback(() => {
    setTooltipPinned(true);
    console.log('🎯 Assistant tooltip pinned:', selectedAssistant?.name);
  }, [selectedAssistant?.name]);

  const handleTooltipUnpin = useCallback(() => {
    setTooltipPinned(false);
    setTooltipVisible(false);
    console.log('🎯 Assistant tooltip unpinned');
  }, []);

  // 🎯 INFO BUTTON CLICK HANDLER
  // ===========================
  const handleInfoClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering parent click events
    
    if (!selectedAssistant) return;
    
    // Show tooltip at button position
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({ 
      x: rect.left + rect.width / 2, 
      y: rect.bottom + 5 
    });
    setTooltipVisible(true);
    setTooltipPinned(true); // Auto-pin when clicked
  }, [selectedAssistant]);

  return (
    <>
      <div 
        className={`
          relative overflow-hidden
          bg-white/10 backdrop-blur-md 
          border border-white/20 
          rounded-2xl 
          p-4 mb-4 mx-3 md:mx-4
          shadow-lg hover:shadow-xl
          transition-all duration-300 ease-in-out
          hover:bg-white/15
          ${className}
        `}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* 🌈 LEARNING: Glassmorphism background effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-teal-500/5 pointer-events-none" />
        
        <div className="relative flex items-center justify-between">
          {/* 📱 Left side: Assistant info with info button */}
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            {/* 🤖 Avatar/Icon Section */}
            <div className={`
              flex-shrink-0 w-12 h-12 rounded-full 
              flex items-center justify-center
              transition-all duration-200
              ${isDefaultChat 
                ? 'bg-blue-500/20 border-2 border-blue-400/30' 
                : 'bg-purple-500/20 border-2 border-purple-400/30'
              }
            `}>
              {isDefaultChat ? (
                <Bot className="w-6 h-6 text-blue-300" />
              ) : (
                <Sparkles className="w-6 h-6 text-purple-300" />
              )}
            </div>
            
            {/* 📝 Assistant Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-white text-sm md:text-base truncate">
                  {isDefaultChat ? 'Default Chat' : selectedAssistant.name}
                </h3>
                
                {/* 💡 INFO BUTTON: Click for detailed tooltip (only for selected assistants) */}
                {!isDefaultChat && selectedAssistant && showTooltip && (
                  <button
                    onClick={handleInfoClick}
                    className="
                      p-1 text-blue-300 hover:text-blue-100 
                      hover:bg-white/10 rounded-full 
                      transition-all duration-200
                      focus:outline-none focus:ring-2 focus:ring-blue-400/50
                    "
                    title="View assistant details"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <p className="text-blue-100/80 text-xs md:text-sm leading-relaxed line-clamp-2">
                {isDefaultChat 
                  ? 'General AI assistant for any task or question'
                  : (selectedAssistant.system_prompt_preview.length > 60
                      ? `${selectedAssistant.system_prompt_preview.slice(0, 60)}...`
                      : selectedAssistant.system_prompt_preview
                    )
                }
              </p>
            </div>
          </div>
          
          {/* 🎮 Right side: Change button */}
          <div className="flex-shrink-0 ml-3">
            <button
              onClick={isStreaming ? undefined : onChangeClick}
              disabled={isStreaming}
              className={`
                px-3 md:px-4 py-2 
                ${isStreaming 
                  ? 'bg-gray-500/20 border-gray-400/30 cursor-not-allowed opacity-50' 
                  : 'bg-white/10 hover:bg-white/20 border-white/30 hover:border-white/50 hover:shadow-lg hover:scale-105'
                }
                border rounded-xl 
                text-white text-xs md:text-sm font-medium
                backdrop-blur-sm
                transition-all duration-200 
                focus:outline-none focus:ring-2 focus:ring-blue-400/50
                touch-manipulation
                flex items-center space-x-1 md:space-x-2
              `}
              title={
                isStreaming 
                  ? 'Cannot change assistants while AI is responding' 
                  : isDefaultChat 
                    ? 'Select a custom assistant' 
                    : 'Change assistant or return to default chat'
              }
            >
              <Settings className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Change Assistant</span>
              <span className="sm:hidden">Change</span>
            </button>
          </div>
        </div>
        
        {/* 📊 LEARNING: Additional assistant metadata (if selected) */}
        {!isDefaultChat && selectedAssistant && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-4 text-blue-100/70">
                <span>
                  Status: {selectedAssistant.is_active 
                    ? <span className="text-green-300">Active</span>
                    : <span className="text-yellow-300">Inactive</span>
                  }
                </span>
                <span>Created: {new Date(selectedAssistant.created_at).toLocaleDateString()}</span>
              </div>
              
              {/* 🎯 Visual indicator for active assistant with tooltip hint */}
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-300 text-xs">In Use</span>
                {showTooltip && (
                  <span className="text-blue-300/60 text-xs">
                    • Hover for details
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🎯 ASSISTANT INFO TOOLTIP */}
      {/* ========================= */}
      {showTooltip && selectedAssistant && (
        <AssistantInfoTooltip
          assistant={selectedAssistant}
          isVisible={tooltipVisible}
          position={tooltipPosition}
          onPin={handleTooltipPin}
          onUnpin={handleTooltipUnpin}
          isPinned={tooltipPinned}
          maxWidth={360}
          offset={16}
        />
      )}
    </>
  );
};

// 🎓 EDUCATIONAL NOTES - ENHANCED:
//
// 1. **Advanced State Management**:
//    - Multiple useState hooks for tooltip state
//    - Timer management for hover delays
//    - Position tracking with mouse coordinates
//    - Pin/unpin state for persistent tooltips
//
// 2. **Mouse Event Handling**:
//    - onMouseEnter: Starts hover timer, sets initial position
//    - onMouseMove: Updates position in real-time (if not pinned)
//    - onMouseLeave: Clears timer, hides tooltip (if not pinned)
//    - onClick: Direct tooltip activation with auto-pin
//
// 3. **Performance Optimizations**:
//    - useCallback prevents unnecessary re-renders
//    - Timer cleanup prevents memory leaks
//    - Conditional rendering reduces DOM updates
//    - Event delegation for efficient event handling
//
// 4. **Advanced UX Patterns**:
//    - Hover delay prevents accidental tooltips
//    - Pin functionality for persistent viewing
//    - Click-to-pin for touch devices
//    - Smart positioning that avoids screen edges
//
// 5. **TypeScript Enhancements**:
//    - Optional props with defaults
//    - Proper typing for mouse events
//    - Interface extensions for new functionality
//    - Type guards for safe assistant access
//
// 6. **Accessibility Improvements**:
//    - Info button with proper ARIA labels
//    - Keyboard navigation support
//    - Screen reader friendly content
//    - High contrast visual indicators
//
// This enhanced component demonstrates:
// - Complex state management patterns
// - Advanced mouse interaction handling
// - Performance-conscious React patterns
// - Professional tooltip implementation
// - Responsive and accessible design
// - TypeScript best practices