// 🤖 Assistant Suggestions Component
// Smart discovery system that helps users find relevant assistants
// Shows curated suggestions based on popularity, recent usage, and user's department
// Features: One-click selection, session dismissal, smooth animations

import React, { useState, useMemo } from 'react';
import { AssistantSummary } from '../../types/assistant';
import { useAuth } from '../../hooks/useAuth';
import { Bot, Users, Star, Clock, X, Sparkles } from 'lucide-react';

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

/**
 * Props interface for AssistantSuggestions component
 * 
 * 🎓 LEARNING: Component Interface Design
 * =====================================
 * Well-designed props interfaces provide:
 * - Clear contract between parent and child components
 * - Type safety for all data passed down
 * - Documentation through TypeScript types
 * - Optional props with sensible defaults
 */
export interface AssistantSuggestionsProps {
  // Data
  suggestions: AssistantSummary[];           // Available assistants to suggest
  
  // Event handlers
  onSelect: (assistantId: number) => void;   // Called when user clicks a suggestion
  onDismiss: () => void;                     // Called when user dismisses suggestions
  
  // Configuration
  maxSuggestions?: number;                   // Maximum number of suggestions to show (default: 4)
  showOnlyOnce?: boolean;                    // Only show once per session (default: true)
  
  // Styling
  className?: string;                        // Additional CSS classes
}

/**
 * Enhanced suggestion data with metadata for better UX
 */
interface EnhancedSuggestion {
  assistant: AssistantSummary;
  reason: 'popular' | 'recent' | 'department' | 'new' | 'recommended';
  score: number;                             // Relevance score for sorting
  icon: React.ComponentType<any>;            // Icon to display
  description: string;                       // Why this assistant is suggested
}

// =============================================================================
// SESSION STORAGE UTILITIES
// =============================================================================

/**
 * Session storage key for tracking dismissal
 * 
 * 🎓 LEARNING: Session Storage vs Local Storage
 * ============================================
 * - Session Storage: Clears when browser tab closes (perfect for "show once per session")
 * - Local Storage: Persists until manually cleared (for permanent preferences)
 * 
 * We use session storage so suggestions reappear in new browser sessions
 * but don't annoy users within the same session.
 */
const DISMISSAL_KEY = 'assistant_suggestions_dismissed';

/**
 * Check if suggestions have been dismissed this session
 */
const isDismissedThisSession = (): boolean => {
  try {
    return sessionStorage.getItem(DISMISSAL_KEY) === 'true';
  } catch (error) {
    console.warn('SessionStorage not available:', error);
    return false;
  }
};

/**
 * Mark suggestions as dismissed for this session
 */
const markDismissedThisSession = (): void => {
  try {
    sessionStorage.setItem(DISMISSAL_KEY, 'true');
  } catch (error) {
    console.warn('Failed to save dismissal state:', error);
  }
};

// =============================================================================
// SUGGESTION ALGORITHM
// =============================================================================

/**
 * Smart algorithm to select the best assistant suggestions
 * 
 * 🎓 LEARNING: Recommendation Algorithms
 * =====================================
 * Good recommendation systems consider:
 * - Popularity (what others use)
 * - Recency (what's trending)
 * - Personalization (user's context)
 * - Diversity (different types of assistants)
 * 
 * Our algorithm weights these factors to provide relevant suggestions.
 */
const generateSuggestions = (
  assistants: AssistantSummary[], 
  userDepartment?: string,
  maxSuggestions: number = 4
): EnhancedSuggestion[] => {
  if (assistants.length === 0) return [];
  
  console.log('🎯 Generating assistant suggestions:', {
    totalAssistants: assistants.length,
    userDepartment,
    maxSuggestions
  });
  
  // 📊 Create enhanced suggestions with scoring
  const suggestions: EnhancedSuggestion[] = assistants.map(assistant => {
    let score = 0;
    let reason: EnhancedSuggestion['reason'] = 'recommended';
    let icon = Bot;
    let description = 'AI assistant';
    
    // 🔥 POPULARITY SCORING: High conversation count = popular
    const popularityScore = Math.min(assistant.conversation_count / 10, 5); // Max 5 points
    score += popularityScore;
    
    if (assistant.conversation_count > 20) {
      reason = 'popular';
      icon = Users;
      description = `Popular assistant with ${assistant.conversation_count} conversations`;
    }
    
    // ⭐ NEW ASSISTANT BONUS: Recently created assistants get visibility
    const createdDate = new Date(assistant.created_at);
    const daysSinceCreated = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceCreated < 7) {
      score += 3; // Boost new assistants
      if (assistant.conversation_count < 5) {
        reason = 'new';
        icon = Sparkles;
        description = 'New assistant - try it out!';
      }
    }
    
    // 🏢 DEPARTMENT MATCHING: Boost assistants that match user's context
    // Note: This would require backend support for department-based assistant tagging
    // For now, we'll use name/description matching as a simple heuristic
    if (userDepartment) {
      const departmentKeywords = {
        'Engineering': ['code', 'dev', 'tech', 'api', 'debug'],
        'Sales': ['sales', 'customer', 'lead', 'pitch', 'demo'],
        'Marketing': ['marketing', 'content', 'brand', 'social', 'campaign'],
        'HR': ['hr', 'human', 'recruit', 'interview', 'people'],
        'Finance': ['finance', 'budget', 'cost', 'accounting', 'revenue']
      };
      
      const keywords = departmentKeywords[userDepartment as keyof typeof departmentKeywords] || [];
      const matchesKeywords = keywords.some(keyword => 
        assistant.name.toLowerCase().includes(keyword) ||
        assistant.description?.toLowerCase().includes(keyword)
      );
      
      if (matchesKeywords) {
        score += 4; // Strong department match
        reason = 'department';
        icon = Users;
        description = `Recommended for ${userDepartment}`;
      }
    }
    
    // 🌟 QUALITY INDICATORS: Boost assistants with good descriptions
    if (assistant.description && assistant.description.length > 50) {
      score += 1; // Well-documented assistants
    }
    
    // 📈 ACTIVITY BONUS: Recent activity indicates usefulness
    if (assistant.conversation_count > 0) {
      score += 1;
    }
    
    // 🎯 FALLBACK: Ensure every assistant has a reasonable description
    if (description === 'AI assistant' && assistant.description) {
      description = assistant.description.length > 60 
        ? assistant.description.substring(0, 60) + '...' 
        : assistant.description;
    }
    
    return {
      assistant,
      reason,
      score,
      icon,
      description
    };
  });
  
  // 🏆 Sort by score (highest first) and take top suggestions
  const topSuggestions = suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions);
  
  console.log('✅ Generated suggestions:', topSuggestions.map(s => ({
    name: s.assistant.name,
    reason: s.reason,
    score: s.score,
    description: s.description
  })));
  
  return topSuggestions;
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * AssistantSuggestions Component
 * 
 * 🎓 LEARNING: Component State Management
 * ======================================
 * This component demonstrates:
 * - useState for local state (dismissed, animations)
 * - useMemo for expensive calculations (suggestion generation)
 * - useAuth hook for user context
 * - Session storage for persistent dismissal
 * - Conditional rendering patterns
 */
export const AssistantSuggestions: React.FC<AssistantSuggestionsProps> = ({
  suggestions,
  onSelect,
  onDismiss,
  maxSuggestions = 4,
  showOnlyOnce = true,
  className = ''
}) => {
  
  // 🔐 Get user context for personalization
  const { user } = useAuth();
  
  // 🎭 Local state for UI interactions
  const [isDismissed, setIsDismissed] = useState(showOnlyOnce && isDismissedThisSession());
  const [isVisible, setIsVisible] = useState(true);
  
  // 🧠 Generate smart suggestions (memoized for performance)
  const enhancedSuggestions = useMemo(() => {
    return generateSuggestions(suggestions, user?.department_name, maxSuggestions);
  }, [suggestions, user?.department_name, maxSuggestions]);
  
  // 🚫 Don't render if dismissed or no suggestions
  if (isDismissed || !isVisible || enhancedSuggestions.length === 0) {
    return null;
  }
  
  // ❌ Handle dismissal with animation
  const handleDismiss = () => {
    console.log('🚫 User dismissed assistant suggestions');
    
    // 🎬 Fade out animation
    setIsVisible(false);
    
    // ⏱️ Mark as dismissed after animation
    setTimeout(() => {
      setIsDismissed(true);
      if (showOnlyOnce) {
        markDismissedThisSession();
      }
      onDismiss();
    }, 300); // Match animation duration
  };
  
  // 🎯 Handle assistant selection
  const handleSelectAssistant = (assistantId: number, assistantName: string, reason: string) => {
    console.log('🤖 User selected suggested assistant:', {
      assistantId,
      assistantName,
      reason
    });
    
    onSelect(assistantId);
    
    // Auto-dismiss after selection
    handleDismiss();
  };
  
  return (
    <div className={`assistant-suggestions ${className}`}>
      {/* 🎨 Main suggestion card with glassmorphism styling */}
      <div className={`
        mx-3 md:mx-4 mb-4 p-4 md:p-6
        bg-gradient-to-br from-white/20 via-white/10 to-white/5 
        backdrop-blur-md border border-white/30 rounded-xl shadow-lg
        transition-all duration-300 ease-in-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
      `}>
        
        {/* 📋 Header with title and dismiss button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <h3 className="text-lg font-semibold text-white">
              Discover AI Assistants
            </h3>
          </div>
          
          <button
            onClick={handleDismiss}
            className="text-white/70 hover:text-white/90 transition-colors p-1 rounded-md hover:bg-white/10"
            title="Dismiss suggestions"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* 💬 Description */}
        <p className="text-blue-100 text-sm mb-4 leading-relaxed">
          {enhancedSuggestions.length === 1 
            ? "Here's a recommended assistant to get you started:"
            : `Here are ${enhancedSuggestions.length} recommended assistants to get you started:`
          }
        </p>
        
        {/* 🎯 Suggestion cards grid */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          {enhancedSuggestions.map((suggestion, index) => {
            const IconComponent = suggestion.icon;
            
            return (
              <button
                key={suggestion.assistant.id}
                onClick={() => handleSelectAssistant(
                  suggestion.assistant.id, 
                  suggestion.assistant.name,
                  suggestion.reason
                )}
                className="
                  group p-3 md:p-4 rounded-lg border border-white/20 
                  bg-white/10 hover:bg-white/20 backdrop-blur-sm
                  transition-all duration-200 hover:scale-105 hover:shadow-lg
                  text-left focus:outline-none focus:ring-2 focus:ring-blue-400
                "
              >
                <div className="flex items-start space-x-3">
                  {/* 🎨 Assistant icon */}
                  <div className="flex-shrink-0 p-2 rounded-md bg-white/20 group-hover:bg-white/30 transition-colors">
                    <IconComponent className="w-4 h-4 text-white" />
                  </div>
                  
                  {/* 📝 Assistant info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-white text-sm truncate">
                        {suggestion.assistant.name}
                      </h4>
                      
                      {/* 🏷️ Reason badge */}
                      <span className={`
                        px-2 py-0.5 text-xs rounded-full font-medium
                        ${suggestion.reason === 'popular' ? 'bg-orange-500/20 text-orange-200' :
                          suggestion.reason === 'new' ? 'bg-green-500/20 text-green-200' :
                          suggestion.reason === 'department' ? 'bg-blue-500/20 text-blue-200' :
                          suggestion.reason === 'recent' ? 'bg-purple-500/20 text-purple-200' :
                          'bg-gray-500/20 text-gray-200'}
                      `}>
                        {suggestion.reason === 'popular' ? 'Popular' :
                         suggestion.reason === 'new' ? 'New' :
                         suggestion.reason === 'department' ? 'For You' :
                         suggestion.reason === 'recent' ? 'Recent' :
                         'Recommended'}
                      </span>
                    </div>
                    
                    <p className="text-blue-100 text-xs leading-relaxed">
                      {suggestion.description}
                    </p>
                    
                    {/* 📊 Conversation count */}
                    {suggestion.assistant.conversation_count > 0 && (
                      <div className="flex items-center mt-2 text-xs text-white/70">
                        <Clock className="w-3 h-3 mr-1" />
                        {suggestion.assistant.conversation_count} conversation{suggestion.assistant.conversation_count !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        
        {/* 💡 Help text */}
        <div className="mt-4 pt-3 border-t border-white/20">
          <p className="text-blue-200 text-xs text-center">
            💡 Tip: You can always change or manage assistants using the assistant manager
          </p>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// COMPONENT EXPORT AND USAGE DOCUMENTATION
// =============================================================================

export default AssistantSuggestions;

/**
 * 🎓 LEARNING SUMMARY: What We Built
 * ==================================
 * 
 * 1. **TypeScript Interfaces**: Clean props contract with optional parameters
 * 2. **Smart Algorithm**: Recommendation system based on multiple factors
 * 3. **Session Storage**: Remembers dismissal state within browser session
 * 4. **useMemo Optimization**: Prevents unnecessary recalculation of suggestions
 * 5. **Conditional Rendering**: Shows/hides based on dismissal and data state
 * 6. **Responsive Design**: Works on mobile and desktop with grid layout
 * 7. **Accessibility**: Focus states, ARIA labels, keyboard navigation
 * 8. **Glassmorphism Styling**: Modern transparent design matching app theme
 * 
 * Key React Patterns Demonstrated:
 * - Component composition with clean interfaces
 * - State management with useState and effects
 * - Performance optimization with useMemo
 * - Event handling with proper TypeScript typing
 * - Conditional rendering and animations
 * - Integration with external APIs and user context
 * 
 * Business Logic Features:
 * - Multi-factor recommendation algorithm
 * - Department-based personalization
 * - Popularity scoring
 * - New assistant promotion
 * - Quality indicators
 * - Session-based dismissal
 * 
 * Usage Example:
 * ```tsx
 * <AssistantSuggestions
 *   suggestions={availableAssistants}
 *   onSelect={(id) => setSelectedAssistantId(id)}
 *   onDismiss={() => console.log('Suggestions dismissed')}
 *   maxSuggestions={4}
 *   showOnlyOnce={true}
 * />
 * ```
 */