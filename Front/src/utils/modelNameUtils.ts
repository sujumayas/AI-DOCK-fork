// 🏷️ Model Name Mapping Utility
// This utility converts technical model names to user-friendly display names

import { LLMConfigurationSummary } from '../types/chat';

/**
 * Maps technical model names to user-friendly display names
 * 
 * Learning: This demonstrates the concept of "data transformation" - taking
 * technical data (like "gpt-4-turbo-preview") and converting it to human-readable
 * format (like "GPT-4 Turbo"). This is a common pattern in UI development.
 */
const MODEL_NAME_MAPPINGS: Record<string, string> = {
  // OpenAI Models
  'gpt-4': 'GPT-4',
  'gpt-4-turbo': 'GPT-4 Turbo',
  'gpt-4-turbo-preview': 'GPT-4 Turbo Preview',
  'gpt-4-0125-preview': 'GPT-4 Turbo',
  'gpt-4-1106-preview': 'GPT-4 Turbo',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  'gpt-3.5-turbo-1106': 'GPT-3.5 Turbo',
  'gpt-3.5-turbo-0125': 'GPT-3.5 Turbo',
  
  // Anthropic Claude Models
  'claude-3-opus-20240229': 'Claude 3 Opus',
  'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
  'claude-3-haiku-20240307': 'Claude 3 Haiku',
  'claude-3-5-sonnet-20240620': 'Claude 3.5 Sonnet',
  'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
  'claude-2.1': 'Claude 2.1',
  'claude-2.0': 'Claude 2.0',
  'claude-instant-1.2': 'Claude Instant',
  
  // Google Gemini Models
  'gemini-pro': 'Gemini Pro',
  'gemini-pro-vision': 'Gemini Pro Vision',
  'gemini-ultra': 'Gemini Ultra',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
  'gemini-1.5-flash': 'Gemini 1.5 Flash',
  
  // Mistral Models
  'mistral-tiny': 'Mistral Tiny',
  'mistral-small': 'Mistral Small',
  'mistral-medium': 'Mistral Medium',
  'mistral-large': 'Mistral Large',
  'mixtral-8x7b': 'Mixtral 8x7B',
  'mixtral-8x22b': 'Mixtral 8x22B',
  
  // Cohere Models
  'command': 'Command',
  'command-light': 'Command Light',
  'command-nightly': 'Command Nightly',
  'command-r': 'Command R',
  'command-r-plus': 'Command R+',
};

/**
 * Converts a technical model name to a user-friendly display name
 * 
 * @param modelName - Technical model name (e.g., "gpt-4-turbo-preview")
 * @returns User-friendly display name (e.g., "GPT-4 Turbo Preview")
 */
export function getDisplayModelName(modelName: string): string {
  // Check if we have a specific mapping for this model
  if (MODEL_NAME_MAPPINGS[modelName]) {
    return MODEL_NAME_MAPPINGS[modelName];
  }
  
  // If no mapping found, try to create a reasonable display name
  // This handles new models that haven't been added to our mapping yet
  return createFallbackDisplayName(modelName);
}

/**
 * Creates a fallback display name for models not in our mapping
 * This function tries to make technical names more readable
 * 
 * @param modelName - Technical model name
 * @returns Best-guess user-friendly name
 */
function createFallbackDisplayName(modelName: string): string {
  // Handle common patterns and make them more readable
  let displayName = modelName;
  
  // Convert common abbreviations to proper case
  displayName = displayName.replace(/^gpt-/, 'GPT-');
  displayName = displayName.replace(/^claude-/, 'Claude ');
  displayName = displayName.replace(/^gemini-/, 'Gemini ');
  displayName = displayName.replace(/^mistral-/, 'Mistral ');
  displayName = displayName.replace(/^command-/, 'Command ');
  
  // Remove date stamps (like 20240229) but keep version numbers
  displayName = displayName.replace(/-\d{8}$/, '');
  
  // Convert dashes to spaces and title case
  displayName = displayName.replace(/-/g, ' ');
  displayName = displayName.replace(/\b\w/g, (char) => char.toUpperCase());
  
  return displayName;
}

/**
 * Gets a clean model name for display, prioritizing the model over the provider
 * This is the main function we'll use in the chat interface
 * 
 * @param config - LLM configuration object
 * @returns Clean model name for display
 */
export function getCleanModelName(config: LLMConfigurationSummary): string {
  return getDisplayModelName(config.default_model);
}

/**
 * Gets a shortened provider name for secondary display
 * Used when we want to show the provider subtly
 * 
 * @param providerName - Full provider name (e.g., "Anthropic (Claude)")
 * @returns Shortened provider name (e.g., "Anthropic")
 */
export function getShortProviderName(providerName: string): string {
  // Remove parenthetical information
  return providerName.replace(/\s*\([^)]*\)/, '');
}

/**
 * Creates a complete display string that emphasizes the model over the provider
 * 
 * @param config - LLM configuration object
 * @returns Display string like "GPT-4" or "Claude 3.5 Sonnet"
 */
export function getModelDisplayString(config: LLMConfigurationSummary): string {
  const modelName = getCleanModelName(config);
  
  // For most cases, just return the clean model name
  // This is what the user wants to see primarily
  return modelName;
}

/**
 * Creates a detailed description for tooltip or secondary information
 * 
 * @param config - LLM configuration object
 * @returns Detailed description like "GPT-4 via OpenAI"
 */
export function getModelTooltip(config: LLMConfigurationSummary): string {
  const modelName = getCleanModelName(config);
  const shortProvider = getShortProviderName(config.provider_name);
  
  return `${modelName} via ${shortProvider}`;
}

/**
 * Sorts configurations by model name for better user experience
 * Popular models like GPT-4 and Claude should appear first
 * 
 * @param configs - Array of LLM configurations
 * @returns Sorted array with most popular models first
 */
export function sortConfigsByModel(configs: LLMConfigurationSummary[]): LLMConfigurationSummary[] {
  // Define priority order for popular models
  const modelPriority: Record<string, number> = {
    'Claude Opus 4': 1,
    'Claude Sonnet 4': 2,
    'GPT-4': 3,
    'GPT-4 Turbo': 4,
    'Claude Sonnet 3.7': 5,
    'Claude 3.5 Sonnet': 6,
    'Claude 3 Opus': 7,
    'Claude 3.5 Haiku': 8,
    'Claude 3 Sonnet': 9,
    'Claude 3 Haiku': 10,
    'Gemini Pro': 11,
    'Gemini 1.5 Pro': 12,
    'Mistral Large': 13,
    'GPT-3.5 Turbo': 15, // Demoted to lower priority
  };
  
  return [...configs].sort((a, b) => {
    const aModel = getCleanModelName(a);
    const bModel = getCleanModelName(b);
    
    const aPriority = modelPriority[aModel] || 999;
    const bPriority = modelPriority[bModel] || 999;
    
    // If priorities are different, sort by priority
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // If same priority, sort alphabetically
    return aModel.localeCompare(bModel);
  });
}

// Example usage:
// const config = { default_model: "gpt-4-turbo-preview", provider_name: "OpenAI" };
// getCleanModelName(config) // Returns: "GPT-4 Turbo Preview"
// getModelTooltip(config)   // Returns: "GPT-4 Turbo Preview via OpenAI"