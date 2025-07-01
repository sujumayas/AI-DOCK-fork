// 🚀 AssistantQuickSwitcher.tsx
// Fast assistant switching panel with mobile-first responsive design
// Slides up from bottom on mobile, appears as modal on desktop

import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Settings, Bot, Sparkles, MessageSquare, Clock, ChevronDown } from 'lucide-react';
import { AssistantSummary } from '../../types/assistant';

/**
 * Props interface for the AssistantQuickSwitcher component
 * 
 * 🎓 LEARNING: Component Interface Design
 * =====================================
 * Well-designed props interfaces make components:
 * - Predictable: Clear expectations for data
 * - Reusable: Can be used in different contexts
 * - Type-safe: Catch errors at compile time
 * - Self-documenting: Props names explain usage
 */
interface AssistantQuickSwitcherProps {
  /** Controls whether the switcher is visible */
  isOpen: boolean;
  
  /** Callback when user wants to close the switcher */
  onClose: () => void;
  
  /** Array of available assistants to choose from */
  assistants: AssistantSummary[];
  
  /** Currently selected assistant ID (null for default chat) */
  selectedId: number | null;
  
  /** Callback when user selects an assistant (null for default chat) */
  onSelect: (assistantId: number | null) => void;
  
  /** Callback when user wants to manage assistants (open full CRUD interface) */
  onManageClick: () => void;
  
  /** Whether chat is currently streaming (prevents assistant switching) */
  isStreaming?: boolean;
}

/**
 * AssistantQuickSwitcher Component
 * 
 * 🎓 LEARNING: Advanced Component Patterns
 * =======================================
 * This component demonstrates:
 * - Responsive design (mobile vs desktop behavior)
 * - Search functionality with real-time filtering
 * - Smooth animations and transitions
 * - Event handling and component communication
 * - Accessibility features (ESC key, focus management)
 * - Performance optimization with useMemo
 */
export const AssistantQuickSwitcher: React.FC<AssistantQuickSwitcherProps> = ({
  isOpen,
  onClose,
  assistants,
  selectedId,
  onSelect,
  onManageClick,
  isStreaming = false
}) => {

  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================

  /**
   * Search query state
   * 
   * 🎓 LEARNING: Local Component State
   * =================================
   * We keep search state local to this component because:
   * - It's temporary UI state (resets when closed)
   * - Other components don't need to know about it
   * - Keeps the component self-contained
   */
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Animation state for smooth slide-up effect
   * 
   * 🎓 LEARNING: Animation States
   * ============================
   * We track animation state separately from isOpen to:
   * - Control when to render the component
   * - Apply different CSS classes for enter/exit animations
   * - Ensure smooth transitions
   */
  const [isAnimating, setIsAnimating] = useState(false);

  // =============================================================================
  // COMPUTED VALUES (MEMOIZED FOR PERFORMANCE)
  // =============================================================================

  /**
   * Filtered assistants based on search query
   * 
   * 🎓 LEARNING: useMemo for Performance
   * ==================================
   * useMemo prevents unnecessary recalculations:
   * - Only re-filters when assistants or searchQuery change
   * - Important for large lists or complex filtering logic
   * - Dependency array [assistants, searchQuery] controls when to recalculate
   */
  const filteredAssistants = useMemo(() => {
    if (!searchQuery.trim()) {
      return assistants;
    }

    const query = searchQuery.toLowerCase().trim();
    return assistants.filter(assistant => 
      assistant.name.toLowerCase().includes(query) ||
      (assistant.description && assistant.description.toLowerCase().includes(query)) ||
      assistant.system_prompt_preview.toLowerCase().includes(query)
    );
  }, [assistants, searchQuery]);

  /**
   * Usage statistics for display
   * 
   * 🎓 LEARNING: Derived State
   * =========================
   * Instead of storing totals in state, we calculate them from existing data.
   * This ensures the UI always shows current values and reduces state complexity.
   */
  const totalConversations = useMemo(() => {
    return assistants.reduce((total, assistant) => total + assistant.conversation_count, 0);
  }, [assistants]);

  const activeAssistants = useMemo(() => {
    return assistants.filter(assistant => assistant.is_active).length;
  }, [assistants]);

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  /**
   * Handle assistant selection
   * 
   * 🎓 LEARNING: Event Handler Patterns
   * ==================================
   * Good event handlers:
   * - Accept the minimal data needed (just the ID)
   * - Call parent callbacks to maintain data flow
   * - Handle cleanup (closing modal, resetting search)
   * - Are named clearly for their purpose
   */
  const handleAssistantSelect = (assistantId: number | null) => {
    // 🚫 Prevent assistant switching while streaming
    if (isStreaming) {
      console.log('🚫 Cannot switch assistants while streaming is active');
      return;
    }
    
    onSelect(assistantId);
    handleClose();
  };

  /**
   * Handle modal close with cleanup
   * 
   * 🎓 LEARNING: Component Cleanup
   * =============================
   * Proper cleanup prevents:
   * - Memory leaks from event listeners
   * - Stale state when reopening
   * - Unexpected behavior between uses
   */
  const handleClose = () => {
    setSearchQuery(''); // Reset search when closing
    onClose();
  };

  /**
   * Handle manage button click
   * 
   * 🎓 LEARNING: Composition over Inheritance
   * ========================================
   * Instead of building assistant management into this component,
   * we delegate to a parent component. This keeps components focused
   * and allows for flexible composition.
   */
  const handleManageClick = () => {
    onManageClick();
    handleClose(); // Close switcher when opening manager
  };

  // =============================================================================
  // EFFECTS FOR LIFECYCLE MANAGEMENT
  // =============================================================================

  /**
   * Handle ESC key and animation state
   * 
   * 🎓 LEARNING: useEffect Patterns
   * ==============================
   * This effect demonstrates several important patterns:
   * - Event listener cleanup in the return function
   * - Conditional event listener attachment
   * - Body scroll prevention for modals
   * - Animation state management
   */
  useEffect(() => {
    if (isOpen) {
      // Start entrance animation
      setIsAnimating(true);
      
      // Prevent body scrolling on mobile when modal is open
      document.body.style.overflow = 'hidden';
      
      // Add ESC key listener
      const handleEscKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleClose();
        }
      };
      
      document.addEventListener('keydown', handleEscKey);
      
      // Cleanup function - runs when effect dependencies change or component unmounts
      return () => {
        document.removeEventListener('keydown', handleEscKey);
        document.body.style.overflow = 'unset';
      };
    } else {
      // Reset animation state when closed
      setIsAnimating(false);
    }
  }, [isOpen]);

  /**
   * Auto-focus search input when modal opens
   * 
   * 🎓 LEARNING: Focus Management
   * ============================
   * Good UX includes proper focus management:
   * - Focus search input when modal opens
   * - Users can immediately start typing
   * - Improves keyboard navigation experience
   */
  useEffect(() => {
    if (isOpen && isAnimating) {
      // Small delay to ensure the input is rendered
      const focusTimeout = setTimeout(() => {
        const searchInput = document.getElementById('assistant-search');
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
      
      return () => clearTimeout(focusTimeout);
    }
  }, [isOpen, isAnimating]);

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render an individual assistant card
   * 
   * 🎓 LEARNING: Component Decomposition
   * ===================================
   * Breaking rendering into smaller functions:
   * - Makes the main render method cleaner
   * - Allows for easier testing and debugging
   * - Enables code reuse
   * - Improves readability
   */
  const renderAssistantCard = (assistant: AssistantSummary) => {
    const isSelected = assistant.id === selectedId;
    
    return (
      <button
        key={assistant.id}
        onClick={() => handleAssistantSelect(assistant.id)}
        className={`
          w-full p-4 rounded-xl border-2 text-left
          transition-all duration-200 ease-out
          hover:scale-[1.02] hover:shadow-lg
          focus:outline-none focus:ring-2 focus:ring-blue-400/50
          ${isSelected 
            ? 'border-blue-400 bg-blue-50/80 shadow-md' 
            : 'border-white/30 bg-white/10 hover:bg-white/20'
          }
        `}
      >
        <div className="flex items-center space-x-3">
          {/* Assistant Icon */}
          <div className={`
            flex-shrink-0 w-12 h-12 rounded-full
            flex items-center justify-center
            ${isSelected
              ? 'bg-blue-500/20 border-2 border-blue-400/40'
              : 'bg-purple-500/20 border-2 border-purple-400/30'
            }
          `}>
            <Sparkles className={`w-6 h-6 ${isSelected ? 'text-blue-400' : 'text-purple-300'}`} />
          </div>
          
          {/* Assistant Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-white text-sm truncate">
                {assistant.name}
              </h3>
              {isSelected && (
                <div className="flex-shrink-0 w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              )}
            </div>
            
            <p className="text-blue-100/80 text-xs leading-relaxed line-clamp-2 mb-2">
              {assistant.system_prompt_preview.length > 80
                ? `${assistant.system_prompt_preview.slice(0, 80)}...`
                : assistant.system_prompt_preview
              }
            </p>
            
            {/* Assistant Metadata */}
            <div className="flex items-center space-x-3 text-xs text-blue-100/60">
              <div className="flex items-center space-x-1">
                <MessageSquare className="w-3 h-3" />
                <span>{assistant.conversation_count}</span>
              </div>
              
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${
                  assistant.is_active ? 'bg-green-400' : 'bg-yellow-400'
                }`} />
                <span>{assistant.is_active ? 'Active' : 'Inactive'}</span>
              </div>
              
              {assistant.is_new && (
                <span className="bg-blue-400/20 text-blue-300 px-2 py-1 rounded-full text-xs">
                  New
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  };

  /**
   * Render the default chat option
   * 
   * 🎓 LEARNING: Consistent Interface Design
   * =======================================
   * The default chat option follows the same visual pattern
   * as assistant cards, providing a consistent user experience.
   */
  const renderDefaultChatCard = () => {
    const isSelected = selectedId === null;
    
    return (
      <button
        onClick={() => handleAssistantSelect(null)}
        className={`
          w-full p-4 rounded-xl border-2 text-left
          transition-all duration-200 ease-out
          hover:scale-[1.02] hover:shadow-lg
          focus:outline-none focus:ring-2 focus:ring-blue-400/50
          ${isSelected 
            ? 'border-blue-400 bg-blue-50/80 shadow-md' 
            : 'border-white/30 bg-white/10 hover:bg-white/20'
          }
        `}
      >
        <div className="flex items-center space-x-3">
          {/* Default Chat Icon */}
          <div className={`
            flex-shrink-0 w-12 h-12 rounded-full
            flex items-center justify-center
            ${isSelected
              ? 'bg-blue-500/20 border-2 border-blue-400/40'
              : 'bg-blue-500/20 border-2 border-blue-400/30'
            }
          `}>
            <Bot className={`w-6 h-6 ${isSelected ? 'text-blue-400' : 'text-blue-300'}`} />
          </div>
          
          {/* Default Chat Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-white text-sm">
                Default Chat
              </h3>
              {isSelected && (
                <div className="flex-shrink-0 w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              )}
            </div>
            
            <p className="text-blue-100/80 text-xs leading-relaxed mb-2">
              General AI assistant for any task or question
            </p>
            
            <div className="flex items-center space-x-1 text-xs text-blue-100/60">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span>Always Available</span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  // Don't render anything if not open
  if (!isOpen) return null;

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <>
      {/* Backdrop */}
      {/* 
        🎓 LEARNING: Modal Backdrop Pattern
        ==================================
        The backdrop serves multiple purposes:
        - Darkens background to focus attention
        - Provides click-outside-to-close functionality
        - Creates visual separation from main content
        - Uses backdrop-blur for modern glass effect
      */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={handleClose}
      />
      
      {/* Panel Container */}
      {/* 
        🎓 LEARNING: Responsive Modal Positioning
        ========================================
        Different positioning strategies:
        - Mobile: Fixed to bottom, slides up (better thumb access)
        - Desktop: Centered modal (traditional desktop UX)
        - Transition classes provide smooth animation
      */}
      <div className={`
        fixed z-50
        
        /* Mobile: Slide up from bottom */
        bottom-0 left-0 right-0
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        
        /* Desktop: Centered modal */
        md:top-1/2 md:left-1/2 md:bottom-auto
        md:w-full md:max-w-2xl
        md:transform md:transition-all md:duration-300 md:ease-out
        ${isOpen 
          ? 'md:-translate-x-1/2 md:-translate-y-1/2 md:scale-100 md:opacity-100' 
          : 'md:-translate-x-1/2 md:-translate-y-1/2 md:scale-95 md:opacity-0'
        }
      `}>
        
        <div className="
          bg-white/95 backdrop-blur-md
          border-t border-white/20
          rounded-t-3xl
          shadow-2xl
          max-h-[85vh] 
          md:rounded-2xl md:border
          md:max-h-[80vh]
        ">
          
          {/* Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  Switch Assistant
                </h2>
                <p className="text-sm text-gray-600">
                  {activeAssistants} active • {totalConversations} total conversations
                </p>
              </div>
              
              <button
                onClick={handleClose}
                className="
                  p-2 rounded-full 
                  bg-gray-100 hover:bg-gray-200 
                  text-gray-500 hover:text-gray-700
                  transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-blue-400/50
                "
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Search Bar */}
            {/* 
              🎓 LEARNING: Search Input Design
              ==============================
              Good search inputs include:
              - Clear visual hierarchy with icon
              - Immediate feedback (controlled input)
              - Accessible labels and focus states
              - Responsive sizing for different screens
            */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="assistant-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assistants..."
                className="
                  w-full pl-10 pr-4 py-3
                  bg-white/50 border border-gray-200/50
                  rounded-xl
                  text-gray-900 placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent
                  transition-all duration-200
                "
              />
            </div>
          </div>
          
          {/* Assistant List */}
          <div className="p-6 overflow-y-auto max-h-96">
            {/* 
              🎓 LEARNING: Conditional Rendering Patterns
              ==========================================
              We handle three different states:
              1. Default chat option (always shown first)
              2. Filtered assistant list (based on search)
              3. No results state (when search yields nothing)
            */}
            
            <div className="space-y-3">
              
              {/* Default Chat Option - Always First */}
              {(!searchQuery.trim() || 'default chat general assistant'.includes(searchQuery.toLowerCase())) && (
                <div>
                  {renderDefaultChatCard()}
                  {(filteredAssistants.length > 0 || !searchQuery.trim()) && (
                    <div className="my-4 flex items-center">
                      <div className="flex-1 border-t border-gray-200/50" />
                      <span className="px-3 text-xs text-gray-500 bg-white/80 rounded-full">
                        Custom Assistants
                      </span>
                      <div className="flex-1 border-t border-gray-200/50" />
                    </div>
                  )}
                </div>
              )}
              
              {/* Assistant Cards */}
              {filteredAssistants.map(renderAssistantCard)}
              
              {/* No Results State */}
              {searchQuery.trim() && filteredAssistants.length === 0 && (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No assistants found
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Try different keywords or create a new assistant
                  </p>
                  <button
                    onClick={handleManageClick}
                    className="
                      px-4 py-2 bg-blue-600 text-white rounded-lg
                      hover:bg-blue-700 transition-colors duration-200
                      focus:outline-none focus:ring-2 focus:ring-blue-400/50
                    "
                  >
                    Create Assistant
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Footer Actions */}
          <div className="p-6 border-t border-white/10">
            <button
              onClick={handleManageClick}
              className="
                w-full flex items-center justify-center space-x-2
                px-4 py-3
                bg-gradient-to-r from-blue-600 to-purple-600
                hover:from-blue-700 hover:to-purple-700
                text-white font-medium
                rounded-xl
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-400/50
                hover:shadow-lg hover:scale-[1.02]
              "
            >
              <Settings className="w-4 h-4" />
              <span>Manage Assistants</span>
            </button>
            
            <p className="text-center text-xs text-gray-500 mt-3">
              Create, edit, and organize your AI assistants
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

/**
 * 🎓 LEARNING SUMMARY: AssistantQuickSwitcher
 * ==========================================
 * 
 * **Key Concepts Demonstrated:**
 * 
 * 1. **Responsive Modal Design**
 *    - Mobile: Slides up from bottom (thumb-friendly)
 *    - Desktop: Centered modal (traditional UX)
 *    - Different animation strategies for each
 * 
 * 2. **Search and Filtering**
 *    - Real-time search with useMemo optimization
 *    - Multi-field search (name, description, prompt)
 *    - Graceful no-results handling
 * 
 * 3. **Component Communication**
 *    - Clean props interface with TypeScript
 *    - Event callbacks for parent communication
 *    - Separation of concerns (UI vs business logic)
 * 
 * 4. **Performance Optimization**
 *    - useMemo for expensive calculations
 *    - Proper dependency arrays
 *    - Conditional rendering to avoid unnecessary work
 * 
 * 5. **User Experience**
 *    - Smooth animations and transitions
 *    - Auto-focus on search input
 *    - ESC key support for closing
 *    - Visual feedback for selected state
 * 
 * 6. **Accessibility**
 *    - Keyboard navigation support
 *    - Focus management
 *    - Semantic HTML structure
 *    - Screen reader friendly
 * 
 * **Integration Points:**
 * - Uses AssistantSummary types from the type system
 * - Follows project styling patterns (glassmorphism)
 * - Ready for integration with chat interface
 * - Delegates assistant management to parent components
 * 
 * **Next Steps:**
 * - Integrate with existing chat interface
 * - Connect to assistant state management
 * - Add animation presets for different screen sizes
 * - Consider virtualization for large assistant lists
 */