// 🎯 LLM Configuration Utilities
// Helper functions for managing and displaying LLM configurations

import { LLMConfigurationSummary } from '../types/chat';

/**
 * 🏆 Sort LLM configurations by preference/popularity
 * 
 * Sorting priority:
 * 1. Active configurations first
 * 2. OpenAI models (most popular)
 * 3. Anthropic models (Claude)
 * 4. Other providers
 * 5. Alphabetical by model name within each group
 */
export const sortConfigsByModel = (configs: LLMConfigurationSummary[]): LLMConfigurationSummary[] => {
  return [...configs].sort((a, b) => {
    // 1. Active configurations first
    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;
    
    // 2. Provider preference (OpenAI > Anthropic > Others)
    const providerPriority = (config: LLMConfigurationSummary): number => {
      const provider = config.provider_name.toLowerCase();
      if (provider.includes('openai')) return 1;
      if (provider.includes('anthropic')) return 2;
      if (provider.includes('claude')) return 2;
      if (provider.includes('google')) return 3;
      if (provider.includes('cohere')) return 4;
      return 5; // Other providers
    };
    
    const aPriority = providerPriority(a);
    const bPriority = providerPriority(b);
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // 3. Model preference within same provider
    const modelPriority = (config: LLMConfigurationSummary): number => {
      if (!config.default_model) return 10; // Unknown models go last
      const model = config.default_model.toLowerCase();
      
      // OpenAI model preferences
      if (model.includes('gpt-4o')) return 1;
      if (model.includes('gpt-4') && model.includes('turbo')) return 2;
      if (model.includes('gpt-4')) return 3;
      if (model.includes('gpt-3.5')) return 4;
      
      // Anthropic model preferences (Claude 4 models are highest priority)
      if (model.includes('claude-opus-4')) return 1;
      if (model.includes('claude-sonnet-4')) return 2;
      if (model.includes('claude-3-7-sonnet')) return 3;
      if (model.includes('claude-3-5-sonnet')) return 4;
      if (model.includes('claude-3-opus')) return 5;
      if (model.includes('claude-3-5-haiku')) return 6;
      if (model.includes('claude-3-sonnet')) return 7;
      if (model.includes('claude-3-haiku')) return 8;
      if (model.includes('claude-instant')) return 9;
      if (model.includes('claude-2')) return 10;
      
      return 10; // Other models
    };
    
    const aModelPriority = modelPriority(a);
    const bModelPriority = modelPriority(b);
    
    if (aModelPriority !== bModelPriority) {
      return aModelPriority - bModelPriority;
    }
    
    // 4. Alphabetical by name as final tiebreaker
    return a.name.localeCompare(b.name);
  });
};

/**
 * 🏷️ Clean up model names for display
 * 
 * Examples:
 * - "gpt-4-turbo-preview" → "GPT-4 Turbo"
 * - "claude-3-opus-20240229" → "Claude 3 Opus"
 * - "gemini-pro" → "Gemini Pro"
 */
export const getCleanModelName = (config: LLMConfigurationSummary): string => {
  // 🔒 Safety check: ensure model name exists
  if (!config.default_model) {
    console.warn('⚠️ Missing default_model in config:', config);
    return config.name || 'Unknown Model';
  }
  
  const model = config.default_model.toLowerCase();
  
  // OpenAI models
  if (model.includes('gpt-4')) {
    if (model.includes('turbo')) return 'GPT-4 Turbo';
    if (model.includes('vision')) return 'GPT-4 Vision';
    return 'GPT-4';
  }
  
  if (model.includes('gpt-3.5')) {
    if (model.includes('turbo')) return 'GPT-3.5 Turbo';
    return 'GPT-3.5';
  }
  
  // Anthropic models
  if (model.includes('claude-3')) {
    if (model.includes('opus')) return 'Claude 3 Opus';
    if (model.includes('sonnet')) return 'Claude 3 Sonnet';
    if (model.includes('haiku')) return 'Claude 3 Haiku';
    return 'Claude 3';
  }
  
  if (model.includes('claude-2')) {
    return 'Claude 2';
  }
  
  // Google models
  if (model.includes('gemini')) {
    if (model.includes('pro')) return 'Gemini Pro';
    if (model.includes('ultra')) return 'Gemini Ultra';
    return 'Gemini';
  }
  
  // Cohere models
  if (model.includes('command')) {
    if (model.includes('light')) return 'Command Light';
    return 'Command';
  }
  
  // Fallback: Capitalize and clean up the original name
  return config.default_model
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/\d{8}/g, '') // Remove date stamps like "20240229"
    .trim();
};

/**
 * 🏢 Shorten provider names for compact display
 * 
 * Examples:
 * - "OpenAI API" → "OpenAI"
 * - "Anthropic Claude" → "Anthropic"
 * - "Google Vertex AI" → "Google"
 */
export const getShortProviderName = (providerName: string): string => {
  const provider = providerName.toLowerCase();
  
  if (provider.includes('openai')) return 'OpenAI';
  if (provider.includes('anthropic')) return 'Anthropic';
  if (provider.includes('google')) return 'Google';
  if (provider.includes('cohere')) return 'Cohere';
  if (provider.includes('hugging')) return 'HuggingFace';
  if (provider.includes('replicate')) return 'Replicate';
  if (provider.includes('azure')) return 'Azure';
  if (provider.includes('aws')) return 'AWS';
  
  // Fallback: Take first word and capitalize
  return providerName.split(' ')[0];
};

/**
 * 💰 Format cost for display
 * 
 * Examples:
 * - 0.001234 → "$0.0012"
 * - 0.05 → "$0.05"
 * - 1.234567 → "$1.23"
 */
export const formatCost = (cost: number): string => {
  if (cost < 0.01) {
    // For very small amounts, show more decimal places
    return `$${cost.toFixed(4)}`;
  } else if (cost < 1) {
    // For cents, show 2-3 decimal places
    return `$${cost.toFixed(3)}`;
  } else {
    // For dollars, show 2 decimal places
    return `$${cost.toFixed(2)}`;
  }
};

/**
 * 🎨 Get color for provider (for UI theming)
 */
export const getProviderColor = (providerName: string): string => {
  const provider = providerName.toLowerCase();
  
  if (provider.includes('openai')) return 'text-green-400';
  if (provider.includes('anthropic')) return 'text-orange-400';
  if (provider.includes('google')) return 'text-blue-400';
  if (provider.includes('cohere')) return 'text-purple-400';
  
  return 'text-gray-400'; // Default color
};

// 🎯 How these utilities work:
//
// 1. **sortConfigsByModel**: Intelligent sorting that puts the most 
//    useful/popular models first. Considers:
//    - Active status (active configs first)
//    - Provider popularity (OpenAI, then Anthropic, etc.)
//    - Model capability (GPT-4 > GPT-3.5, Claude Opus > Sonnet, etc.)
//
// 2. **getCleanModelName**: Makes technical model names user-friendly
//    by removing version numbers, technical suffixes, and standardizing
//    capitalization for better UX
//
// 3. **getShortProviderName**: Keeps provider names concise for mobile
//    interfaces while maintaining clarity
//
// 4. **Additional utilities**: Cost formatting and theming helpers
//    for a more polished interface
//
// These functions make the chat interface much more user-friendly!
