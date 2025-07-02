// 🎨 Model Display Helpers
// UI utilities for model information and formatting

/**
 * Model Display Helpers - convert model data to user-friendly formats
 * 🎓 Learning: Separation of display logic improves maintainability
 */
export class ModelHelpers {

  /**
   * Convert model IDs to user-friendly display names
   * 🎭 Make technical model names readable for users
   */
  getModelDisplayName(modelId: string): string {
    const displayNames: Record<string, string> = {
      // OpenAI Models
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4-turbo-preview': 'GPT-4 Turbo Preview',
      'gpt-4': 'GPT-4',
      'gpt-4-0613': 'GPT-4 (June 2023)',
      'gpt-4-32k': 'GPT-4 32K',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K',
      'gpt-3.5-turbo-0613': 'GPT-3.5 Turbo (June 2023)',
      
      // Claude 4 Models (Latest Generation) - Prioritize aliases
      'claude-opus-4-0': 'Claude Opus 4 (Latest)',
      'claude-sonnet-4-0': 'Claude Sonnet 4 (Latest)',
      'claude-opus-4-20250514': 'Claude Opus 4',
      'claude-sonnet-4-20250514': 'Claude Sonnet 4',
      
      // Claude 3.7 Models - Prioritize aliases
      'claude-3-7-sonnet-latest': 'Claude Sonnet 3.7 (Latest)',
      'claude-3-7-sonnet-20250219': 'Claude Sonnet 3.7',
      
      // Claude 3.5 Models - Prioritize aliases
      'claude-3-5-sonnet-latest': 'Claude 3.5 Sonnet (Latest)',
      'claude-3-5-haiku-latest': 'Claude 3.5 Haiku (Latest)',
      'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet v2',
      'claude-3-5-sonnet-20240620': 'Claude 3.5 Sonnet',
      'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
      
      // Claude 3 Models
      'claude-3-opus-20240229': 'Claude 3 Opus',
      'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
      'claude-3-haiku-20240307': 'Claude 3 Haiku'
    };
    
    return displayNames[modelId] || modelId;
  }
  
  /**
   * Get descriptive text for models
   * 📝 Helpful descriptions for user understanding
   */
  getModelDescription(modelId: string): string {
    const descriptions: Record<string, string> = {
      'gpt-4-turbo': 'Latest GPT-4 with improved performance and lower cost',
      'gpt-4': 'Most capable model, best for complex tasks',
      'gpt-3.5-turbo': 'Fast and efficient, great for most conversations',
      
      // Claude 4 Models - Prioritize aliases
      'claude-opus-4-0': 'Most capable model with automatic updates to latest version',
      'claude-sonnet-4-0': 'High-performance model with automatic updates to latest version',
      'claude-opus-4-20250514': 'Most capable and intelligent model yet. Sets new standards in complex reasoning and advanced coding',
      'claude-sonnet-4-20250514': 'High-performance model with exceptional reasoning and efficiency',
      
      // Claude 3.7 Models - Prioritize aliases
      'claude-3-7-sonnet-latest': 'Latest 3.7 model with extended thinking and automatic updates',
      'claude-3-7-sonnet-20250219': 'High-performance model with early extended thinking capabilities',
      
      // Claude 3.5 Models - Prioritize aliases
      'claude-3-5-sonnet-latest': 'Latest 3.5 Sonnet with automatic updates to newest version',
      'claude-3-5-haiku-latest': 'Latest fast model with automatic updates - blazing speed',
      'claude-3-5-sonnet-20241022': 'Advanced reasoning and analysis with enhanced capabilities',
      'claude-3-5-sonnet-20240620': 'High level of intelligence and capability',
      'claude-3-5-haiku-20241022': 'Intelligence at blazing speeds - fastest Claude model',
      
      // Claude 3 Models
      'claude-3-opus-20240229': 'Powerful model for complex tasks with top-level intelligence',
      'claude-3-sonnet-20240229': 'Balanced performance and speed',
      'claude-3-haiku-20240307': 'Fast and compact model for near-instant responsiveness'
    };
    
    return descriptions[modelId] || 'Advanced language model';
  }
  
  /**
   * Categorize models by cost tier
   * 💰 Help users understand cost implications
   */
  getModelCostTier(modelId: string): 'low' | 'medium' | 'high' {
    // High cost models (premium capabilities) - $15/MTok input or higher
    if (modelId.includes('claude-opus-4') || 
        modelId.includes('claude-3-opus') ||
        (modelId.includes('gpt-4') && !modelId.includes('mini'))) {
      return 'high';
    } 
    // Medium cost models (balanced performance) - $3/MTok input range
    else if (modelId.includes('claude-sonnet-4') ||
             modelId.includes('claude-3-7-sonnet') ||
             modelId.includes('claude-3-5-sonnet') ||
             modelId.includes('claude-3-sonnet') ||
             modelId.includes('turbo') ||
             modelId.includes('gpt-4o-mini')) {
      return 'medium';
    } 
    // Low cost models (efficient/basic) - under $1/MTok input
    else if (modelId.includes('claude-3-5-haiku') ||
             modelId.includes('claude-3-haiku') ||
             modelId.includes('gpt-3.5')) {
      return 'low';
    }
    else {
      return 'medium'; // Default fallback
    }
  }
  
  /**
   * Get model capabilities
   * 🛠️ What the model can do
   */
  getModelCapabilities(modelId: string): string[] {
    const capabilities: Record<string, string[]> = {
      // Claude 4 Models - Prioritize aliases
      'claude-opus-4-0': ['text', 'vision', 'extended-thinking', 'coding', 'reasoning', '200k-context', 'auto-updates'],
      'claude-sonnet-4-0': ['text', 'vision', 'extended-thinking', 'coding', 'reasoning', '200k-context', 'auto-updates'],
      'claude-opus-4-20250514': ['text', 'vision', 'extended-thinking', 'coding', 'reasoning', '200k-context'],
      'claude-sonnet-4-20250514': ['text', 'vision', 'extended-thinking', 'coding', 'reasoning', '200k-context'],
      
      // Claude 3.7 Models - Prioritize aliases
      'claude-3-7-sonnet-latest': ['text', 'vision', 'extended-thinking', 'coding', 'reasoning', '200k-context', 'auto-updates'],
      'claude-3-7-sonnet-20250219': ['text', 'vision', 'extended-thinking', 'coding', 'reasoning', '200k-context'],
      
      // Claude 3.5 Models - Prioritize aliases
      'claude-3-5-sonnet-latest': ['text', 'vision', 'coding', 'reasoning', '200k-context', 'auto-updates'],
      'claude-3-5-haiku-latest': ['text', 'vision', 'coding', 'fast-response', '200k-context', 'auto-updates'],
      'claude-3-5-sonnet-20241022': ['text', 'vision', 'coding', 'reasoning', '200k-context'],
      'claude-3-5-sonnet-20240620': ['text', 'vision', 'coding', 'reasoning', '200k-context'],
      'claude-3-5-haiku-20241022': ['text', 'vision', 'coding', 'fast-response', '200k-context'],
      
      // Claude 3 Models
      'claude-3-opus-20240229': ['text', 'vision', 'coding', 'reasoning', '200k-context'],
      'claude-3-sonnet-20240229': ['text', 'vision', 'coding', 'reasoning', '200k-context'],
      'claude-3-haiku-20240307': ['text', 'vision', 'coding', 'fast-response', '200k-context']
    };
    
    return capabilities[modelId] || ['text', 'general'];
  }
  
  /**
   * Check if model is recommended for general use
   * ⭐ Highlight the best models for most users
   */
  isModelRecommended(modelId: string): boolean {
    // Mark the best models as recommended - prioritize -latest aliases
    const recommended = [
      // Claude 4 models (latest and greatest - use aliases first)
      'claude-opus-4-0',             // Latest Claude Opus 4 (alias)
      'claude-sonnet-4-0',           // Latest Claude Sonnet 4 (alias)
      'claude-opus-4-20250514',      // Specific version fallback
      'claude-sonnet-4-20250514',    // Specific version fallback
      
      // Claude 3.7 (latest with extended thinking)
      'claude-3-7-sonnet-latest',    // Latest Claude 3.7 Sonnet (alias)
      'claude-3-7-sonnet-20250219',  // Specific version fallback
      
      // Claude 3.5 (current best - use aliases)
      'claude-3-5-sonnet-latest',    // Latest Claude 3.5 Sonnet (alias)
      'claude-3-5-haiku-latest',     // Latest Claude 3.5 Haiku (alias)
      
      // GPT models
      'gpt-4-turbo',
      'gpt-4o'
    ];
    
    return recommended.includes(modelId);
  }

  /**
   * Get cost tier display info with colors and icons
   * 🎨 Visual representation of cost tiers
   */
  getCostTierDisplay(tier: 'low' | 'medium' | 'high'): { 
    color: string; 
    icon: string; 
    label: string 
  } {
    const displays = {
      low: { 
        color: 'text-green-600', 
        icon: '💚', 
        label: 'Low Cost' 
      },
      medium: { 
        color: 'text-yellow-600', 
        icon: '💛', 
        label: 'Medium Cost' 
      },
      high: { 
        color: 'text-red-600', 
        icon: '💸', 
        label: 'High Cost' 
      }
    };
    
    return displays[tier];
  }

  /**
   * Get capability display info with icons
   * 🏷️ Visual representation of model capabilities
   */
  getCapabilityDisplay(capability: string): { 
    icon: string; 
    label: string;
    color: string;
  } {
    const displays: Record<string, { icon: string; label: string; color: string }> = {
      'reasoning': { icon: '🧠', label: 'Reasoning', color: 'bg-blue-100 text-blue-800' },
      'analysis': { icon: '📊', label: 'Analysis', color: 'bg-purple-100 text-purple-800' },
      'coding': { icon: '💻', label: 'Coding', color: 'bg-green-100 text-green-800' },
      'creative-writing': { icon: '✍️', label: 'Creative Writing', color: 'bg-pink-100 text-pink-800' },
      'conversation': { icon: '💬', label: 'Conversation', color: 'bg-gray-100 text-gray-800' },
      'writing': { icon: '📝', label: 'Writing', color: 'bg-indigo-100 text-indigo-800' },
      'basic-coding': { icon: '🔧', label: 'Basic Coding', color: 'bg-teal-100 text-teal-800' },
      'research': { icon: '🔍', label: 'Research', color: 'bg-orange-100 text-orange-800' },
      'quick-responses': { icon: '⚡', label: 'Quick Responses', color: 'bg-yellow-100 text-yellow-800' }
    };

    return displays[capability] || { 
      icon: '🤖', 
      label: capability, 
      color: 'bg-gray-100 text-gray-800' 
    };
  }
}

// Export singleton instance
export const modelHelpers = new ModelHelpers();
