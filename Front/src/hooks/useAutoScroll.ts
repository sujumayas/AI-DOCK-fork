// 🎯 Smart Auto-Scroll Hook for Chat Interfaces
// Provides intelligent scrolling behavior that respects user intent
// Key Features: User scroll detection, streaming support, smooth transitions

import { useRef, useEffect, useCallback, useState } from 'react';

// 🎮 Configuration interface for customizing scroll behavior
interface AutoScrollConfig {
  // Scroll threshold to detect if user is near bottom (in pixels)
  nearBottomThreshold: number;
  // Debounce delay for scroll events (in milliseconds)
  scrollDebounceMs: number;
  // How long to wait before resuming auto-scroll after user stops scrolling
  userScrollTimeoutMs: number;
  // Smooth scroll behavior
  behavior: ScrollBehavior;
}

// 🎯 Scroll state interface for tracking current behavior
interface ScrollState {
  // Is the user currently scrolling manually?
  isUserScrolling: boolean;
  // Should we auto-scroll when new content arrives?
  shouldAutoScroll: boolean;
  // Is the scroll container near the bottom?
  isNearBottom: boolean;
  // Last recorded scroll position
  lastScrollTop: number;
  // Timestamp of last user scroll action
  lastUserScrollTime: number;
}

// 📊 Hook return interface - what the component gets back
interface UseAutoScrollReturn {
  // Ref to attach to the scroll container
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  // Ref to attach to the bottom anchor element
  bottomAnchorRef: React.RefObject<HTMLDivElement>;
  // Current scroll state (for debugging/UI feedback)
  scrollState: ScrollState;
  // Manual scroll to bottom function
  scrollToBottom: () => void;
  // Force enable/disable auto-scroll
  setAutoScrollEnabled: (enabled: boolean) => void;
  // Check if container is near bottom
  isNearBottom: boolean;
}

// 🔧 Default configuration values
const DEFAULT_CONFIG: AutoScrollConfig = {
  nearBottomThreshold: 100,    // Consider "near bottom" if within 100px
  scrollDebounceMs: 100,       // Debounce scroll events every 100ms
  userScrollTimeoutMs: 2000,   // Resume auto-scroll 2 seconds after user stops
  behavior: 'smooth'           // Smooth scrolling by default
};

/**
 * 🎯 useAutoScroll Hook
 * 
 * Provides intelligent auto-scrolling for chat interfaces that:
 * - Automatically scrolls to bottom for new messages
 * - Detects when user scrolls up to read history
 * - Pauses auto-scroll while user is reading
 * - Resumes auto-scroll when user returns to bottom
 * 
 * Perfect for streaming responses and real-time chat!
 */
export const useAutoScroll = (
  config: Partial<AutoScrollConfig> = {}
): UseAutoScrollReturn => {
  // 📦 Merge user config with defaults
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // 🎯 Refs for DOM elements
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  
  // 📊 Scroll state management
  const [scrollState, setScrollState] = useState<ScrollState>({
    isUserScrolling: false,
    shouldAutoScroll: true,
    isNearBottom: true,
    lastScrollTop: 0,
    lastUserScrollTime: 0
  });
  
  // ⏱️ Timers for debouncing and timeouts
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const userScrollTimeoutRef = useRef<NodeJS.Timeout>();
  const programmaticScrollRef = useRef<boolean>(false); // 🎯 Track programmatic scrolls
  
  // 🎯 Calculate if scroll position is near bottom
  const checkIsNearBottom = useCallback((element: HTMLDivElement): boolean => {
    const { scrollTop, scrollHeight, clientHeight } = element;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= finalConfig.nearBottomThreshold;
  }, [finalConfig.nearBottomThreshold]);
  
  // 🚀 Smooth scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (bottomAnchorRef.current) {
      programmaticScrollRef.current = true; // 🚩 Mark as programmatic scroll
      
      bottomAnchorRef.current.scrollIntoView({ 
        behavior: finalConfig.behavior,
        block: 'nearest'
      });
      
      // Update state to reflect that we're now at bottom
      setScrollState(prev => ({
        ...prev,
        isNearBottom: true,
        shouldAutoScroll: true
      }));
      
      // Clear the programmatic scroll flag after a short delay
      setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 150); // Give enough time for scroll events to fire
    }
  }, [finalConfig.behavior]);
  
  // 📜 Handle scroll events with intelligent user detection
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // 🚩 Ignore programmatic scrolls
    if (programmaticScrollRef.current) {
      const isNearBottom = checkIsNearBottom(container);
      setScrollState(prev => ({
        ...prev,
        lastScrollTop: container.scrollTop,
        isNearBottom,
        // Don't change user scrolling state for programmatic scrolls
      }));
      return;
    }
    
    const currentScrollTop = container.scrollTop;
    const isNearBottom = checkIsNearBottom(container);
    const now = Date.now();
    
    // 🔍 Improved user scroll detection
    // Check if scroll position changed significantly from last programmatic scroll
    const scrollDirection = currentScrollTop > scrollState.lastScrollTop ? 'down' : 'up';
    const scrollDistance = Math.abs(currentScrollTop - scrollState.lastScrollTop);
    
    // Consider it user-initiated if:
    // 1. Scrolling up (user reading history)
    // 2. Large scroll distance (user jumped around)
    // 3. Scrolling away from bottom while not near bottom
    const isUserInitiated = 
      scrollDirection === 'up' || 
      scrollDistance > 100 || 
      (!isNearBottom && scrollDirection === 'down');
    
    setScrollState(prev => ({
      ...prev,
      lastScrollTop: currentScrollTop,
      isNearBottom,
      isUserScrolling: isUserInitiated,
      shouldAutoScroll: isNearBottom && !isUserInitiated, // Only auto-scroll when near bottom AND not user scrolling
      lastUserScrollTime: isUserInitiated ? now : prev.lastUserScrollTime
    }));
    
    // 🕐 Set up timeout to resume auto-scroll after user stops scrolling
    if (isUserInitiated) {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
      
      userScrollTimeoutRef.current = setTimeout(() => {
        // Check current position when timeout fires
        const containerNow = scrollContainerRef.current;
        if (containerNow) {
          const isStillNearBottom = checkIsNearBottom(containerNow);
          setScrollState(prev => ({
            ...prev,
            isUserScrolling: false,
            shouldAutoScroll: isStillNearBottom, // Resume auto-scroll if currently near bottom
            isNearBottom: isStillNearBottom
          }));
        } else {
          setScrollState(prev => ({
            ...prev,
            isUserScrolling: false,
            shouldAutoScroll: prev.isNearBottom
          }));
        }
      }, finalConfig.userScrollTimeoutMs);
    }
    
  }, [scrollState.lastScrollTop, checkIsNearBottom, finalConfig.userScrollTimeoutMs, scrollContainerRef]);
  
  // 🎛️ Debounced scroll handler to improve performance
  const debouncedHandleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      handleScroll();
    }, finalConfig.scrollDebounceMs);
  }, [handleScroll, finalConfig.scrollDebounceMs]);
  
  // 🎮 Manual control over auto-scroll behavior
  const setAutoScrollEnabled = useCallback((enabled: boolean) => {
    setScrollState(prev => ({
      ...prev,
      shouldAutoScroll: enabled,
      isUserScrolling: !enabled
    }));
  }, []);
  
  // 📱 Set up scroll event listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // Add passive scroll listener for better performance
    container.addEventListener('scroll', debouncedHandleScroll, { passive: true });
    
    // 🧹 Cleanup function
    return () => {
      container.removeEventListener('scroll', debouncedHandleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, [debouncedHandleScroll]);
  
  // 🎯 Auto-scroll logic for new content
  // This effect runs when shouldAutoScroll changes to true
  useEffect(() => {
    if (scrollState.shouldAutoScroll && !scrollState.isUserScrolling) {
      // Small delay to ensure DOM has updated
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [scrollState.shouldAutoScroll, scrollState.isUserScrolling, scrollToBottom]);
  
  return {
    scrollContainerRef,
    bottomAnchorRef,
    scrollState,
    scrollToBottom,
    setAutoScrollEnabled,
    isNearBottom: scrollState.isNearBottom
  };
};

// 🎓 Educational Notes:
//
// 1. **Custom Hook Pattern**: This demonstrates how to create reusable logic
//    that multiple components can share. Great for complex state management!
//
// 2. **useCallback**: Used extensively to prevent unnecessary re-renders
//    and ensure stable function references for event listeners.
//
// 3. **useRef for DOM Access**: Shows how to access DOM elements directly
//    when you need to work with native browser APIs.
//
// 4. **Debouncing**: The scroll handler is debounced to improve performance
//    by limiting how often we process scroll events.
//
// 5. **User Intent Detection**: The hook intelligently detects when a user
//    is intentionally scrolling vs when the scroll is programmatic.
//
// 6. **State Management**: Complex state is managed with useState and
//    updated through careful effect dependencies.
//
// 7. **Cleanup**: Proper cleanup of event listeners and timers prevents
//    memory leaks and unexpected behavior.
//
// Usage Example:
// ```tsx
// const {
//   scrollContainerRef,
//   bottomAnchorRef,
//   isNearBottom
// } = useAutoScroll();
//
// return (
//   <div ref={scrollContainerRef} className="overflow-y-auto">
//     {messages.map(msg => <Message key={msg.id} {...msg} />)}
//     <div ref={bottomAnchorRef} />
//   </div>
// );
// ```
