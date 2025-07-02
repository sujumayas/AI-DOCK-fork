// 🎛️ Unified Sidebar State Management Hook
// Manages the new left-side sidebar that toggles between conversations, projects/folders, and assistants
// Replaces the old separate conversation and project sidebar states

import { useState, useCallback } from 'react';

export type SidebarMode = 'conversations' | 'projects' | 'assistants';

export interface SidebarState {
  isOpen: boolean;
  mode: SidebarMode;
}

export interface SidebarActions {
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  toggleMode: () => void;
}

export type SidebarReturn = SidebarState & SidebarActions;

export const useSidebarState = (
  initialMode: SidebarMode = 'conversations',
  initialOpen: boolean = false
): SidebarReturn => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [mode, setMode] = useState<SidebarMode>(initialMode);

  const toggleSidebar = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const setSidebarOpen = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  const setSidebarMode = useCallback((newMode: SidebarMode) => {
    setMode(newMode);
    // When switching modes, ensure sidebar is open
    if (!isOpen) {
      setIsOpen(true);
    }
  }, [isOpen]);

  const toggleMode = useCallback(() => {
    setMode(prev => {
      switch (prev) {
        case 'conversations':
          return 'projects';
        case 'projects':
          return 'assistants';
        case 'assistants':
          return 'conversations';
        default:
          return 'conversations';
      }
    });
    // Ensure sidebar is open when toggling modes
    if (!isOpen) {
      setIsOpen(true);
    }
  }, [isOpen]);

  return {
    isOpen,
    mode,
    toggleSidebar,
    setSidebarOpen,
    setSidebarMode,
    toggleMode
  };
}; 