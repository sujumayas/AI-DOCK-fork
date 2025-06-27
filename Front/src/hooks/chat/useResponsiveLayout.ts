// 📱 Responsive Layout Management Hook
// Manages mobile/desktop layout states and breakpoint detection
// Extracted from ChatInterface.tsx for better modularity

import { useState, useEffect, useCallback } from 'react';

export interface ResponsiveLayoutState {
  isMobile: boolean;
  screenWidth: number;
  breakpoint: 'mobile' | 'tablet' | 'desktop';
}

export interface ResponsiveLayoutActions {
  checkScreenSize: () => void;
}

export interface ResponsiveLayoutReturn extends ResponsiveLayoutState, ResponsiveLayoutActions {}

// Breakpoint configuration
const BREAKPOINTS = {
  mobile: 768,    // < 768px = mobile
  tablet: 1024,   // 768px - 1024px = tablet
  desktop: 1024   // > 1024px = desktop
} as const;

export const useResponsiveLayout = (): ResponsiveLayoutReturn => {
  // 📱 Responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [screenWidth, setScreenWidth] = useState(0);
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  
  // 📱 Screen size detection
  const checkScreenSize = useCallback(() => {
    const width = window.innerWidth;
    const mobile = width < BREAKPOINTS.mobile;
    
    setIsMobile(mobile);
    setScreenWidth(width);
    
    // Determine breakpoint
    if (width < BREAKPOINTS.mobile) {
      setBreakpoint('mobile');
    } else if (width < BREAKPOINTS.desktop) {
      setBreakpoint('tablet');
    } else {
      setBreakpoint('desktop');
    }
    
    console.log('📱 Screen size updated:', {
      width,
      isMobile: mobile,
      breakpoint: width < BREAKPOINTS.mobile ? 'mobile' : width < BREAKPOINTS.desktop ? 'tablet' : 'desktop'
    });
  }, []);
  
  // Initialize and listen for resize events
  useEffect(() => {
    // Check initially
    checkScreenSize();
    
    // Listen for resize events
    window.addEventListener('resize', checkScreenSize);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkScreenSize);
  }, [checkScreenSize]);
  
  return {
    // State
    isMobile,
    screenWidth,
    breakpoint,
    
    // Actions
    checkScreenSize
  };
};