// 🧠 Smart Model Filter Utility
// Intelligent filtering and ranking of LLM models for better UX
// 🎓 Learning Goal: Advanced data filtering, sorting algorithms, and UX optimization

/**
 * Configuration for smart model filtering
 * 🎓 Concept: Configuration objects provide flexibility without code changes
 */
export interface SmartFilterConfig {
  showAllModels?: boolean;       // Admin override - bypass all filtering
  includeExperimental?: boolean; // Include preview/experimental models
  includeLegacy?: boolean;       // Include older model versions
  maxResults?: number;           // Limit number of results shown
  sortBy?: 'relevance' | 'name' | 'date' | 'cost'; // Sorting preference
  userRole?: 'user' | 'admin';   // User role affects available options
}

/**
 * Enhanced model information after smart processing
 * 🎓 Concept: Extending basic data with computed properties
 */
export interface SmartModelInfo {
  id: string;                    // Original model ID
  displayName: string;           // User-friendly name
  description: string;           // Model description
  relevanceScore: number;        // Computed relevance score (0-100)
  costTier: 'low' | 'medium' | 'high'; // Cost categorization
  capabilities: string[];        // What this model is good at
  isRecommended: boolean;        // Highlighted as recommended
  isDefault: boolean;           // Default for this provider
  isExperimental: boolean;      // Preview/beta model
  isLegacy: boolean;           // Older version
  provider: string;            // Provider name (OpenAI, Anthropic, etc.)
  category: 'flagship' | 'efficient' | 'specialized' | 'legacy'; // Model category
}

/**
 * Model relevance scoring system
 * 🎓 Concept: Weighted scoring allows fine-tuned prioritization
 */
const MODEL_PRIORITY_SCORES: Record<string, number> = {
  // 🏆 Flagship Models (90-100 points)
  'gpt-4o': 100,                    // Latest and greatest
  'gpt-4-turbo': 95,               // Powerful and fast
  'gpt-4': 90,                     // Proven and reliable
  
  // 🚀 High-Performance Models (80-89 points)
  'claude-3-5-sonnet': 88,
  'claude-3-opus': 85,
  'gemini-1.5-pro': 82,
  'gpt-3.5-turbo': 80,
  
  // ⚡ Efficient Models (70-79 points)
  'claude-3-haiku': 75,
  'gemini-1.5-flash': 72,
  'gpt-3.5-turbo-16k': 70,
  
  // 🎯 Specialized Models (60-69 points)
  'dall-e-3': 65,
  'whisper-1': 62,
  'text-embedding-3-large': 60,
  
  // 🔬 Experimental/Preview (40-59 points)
  'gpt-4-turbo-preview': 55,
  'gpt-4-vision-preview': 52,
  
  // 📚 Legacy Models (20-39 points)
  'gpt-3.5-turbo-instruct': 35,
  'text-davinci-003': 30,
  'code-davinci-002': 25,
  
  // 🗑️ Deprecated (0-19 points)
  'text-curie-001': 15,
  'text-babbage-001': 10,
  'text-ada-001': 5,
};

/**
 * Patterns for models that should be filtered out by default
 * 🎓 Concept: Regex patterns provide flexible string matching
 */
const EXCLUDE_PATTERNS = [
  // Old similarity and search models
  /^text-similarity-/,
  /^text-search-/,
  /^code-search-/,
  
  // Deprecated edit models
  /^text-edit-/,
  /^code-edit-/,
  
  // Very old specific versions
  /-0301$/,                        // March 2023 versions
  /-0314$/,                        // March 2023 versions
  /^(ada|babbage|curie|davinci)$/, // Legacy base models
  
  // Internal/test models
  /^test-/,
  /^internal-/,
  /-test$/,
  
  // Old instruct versions
  /-instruct-0914$/,
];

/**
 * Calculate relevance score for a model
 * 🎓 Concept: Multi-factor scoring considers various quality indicators
 */
function calculateRelevanceScore(modelId: string): number {
  const modelLower = modelId.toLowerCase();
  let score = 0;
  
  // Step 1: Base score from priority mapping
  for (const [pattern, points] of Object.entries(MODEL_PRIORITY_SCORES)) {
    if (modelLower.includes(pattern.toLowerCase())) {
      score = Math.max(score, points);
    }
  }
  
  // Step 2: Pattern-based scoring
  if (modelLower.includes('gpt-4o')) {
    score = Math.max(score, 95);
  } else if (modelLower.includes('gpt-4')) {
    score = Math.max(score, 85);
  } else if (modelLower.includes('claude-3')) {
    score = Math.max(score, 80);
  } else if (modelLower.includes('gemini')) {
    score = Math.max(score, 75);
  }
  
  // Step 3: Quality indicators boost score
  if (modelLower.includes('turbo')) score += 10;      // Usually better/faster
  if (modelLower.includes('2024')) score += 8;        // Recent models
  if (modelLower.includes('2023')) score += 5;        // Somewhat recent
  if (modelLower.includes('preview')) score += 3;     // Cutting edge
  if (modelLower.includes('vision')) score += 5;      // Multimodal capability
  
  // Step 4: Negative indicators reduce score
  if (modelLower.includes('instruct')) score -= 15;   // Usually older pattern
  if (modelLower.includes('-001') || modelLower.includes('-002')) score -= 10;
  if (modelLower.includes('davinci') && !modelLower.includes('003')) score -= 20;
  
  return Math.max(0, Math.min(100, score)); // Clamp between 0-100
}

/**
 * Determine if a model should be excluded based on patterns
 * 🎓 Concept: Pattern matching for automated filtering decisions
 */
function shouldExcludeModel(modelId: string, config: SmartFilterConfig): boolean {
  // Admin override - show everything
  if (config.showAllModels) {
    return false;
  }
  
  const modelLower = modelId.toLowerCase();
  
  // Check against exclusion patterns
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(modelLower)) {
      // Some exceptions based on config
      if (modelLower.includes('instruct') && config.includeExperimental) {
        continue; // Allow experimental models to include instruct
      }
      return true;
    }
  }
  
  // Filter very low relevance models unless legacy is enabled
  const relevanceScore = calculateRelevanceScore(modelId);
  if (!config.includeLegacy && relevanceScore < 20) {
    return true;
  }
  
  return false;
}

/**
 * Categorize model based on its characteristics
 * 🎓 Concept: Classification helps users understand model purposes
 */
function categorizeModel(modelId: string, relevanceScore: number): SmartModelInfo['category'] {
  const modelLower = modelId.toLowerCase();
  
  if (relevanceScore >= 90) return 'flagship';
  if (relevanceScore >= 70) return 'efficient';
  if (relevanceScore >= 40) return 'specialized';
  return 'legacy';
}

/**
 * Determine if model is experimental/preview
 * 🎓 Concept: Feature detection from naming patterns
 */
function isExperimentalModel(modelId: string): boolean {
  const modelLower = modelId.toLowerCase();
  return modelLower.includes('preview') || 
         modelLower.includes('beta') || 
         modelLower.includes('alpha') ||
         modelLower.includes('experimental');
}

/**
 * Determine if model is legacy/deprecated
 * 🎓 Concept: Automated classification based on age and patterns
 */
function isLegacyModel(modelId: string, relevanceScore: number): boolean {
  const modelLower = modelId.toLowerCase();
  
  // Explicit legacy patterns
  if (modelLower.includes('davinci') || 
      modelLower.includes('curie') || 
      modelLower.includes('babbage') || 
      modelLower.includes('ada')) {
    return true;
  }
  
  // Low relevance scores indicate legacy status
  return relevanceScore < 40;
}

/**
 * Get enhanced capabilities for a model
 * 🎓 Concept: Knowledge base approach for model metadata
 */
function getModelCapabilities(modelId: string): string[] {
  const modelLower = modelId.toLowerCase();
  const capabilities: string[] = [];
  
  // Core capabilities based on model type
  if (modelLower.includes('gpt-4')) {
    capabilities.push('reasoning', 'analysis', 'coding', 'creative-writing');
  } else if (modelLower.includes('gpt-3.5')) {
    capabilities.push('conversation', 'writing', 'basic-coding');
  } else if (modelLower.includes('claude-3-opus')) {
    capabilities.push('reasoning', 'analysis', 'research', 'complex-tasks');
  } else if (modelLower.includes('claude-3-sonnet')) {
    capabilities.push('conversation', 'writing', 'analysis', 'coding');
  } else if (modelLower.includes('claude-3-haiku')) {
    capabilities.push('conversation', 'quick-responses', 'efficient');
  } else if (modelLower.includes('gemini')) {
    capabilities.push('multimodal', 'reasoning', 'conversation');
  }
  
  // Special capabilities
  if (modelLower.includes('vision')) capabilities.push('image-analysis');
  if (modelLower.includes('dall-e')) capabilities.push('image-generation');
  if (modelLower.includes('whisper')) capabilities.push('speech-to-text');
  if (modelLower.includes('embedding')) capabilities.push('text-embedding');
  if (modelLower.includes('turbo')) capabilities.push('fast-response');
  if (modelLower.includes('32k') || modelLower.includes('16k')) capabilities.push('long-context');
  
  return capabilities.length > 0 ? capabilities : ['conversation'];
}

/**
 * Get cost tier based on model characteristics
 * 🎓 Concept: Cost-aware UX helps users make informed decisions
 */
function getModelCostTier(modelId: string): 'low' | 'medium' | 'high' {
  const modelLower = modelId.toLowerCase();
  
  // High cost models
  if (modelLower.includes('gpt-4') || 
      modelLower.includes('claude-3-opus') || 
      modelLower.includes('gemini-ultra')) {
    return 'high';
  }
  
  // Medium cost models
  if (modelLower.includes('gpt-3.5-turbo') || 
      modelLower.includes('claude-3-sonnet') || 
      modelLower.includes('gemini-pro')) {
    return 'medium';
  }
  
  // Low cost models
  return 'low';
}

/**
 * Enhanced model display name with smart formatting
 * 🎓 Concept: Builds on existing modelNameUtils but adds intelligence
 */
function getSmartDisplayName(modelId: string): string {
  // Handle common patterns more intelligently
  let displayName = modelId;
  
  // OpenAI models
  if (displayName.startsWith('gpt-')) {
    displayName = displayName.replace(/^gpt-/, 'GPT-');
    displayName = displayName.replace(/-turbo-preview$/, ' Turbo Preview');
    displayName = displayName.replace(/-turbo$/, ' Turbo');
    displayName = displayName.replace(/-vision-preview$/, ' Vision Preview');
    
    // Remove date stamps for cleaner display
    displayName = displayName.replace(/-\d{4}-\d{2}-\d{2}$/, '');
    displayName = displayName.replace(/-\d{8}$/, '');
  }
  
  // Claude models
  if (displayName.startsWith('claude-')) {
    displayName = displayName.replace(/^claude-/, 'Claude ');
    displayName = displayName.replace(/-20\d{6}$/, ''); // Remove date stamps
  }
  
  // Gemini models
  if (displayName.startsWith('gemini-')) {
    displayName = displayName.replace(/^gemini-/, 'Gemini ');
    displayName = displayName.replace(/-/g, ' ');
  }
  
  // Final cleanup
  displayName = displayName.replace(/-/g, ' ');
  displayName = displayName.replace(/\b\w/g, char => char.toUpperCase());
  
  return displayName;
}

/**
 * Main smart filtering function
 * 🎓 Concept: Orchestration function that combines all filtering logic
 */
export function applySmartModelFiltering(
  modelIds: string[], 
  provider: string = 'Unknown',
  config: SmartFilterConfig = {}
): SmartModelInfo[] {
  // Set defaults
  const finalConfig: Required<SmartFilterConfig> = {
    showAllModels: false,
    includeExperimental: false,
    includeLegacy: false,
    maxResults: 20,
    sortBy: 'relevance',
    userRole: 'user',
    ...config,
  };
  
  console.log('🧠 Applying smart model filtering:', {
    totalModels: modelIds.length,
    config: finalConfig,
    provider
  });
  
  // Step 1: Filter out unwanted models
  let filteredModelIds = modelIds.filter(modelId => 
    !shouldExcludeModel(modelId, finalConfig)
  );
  
  // Step 2: Convert to enhanced model info
  let smartModels: SmartModelInfo[] = filteredModelIds.map(modelId => {
    const relevanceScore = calculateRelevanceScore(modelId);
    const category = categorizeModel(modelId, relevanceScore);
    const isExperimental = isExperimentalModel(modelId);
    const isLegacy = isLegacyModel(modelId, relevanceScore);
    
    return {
      id: modelId,
      displayName: getSmartDisplayName(modelId),
      description: `${category.charAt(0).toUpperCase() + category.slice(1)} model from ${provider}`,
      relevanceScore,
      costTier: getModelCostTier(modelId),
      capabilities: getModelCapabilities(modelId),
      isRecommended: relevanceScore >= 80 && !isLegacy,
      isDefault: false, // Will be set externally
      isExperimental,
      isLegacy,
      provider,
      category,
    };
  });
  
  // Step 3: Filter by experimental and legacy preferences
  if (!finalConfig.includeExperimental) {
    smartModels = smartModels.filter(m => !m.isExperimental);
  }
  
  if (!finalConfig.includeLegacy) {
    smartModels = smartModels.filter(m => !m.isLegacy);
  }
  
  // Step 4: Sort by preference
  smartModels.sort((a, b) => {
    switch (finalConfig.sortBy) {
      case 'name':
        return a.displayName.localeCompare(b.displayName);
        
      case 'cost':
        const costOrder = { low: 0, medium: 1, high: 2 };
        return costOrder[a.costTier] - costOrder[b.costTier];
        
      case 'relevance':
      default:
        // Primary sort: relevance score
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        // Secondary sort: alphabetical
        return a.displayName.localeCompare(b.displayName);
    }
  });
  
  // Step 5: Limit results
  if (finalConfig.maxResults > 0) {
    smartModels = smartModels.slice(0, finalConfig.maxResults);
  }
  
  console.log('🧠 Smart filtering complete:', {
    originalCount: modelIds.length,
    filteredCount: smartModels.length,
    recommended: smartModels.filter(m => m.isRecommended).length,
    avgRelevance: Math.round(smartModels.reduce((sum, m) => sum + m.relevanceScore, 0) / smartModels.length)
  });
  
  return smartModels;
}

/**
 * Get recommended models by category
 * 🎓 Concept: Preset groupings reduce cognitive load for users
 */
export function getRecommendedModelsByCategory(models: SmartModelInfo[]): {
  flagship: SmartModelInfo[];
  efficient: SmartModelInfo[];
  specialized: SmartModelInfo[];
} {
  return {
    flagship: models.filter(m => m.category === 'flagship').slice(0, 3),
    efficient: models.filter(m => m.category === 'efficient').slice(0, 3),
    specialized: models.filter(m => m.category === 'specialized').slice(0, 3),
  };
}

/**
 * Debug function to analyze filtering decisions
 * 🎓 Concept: Debugging tools help understand complex algorithms
 */
export function debugModelFiltering(
  originalModels: string[], 
  filteredModels: SmartModelInfo[]
): {
  summary: {
    total: number;
    filtered: number;
    excluded: number;
    avgRelevance: number;
  };
  excluded: string[];
  topModels: { id: string; score: number; reason: string }[];
} {
  const excluded = originalModels.filter(id => 
    !filteredModels.find(m => m.id === id)
  );
  
  const avgRelevance = filteredModels.length > 0 
    ? Math.round(filteredModels.reduce((sum, m) => sum + m.relevanceScore, 0) / filteredModels.length)
    : 0;
  
  const topModels = filteredModels
    .slice(0, 5)
    .map(m => ({
      id: m.id,
      score: m.relevanceScore,
      reason: m.isRecommended ? 'High relevance + recommended' : 'Good relevance score'
    }));
  
  return {
    summary: {
      total: originalModels.length,
      filtered: filteredModels.length,
      excluded: excluded.length,
      avgRelevance,
    },
    excluded,
    topModels,
  };
}
