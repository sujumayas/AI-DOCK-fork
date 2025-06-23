// Floating Assistant Button Component
// Provides quick one-click access to assistant management from anywhere in the chat
// Features glassmorphism design with smooth animations and responsive behavior

import React from 'react';
import { Bot, Settings } from 'lucide-react';

interface FloatingAssistantButtonProps {
  /** Number of assistants to display in badge */
  assistantCount: number;
  /** Whether the assistant manager is currently open */
  isManagerOpen: boolean;
  /** Callback when button is clicked */
  onClick: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * FloatingAssistantButton - Quick access to assistant management
 * 
 * 🎓 LEARNING: Floating Action Button (FAB) Design
 * ===============================================
 * This component demonstrates key concepts for creating floating UI elements:
 * 
 * 1. **Fixed Positioning**: Using CSS fixed positioning to stay in viewport
 * 2. **Z-Index Layering**: Ensuring the button stays above other content
 * 3. **Responsive Design**: Adapting size and position for mobile devices
 * 4. **State-Driven Animation**: Smooth transitions based on props
 * 5. **Glassmorphism**: Modern transparent design with backdrop blur
 * 6. **Badge Component**: Dynamic counter display
 * 7. **Accessibility**: Proper ARIA labels and keyboard navigation
 */
export const FloatingAssistantButton: React.FC<FloatingAssistantButtonProps> = ({
  assistantCount,
  isManagerOpen,
  onClick,
  className = ''
}) => {
  // Don't render if manager is open (clean UX)
  if (isManagerOpen) {
    return null;
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
      {/* 
        🎓 LEARNING: Fixed Positioning
        =============================
        The 'fixed' class creates a positioning context relative to the viewport,
        not the parent element. This means the button will stay in the same
        position even when the page scrolls.
        
        - bottom-6: 24px from bottom edge
        - right-6: 24px from right edge  
        - z-50: High z-index to stay above other content
      */}
      
      <button
        onClick={onClick}
        className={`
          group relative
          w-14 h-14 
          bg-gradient-to-br from-blue-500/80 to-purple-600/80
          backdrop-blur-md
          border border-white/30
          rounded-full
          shadow-lg shadow-black/25
          hover:shadow-xl hover:shadow-black/30
          hover:scale-105
          active:scale-95
          transition-all duration-300 ease-out
          focus:outline-none focus:ring-4 focus:ring-blue-400/30
          
          md:w-16 md:h-16
        `}
        aria-label={`Open assistant manager (${assistantCount} assistants)`}
        title={`Manage Assistants (${assistantCount} available)`}
      >
        {/* 
          🎓 LEARNING: Glassmorphism Design
          ================================
          This button uses modern glassmorphism effects:
          
          - backdrop-blur-md: Creates frosted glass effect
          - bg-gradient-to-br: Diagonal gradient background
          - border-white/30: Semi-transparent border
          - from-blue-500/80: Semi-transparent blue (80% opacity)
          - to-purple-600/80: Semi-transparent purple
          
          The /80 syntax in Tailwind creates 80% opacity versions of colors.
        */}

        {/* Main Icon */}
        <div className="flex items-center justify-center w-full h-full">
          <Bot className="w-6 h-6 md:w-7 md:h-7 text-white drop-shadow-sm" />
        </div>

        {/* 
          🎓 LEARNING: Badge Component Design
          ===================================
          Badges should be:
          - Positioned absolutely relative to parent
          - Small and unobtrusive
          - High contrast for readability
          - Responsive to content length
        */}
        
        {/* Assistant Count Badge */}
        {assistantCount > 0 && (
          <div className={`
            absolute -top-2 -right-2
            min-w-[20px] h-5
            bg-red-500
            border-2 border-white
            rounded-full
            flex items-center justify-center
            text-white text-xs font-bold
            shadow-md
            
            md:min-w-[24px] md:h-6 md:text-sm
          `}>
            {/* Format count for display (99+ for large numbers) */}
            {assistantCount > 99 ? '99+' : assistantCount}
          </div>
        )}

        {/* 
          🎓 LEARNING: Hover Effects & Micro-Interactions
          =============================================
          Good floating buttons should provide clear feedback:
          
          - Hover effects show the button is interactive
          - Scale animations provide tactile feedback
          - Secondary icons can appear on hover for additional context
        */}

        {/* Hover Overlay - Shows management icon */}
        <div className={`
          absolute inset-0
          bg-white/10
          rounded-full
          flex items-center justify-center
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
        `}>
          <Settings className="w-4 h-4 md:w-5 md:h-5 text-white/80" />
        </div>

        {/* 
          🎓 LEARNING: Accessibility for Floating Elements
          ===============================================
          Floating buttons need special accessibility consideration:
          
          - Clear aria-label describing the action and current state
          - title attribute for tooltip on desktop
          - focus:ring for keyboard navigation
          - Proper contrast ratios for text and backgrounds
        */}
      </button>

      {/* 
        🎓 LEARNING: Mobile Responsiveness
        =================================
        Mobile considerations for floating buttons:
        
        - Larger touch targets (44px minimum)
        - Positioned away from gesture areas
        - Scale appropriately for thumb interaction
        - Consider landscape orientation
        
        Our button scales from 56px (mobile) to 64px (desktop).
      */}
    </div>
  );
};

/**
 * 🎓 LEARNING SUMMARY: Floating Action Button Best Practices
 * =========================================================
 * 
 * **Design Principles:**
 * 
 * 1. **Primary Action Focus**
 *    - FABs should represent the most important action on screen
 *    - Only one FAB per screen to avoid confusion
 *    - Clear, recognizable icon that suggests the action
 * 
 * 2. **Positioning Strategy**
 *    - Bottom-right is standard for right-handed users
 *    - Avoid OS navigation areas (especially mobile)
 *    - Maintain consistent position across views
 *    - Consider thumb reach zones on mobile
 * 
 * 3. **Visual Hierarchy**
 *    - High contrast against backgrounds
 *    - Elevated appearance with shadows
 *    - Larger than surrounding elements
 *    - Vibrant colors to draw attention
 * 
 * 4. **Interaction Design**
 *    - Immediate visual feedback on interaction
 *    - Scale animations provide tactile feedback
 *    - Hover states for desktop users
 *    - Focus states for keyboard users
 * 
 * 5. **State Management**
 *    - Hide when related content is open
 *    - Show badges for dynamic content counts
 *    - Disable during loading states
 *    - Animate state changes smoothly
 * 
 * **Common Patterns:**
 * - **Create Action**: + icon for adding new items
 * - **Management**: Settings/Bot icon for configuration
 * - **Communication**: Message icon for chat/contact
 * - **Navigation**: Arrow/Menu icon for drawer toggle
 * 
 * **Mobile Considerations:**
 * - Minimum 44x44px touch target
 * - Position away from system navigation
 * - Test with different screen sizes
 * - Consider one-handed operation
 * 
 * **Performance Tips:**
 * - Use CSS transforms for animations (GPU accelerated)
 * - Minimize repaints with transform/opacity changes
 * - Debounce rapid state changes
 * - Optimize for 60fps animations
 */

// Export type for consumers who need to implement the interface
export type { FloatingAssistantButtonProps };
