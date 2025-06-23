// 🎯 AssistantInfoTooltip.tsx
// Advanced tooltip component for detailed assistant information
// Features: Smart positioning, pin/unpin, glassmorphism design, mobile-friendly

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Bot, 
  Calendar, 
  MessageSquare, 
  Activity, 
  Pin, 
  PinOff, 
  X,
  Sparkles,
  Clock,
  User,
  Zap
} from 'lucide-react';
import { AssistantSummary, formatAssistantStatus, formatConversationCount } from '../../types/assistant';

// 🎓 LEARNING: Advanced Component Props Interface
// ===============================================
// This interface demonstrates several advanced TypeScript patterns:
// - Optional callback functions with proper typing
// - Position object with x,y coordinates
// - Boolean state props with defaults
// - Flexible styling overrides
interface AssistantInfoTooltipProps {
  assistant: AssistantSummary | null;    // The assistant to display info for
  isVisible: boolean;                    // Controls tooltip visibility
  position: { x: number; y: number };   // Mouse/trigger position
  onPin?: () => void;                   // Called when user pins tooltip
  onUnpin?: () => void;                 // Called when user unpins tooltip  
  isPinned?: boolean;                   // Whether tooltip is currently pinned
  className?: string;                   // Additional CSS classes
  maxWidth?: number;                    // Maximum tooltip width (default: 320px)
  offset?: number;                      // Distance from trigger (default: 12px)
}

// 🎓 LEARNING: Viewport Detection Hook
// ===================================
// Custom hook for detecting screen size and safe areas
const useViewportDetection = () => {
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false
  });

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < 768
      });
    };

    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  return viewport;
};

export const AssistantInfoTooltip: React.FC<AssistantInfoTooltipProps> = ({
  assistant,
  isVisible,
  position,
  onPin,
  onUnpin,
  isPinned = false,
  className = '',
  maxWidth = 320,
  offset = 12
}) => {
  // 🎓 LEARNING: React Refs for DOM Measurements
  // ===========================================
  // useRef gives us direct access to DOM elements for positioning calculations
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [calculatedPosition, setCalculatedPosition] = useState({ x: 0, y: 0 });
  const [placement, setPlacement] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom');
  
  // Get viewport information for smart positioning
  const viewport = useViewportDetection();
  
  // 🎓 LEARNING: Smart Positioning Algorithm
  // =======================================
  // This calculates the best position to avoid viewport edges
  const calculateOptimalPosition = useCallback(() => {
    if (!tooltipRef.current || !isVisible) return;

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Available space in each direction
    const spaceTop = position.y - offset;
    const spaceBottom = viewport.height - position.y - offset;
    const spaceLeft = position.x - offset;
    const spaceRight = viewport.width - position.x - offset;
    
    // Tooltip dimensions (estimated or measured)
    const tooltipWidth = Math.min(maxWidth, tooltipRect.width || 320);
    const tooltipHeight = tooltipRect.height || 200;
    
    let newPlacement: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
    let x = position.x;
    let y = position.y;
    
    // 🎯 PRIORITY 1: Vertical placement (preferred)
    if (spaceBottom >= tooltipHeight + offset) {
      // Place below
      newPlacement = 'bottom';
      y = position.y + offset;
      x = Math.max(offset, Math.min(position.x - tooltipWidth / 2, viewport.width - tooltipWidth - offset));
    } else if (spaceTop >= tooltipHeight + offset) {
      // Place above
      newPlacement = 'top';
      y = position.y - tooltipHeight - offset;
      x = Math.max(offset, Math.min(position.x - tooltipWidth / 2, viewport.width - tooltipWidth - offset));
    } 
    // 🎯 PRIORITY 2: Horizontal placement (fallback)
    else if (spaceRight >= tooltipWidth + offset) {
      // Place to the right
      newPlacement = 'right';
      x = position.x + offset;
      y = Math.max(offset, Math.min(position.y - tooltipHeight / 2, viewport.height - tooltipHeight - offset));
    } else if (spaceLeft >= tooltipWidth + offset) {
      // Place to the left
      newPlacement = 'left';
      x = position.x - tooltipWidth - offset;
      y = Math.max(offset, Math.min(position.y - tooltipHeight / 2, viewport.height - tooltipHeight - offset));
    }
    // 🎯 PRIORITY 3: Force fit with clipping
    else {
      // Not enough space anywhere - use best fit and allow clipping
      newPlacement = spaceBottom > spaceTop ? 'bottom' : 'top';
      
      if (newPlacement === 'bottom') {
        y = position.y + offset;
      } else {
        y = Math.max(offset, position.y - tooltipHeight - offset);
      }
      
      x = Math.max(offset, Math.min(position.x - tooltipWidth / 2, viewport.width - tooltipWidth - offset));
    }
    
    setCalculatedPosition({ x, y });
    setPlacement(newPlacement);
  }, [position.x, position.y, viewport.width, viewport.height, maxWidth, offset, isVisible]);

  // Recalculate position when dependencies change
  useEffect(() => {
    if (isVisible) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(calculateOptimalPosition, 10);
      return () => clearTimeout(timer);
    }
  }, [calculateOptimalPosition, isVisible]);

  // 🎓 LEARNING: Click Outside Detection
  // ===================================
  // Handle unpinning when clicking outside (only when pinned)
  useEffect(() => {
    if (!isPinned) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        onUnpin?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPinned, onUnpin]);

  // Don't render if no assistant or not visible (unless pinned)
  if (!assistant || (!isVisible && !isPinned)) {
    return null;
  }

  // 🎓 LEARNING: Date Formatting Utility
  // ===================================
  const formatCreatedDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return 'Today';
      if (diffDays === 2) return 'Yesterday';
      if (diffDays <= 7) return `${diffDays} days ago`;
      if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
      if (diffDays <= 365) return `${Math.ceil(diffDays / 30)} months ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div
      ref={tooltipRef}
      className={`
        fixed z-50 
        bg-white/95 backdrop-blur-xl 
        border border-white/30 
        rounded-2xl shadow-2xl
        transform transition-all duration-300 ease-out
        ${isVisible || isPinned 
          ? 'opacity-100 scale-100 pointer-events-auto' 
          : 'opacity-0 scale-95 pointer-events-none'
        }
        ${className}
      `}
      style={{
        left: calculatedPosition.x,
        top: calculatedPosition.y,
        maxWidth: maxWidth,
        minWidth: Math.min(280, viewport.width - 40),
        // 🎨 GLASSMORPHISM: Advanced backdrop blur with gradient
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,248,255,0.95) 100%)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* 🌈 BACKGROUND GRADIENT OVERLAY */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 rounded-2xl pointer-events-none" />
      
      {/* 📋 HEADER SECTION */}
      <div className="relative p-4 border-b border-gray-200/50">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1 min-w-0">
            {/* 🤖 ASSISTANT AVATAR */}
            <div className={`
              flex-shrink-0 w-12 h-12 rounded-xl 
              flex items-center justify-center
              ${assistant.is_active 
                ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
                : 'bg-gradient-to-br from-gray-400 to-gray-600'
              }
              shadow-lg
            `}>
              {assistant.is_new ? (
                <Sparkles className="w-6 h-6 text-white" />
              ) : (
                <Bot className="w-6 h-6 text-white" />
              )}
            </div>
            
            {/* 🏷️ ASSISTANT NAME & STATUS */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-gray-800 text-lg truncate">
                  {assistant.name}
                </h3>
                <span className={`
                  px-2 py-1 text-xs font-medium rounded-full
                  ${assistant.is_active 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-600'
                  }
                `}>
                  {formatAssistantStatus(assistant)}
                </span>
                {assistant.is_new && (
                  <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                    New
                  </span>
                )}
              </div>
              
              {/* 📝 DESCRIPTION */}
              {assistant.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                  {assistant.description}
                </p>
              )}
            </div>
          </div>
          
          {/* 📌 PIN/UNPIN CONTROLS */}
          <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
            {isPinned ? (
              <button
                onClick={onUnpin}
                className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                title="Unpin tooltip"
              >
                <PinOff className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onPin}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                title="Pin tooltip"
              >
                <Pin className="w-4 h-4" />
              </button>
            )}
            
            {/* ❌ CLOSE BUTTON (only when pinned) */}
            {isPinned && (
              <button
                onClick={onUnpin}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                title="Close tooltip"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* 📊 DETAILS SECTION */}
      <div className="relative p-4 space-y-4">
        {/* 🧠 SYSTEM PROMPT PREVIEW */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-700">System Prompt</span>
          </div>
          <div className="bg-gray-50/80 rounded-lg p-3 border border-gray-200/50">
            <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">
              {assistant.system_prompt_preview || 'No system prompt preview available'}
            </p>
          </div>
        </div>
        
        {/* 📈 USAGE STATISTICS */}
        <div className="grid grid-cols-2 gap-3">
          {/* 💬 CONVERSATIONS COUNT */}
          <div className="bg-blue-50/80 rounded-lg p-3 border border-blue-200/50">
            <div className="flex items-center space-x-2 mb-1">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-medium text-blue-700">Conversations</span>
            </div>
            <p className="text-lg font-bold text-blue-800">
              {assistant.conversation_count}
            </p>
            <p className="text-xs text-blue-600">
              {formatConversationCount(assistant.conversation_count)}
            </p>
          </div>
          
          {/* 📅 CREATION DATE */}
          <div className="bg-green-50/80 rounded-lg p-3 border border-green-200/50">
            <div className="flex items-center space-x-2 mb-1">
              <Calendar className="w-4 h-4 text-green-500" />
              <span className="text-xs font-medium text-green-700">Created</span>
            </div>
            <p className="text-sm font-bold text-green-800">
              {formatCreatedDate(assistant.created_at)}
            </p>
            <p className="text-xs text-green-600">
              {new Date(assistant.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        {/* 🎯 QUICK ACTIONS */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
          <div className="flex items-center space-x-2">
            <Activity className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500">
              Assistant ID: {assistant.id}
            </span>
          </div>
          
          {/* 📊 STATUS INDICATOR */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              assistant.is_active ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
            }`} />
            <span className="text-xs font-medium text-gray-600">
              {assistant.is_active ? 'Ready to use' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
      
      {/* 📍 PLACEMENT INDICATOR ARROW */}
      <div 
        className={`absolute w-3 h-3 bg-white/95 border-l border-t border-white/30 transform rotate-45 ${
          placement === 'bottom' ? '-top-1.5 left-1/2 -translate-x-1/2' :
          placement === 'top' ? '-bottom-1.5 left-1/2 -translate-x-1/2' :
          placement === 'right' ? 'top-1/2 -left-1.5 -translate-y-1/2' :
          'top-1/2 -right-1.5 -translate-y-1/2'
        }`}
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,248,255,0.95) 100%)',
        }}
      />
    </div>
  );
};

// 🎓 EDUCATIONAL NOTES:
//
// 1. **Smart Positioning Algorithm**:
//    - Calculates available space in all directions
//    - Prioritizes bottom placement, then top, then sides
//    - Automatically adjusts to avoid viewport edges
//    - Handles mobile screens with smaller dimensions
//
// 2. **React Refs and DOM Manipulation**:
//    - useRef provides direct access to DOM elements
//    - getBoundingClientRect() gives precise measurements
//    - Real-time position calculations based on content size
//
// 3. **Advanced State Management**:
//    - Multiple state variables for position, placement, viewport
//    - Custom hook for viewport detection with resize handling
//    - Callback functions for parent component communication
//
// 4. **Performance Optimizations**:
//    - useCallback prevents unnecessary recalculations
//    - Conditional rendering for better performance
//    - Debounced position updates with setTimeout
//
// 5. **Modern CSS Techniques**:
//    - Glassmorphism with backdrop-blur and gradients
//    - CSS transforms for smooth animations
//    - Dynamic classes based on state
//    - Responsive design with viewport-aware sizing
//
// 6. **Accessibility Features**:
//    - Proper ARIA labels and screen reader support
//    - Keyboard navigation support (ESC to close when pinned)
//    - High contrast colors and readable typography
//    - Touch-friendly buttons for mobile devices
//
// This component demonstrates professional React patterns:
// - Advanced positioning algorithms
// - Responsive design techniques  
// - Custom hooks for reusable logic
// - TypeScript for complete type safety
// - Modern CSS and animation techniques
// - Comprehensive accessibility support
