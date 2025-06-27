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
      
      // Claude Models
      'claude-3-opus-20240229': 'Claude 3 Opus',
      'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
      'claude-3-haiku-20240307': 'Claude 3 Haiku',
      'claude-3-5-sonnet-20240620': 'Claude 3.5 Sonnet'
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
      'claude-3-opus-20240229': 'Most powerful Claude model for complex tasks',
      'claude-3-sonnet-20240229': 'Balanced performance and speed',
      'claude-3-haiku-20240307': 'Fastest Claude model for quick responses'
    };
    
    return descriptions[modelId] || 'Advanced language model';
  }
  
  /**
   * Categorize models by cost tier
   * 💰 Help users understand cost implications
   */
  getModelCostTier(modelId: string): 'low' | 'medium' | 'high' {
    if (modelId.includes('gpt-4') || modelId.includes('opus')) {
      return 'high';
    } else if (modelId.includes('turbo') || modelId.includes('sonnet')) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  /**
   * List model capabilities
   * 🔧 Show what each model is good at
   */
  getModelCapabilities(modelId: string): string[] {
    const capabilities: Record<string, string[]> = {
      'gpt-4-turbo': ['reasoning', 'analysis', 'coding', 'creative-writing'],
      'gpt-4': ['reasoning', 'analysis', 'coding', 'creative-writing'],
      'gpt-3.5-turbo': ['conversation', 'writing', 'basic-coding'],
      'claude-3-opus-20240229': ['reasoning', 'analysis', 'coding', 'research'],
      'claude-3-sonnet-20240229': ['conversation', 'writing', 'analysis'],
      'claude-3-haiku-20240307': ['conversation', 'quick-responses']
    };
    
    return capabilities[modelId] || ['conversation'];
  }
  
  /**
   * Check if model is recommended for general use
   * ⭐ Highlight the best models for most users
   */
  isModelRecommended(modelId: string): boolean {
    // Mark certain models as recommended for different use cases
    const recommended = [
      'gpt-4-turbo',
      'gpt-3.5-turbo', 
      'claude-3-sonnet-20240229'
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
