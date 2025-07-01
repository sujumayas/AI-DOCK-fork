// 🎣 Chat Hooks Index - Clean Exports
// Centralized exports for all chat-related custom hooks

export { useChatState } from './useChatState';
export { useModelSelection } from './useModelSelection';
export { useAssistantManager } from './useAssistantManager';
export { useConversationManager } from './useConversationManager';
export { useResponsiveLayout } from './useResponsiveLayout';
export { useSidebarState } from './useSidebarState';

// Re-export types for convenience
export type { 
  ChatStateConfig, 
  ChatStateActions, 
  ChatStateReturn 
} from './useChatState';

export type { 
  ModelSelectionState, 
  ModelSelectionActions, 
  ModelSelectionReturn 
} from './useModelSelection';

export type { 
  AssistantManagerState, 
  AssistantManagerActions, 
  AssistantManagerReturn 
} from './useAssistantManager';

export type { 
  ConversationManagerState, 
  ConversationManagerActions, 
  ConversationManagerReturn 
} from './useConversationManager';

export type { 
  ResponsiveLayoutState, 
  ResponsiveLayoutActions, 
  ResponsiveLayoutReturn 
} from './useResponsiveLayout';

export type { 
  SidebarState, 
  SidebarActions, 
  SidebarReturn, 
  SidebarMode 
} from './useSidebarState';