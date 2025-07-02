"""
Chat Model Service

Business logic for model management and processing in chat functionality.
Extracted from the main chat.py file for better modularity.
"""

import logging
from typing import List, Dict, Any

from ...schemas.chat_api.models import UnifiedModelInfo

logger = logging.getLogger(__name__)

# =============================================================================
# MODEL DISPLAY AND METADATA FUNCTIONS
# =============================================================================

def get_model_display_name(model_id: str) -> str:
    """Convert model ID to user-friendly display name."""
    display_names = {
        # OpenAI Models
        'gpt-4o': 'GPT-4o',
        'gpt-4o-mini': 'GPT-4o mini',
        'gpt-4-turbo': 'GPT-4 Turbo',
        'gpt-4-turbo-preview': 'GPT-4 Turbo Preview',
        'gpt-4': 'GPT-4',
        'gpt-4-0613': 'GPT-4 (June 2023)',
        'gpt-4-32k': 'GPT-4 32K',
        'gpt-3.5-turbo': 'GPT-3.5 Turbo',
        'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K',
        'gpt-3.5-turbo-0613': 'GPT-3.5 Turbo (June 2023)',
        'chatgpt-4o-latest': 'ChatGPT-4o Latest',
        
        # Claude 4 Models (latest generation)
        'claude-opus-4-0': 'Claude Opus 4',
        'claude-sonnet-4-0': 'Claude Sonnet 4',
        'claude-opus-4-20250514': 'Claude Opus 4',
        'claude-sonnet-4-20250514': 'Claude Sonnet 4',
        
        # Claude 3.7 Models (extended thinking)
        'claude-3-7-sonnet-latest': 'Claude 3.7 Sonnet',
        'claude-3-7-sonnet-20250219': 'Claude 3.7 Sonnet',
        
        # Claude 3.5 Models with aliases
        'claude-3-5-sonnet-latest': 'Claude 3.5 Sonnet',
        'claude-3-5-haiku-latest': 'Claude 3.5 Haiku',
        'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
        'claude-3-5-sonnet-20240620': 'Claude 3.5 Sonnet',
        'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
        
        # Claude 3 Models (previous generation)
        'claude-3-opus-20240229': 'Claude 3 Opus',
        'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
        'claude-3-haiku-20240307': 'Claude 3 Haiku',
        'claude-instant-1.2': 'Claude Instant',
        
        # Google Models
        'gemini-pro': 'Gemini Pro',
        'gemini-pro-vision': 'Gemini Pro Vision',
        'gemini-1.5-pro': 'Gemini 1.5 Pro',
        'gemini-1.5-flash': 'Gemini 1.5 Flash',
    }
    
    return display_names.get(model_id, model_id)

def get_model_cost_tier(model_id: str) -> str:
    """Determine cost tier for a model."""
    model_lower = model_id.lower()
    
    # High cost tier - Premium models ($15+ per MTok)
    if any(term in model_lower for term in ['claude-opus-4', 'claude-3-7-sonnet', 'gpt-4o', 'gpt-4', 'claude-3-opus', 'gemini-pro']):
        return 'high'
    # Medium cost tier - Standard models ($1-8 per MTok)  
    elif any(term in model_lower for term in ['claude-sonnet-4', 'claude-3-5-sonnet', 'claude-3-sonnet', 'turbo', 'flash', 'mini']):
        return 'medium'
    # Low cost tier - Economy models (<$1 per MTok)
    else:
        return 'low'

def get_model_capabilities(model_id: str) -> List[str]:
    """Get capabilities for a model."""
    model_lower = model_id.lower()
    capabilities = []
    
    # Claude 4 Models - Most advanced capabilities
    if 'claude-opus-4' in model_lower:
        capabilities.extend(['reasoning', 'analysis', 'coding', 'creative-writing', 'vision', '200k-context'])
    elif 'claude-sonnet-4' in model_lower:
        capabilities.extend(['reasoning', 'coding', 'analysis', 'vision', '200k-context'])
    
    # Claude 3.7 Models - Extended thinking
    elif 'claude-3-7-sonnet' in model_lower:
        capabilities.extend(['reasoning', 'analysis', 'coding', 'extended-thinking', '200k-context'])
    
    # Claude 3.5 Models
    elif 'claude-3-5-sonnet' in model_lower:
        capabilities.extend(['reasoning', 'coding', 'analysis', 'vision'])
    elif 'claude-3-5-haiku' in model_lower:
        capabilities.extend(['fast-response', 'coding', 'conversation'])
    
    # Claude 3 Models (previous generation)
    elif 'claude-3-opus' in model_lower:
        capabilities.extend(['reasoning', 'analysis', 'research', 'writing'])
    elif 'claude-3-sonnet' in model_lower:
        capabilities.extend(['conversation', 'writing', 'analysis'])
    elif 'claude-3-haiku' in model_lower:
        capabilities.extend(['conversation', 'fast-response'])
    elif 'claude-instant' in model_lower:
        capabilities.extend(['conversation', 'fast-response'])
    
    # GPT Models  
    elif 'gpt-4o' in model_lower:
        capabilities.extend(['reasoning', 'multimodal', 'coding', 'analysis'])
    elif 'gpt-4' in model_lower:
        capabilities.extend(['reasoning', 'analysis', 'coding', 'creative-writing'])
    elif 'gpt-3.5-turbo' in model_lower:
        capabilities.extend(['conversation', 'writing', 'basic-coding'])
    
    # Gemini Models
    elif 'gemini-1.5-pro' in model_lower:
        capabilities.extend(['reasoning', 'multimodal', 'coding'])
    elif 'gemini-1.5-flash' in model_lower:
        capabilities.extend(['fast-response', 'multimodal'])
    elif 'gemini-pro' in model_lower:
        capabilities.extend(['reasoning', 'conversation'])
    
    # Special capabilities for alias models
    if '-latest' in model_lower or '-0' in model_lower:
        capabilities.append('auto-updates')
    
    # Default fallback
    if not capabilities:
        capabilities = ['conversation']
    
    return capabilities

def is_model_recommended(model_id: str) -> bool:
    """Determine if a model should be recommended."""
    recommended_models = [
        # Latest Claude 4 models (highest priority - use aliases only)
        'claude-opus-4-0',
        'claude-sonnet-4-0', 
        
        # Claude 3.7 with extended thinking (use alias only)
        'claude-3-7-sonnet-latest',
        
        # Claude 3.5 latest aliases (only Haiku, removing Sonnet from essentials)
        'claude-3-5-haiku-latest',
        
        # OpenAI models (keeping existing recommendations)
        'gpt-4o',
        'gpt-4-turbo', 
        'gpt-3.5-turbo',
        
        # Claude 3 models (previous generation - keep best specific versions)
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        
        # Google models
        'gemini-1.5-pro',
        'gemini-1.5-flash'
    ]
    
    return model_id in recommended_models

def get_model_relevance_score(model_id: str) -> int:
    """Calculate relevance score for smart filtering (0-100)."""
    model_lower = model_id.lower()
    score = 50  # Base score
    
    # Latest/flagship models get highest scores - PRIORITIZE ALIASES
    if 'claude-opus-4' in model_lower:
        if '-0' in model_lower:  # claude-opus-4-0 (alias)
            score = 100  # Highest priority - alias
        else:  # claude-opus-4-20250514 (specific version)
            score = 75   # Lower priority - specific version
    elif 'claude-sonnet-4' in model_lower:
        if '-0' in model_lower:  # claude-sonnet-4-0 (alias)
            score = 98   # Very high priority - alias
        else:  # claude-sonnet-4-20250514 (specific version)
            score = 73   # Lower priority - specific version
    elif 'claude-3-7-sonnet' in model_lower:
        if '-latest' in model_lower:  # claude-3-7-sonnet-latest (alias)
            score = 96   # Extended thinking capabilities - alias
        else:  # claude-3-7-sonnet-20250219 (specific version)
            score = 71   # Lower priority - specific version
    elif 'claude-3-5-sonnet' in model_lower:
        if '-latest' in model_lower:  # claude-3-5-sonnet-latest (alias)
            score = 92   # Current generation best - alias
        else:  # claude-3-5-sonnet-20241022, etc. (specific versions)
            score = 68   # Lower priority - specific versions
    elif 'claude-3-5-haiku' in model_lower:
        if '-latest' in model_lower:  # claude-3-5-haiku-latest (alias)
            score = 88   # Fast and efficient - alias
        else:  # claude-3-5-haiku-20241022 (specific version)
            score = 64   # Lower priority - specific version
    elif 'gpt-4o' in model_lower:
        score = 95   # OpenAI flagship
    elif 'gpt-4-turbo' in model_lower:
        score = 85
    elif 'gpt-4' in model_lower and 'turbo' not in model_lower:
        score = 80
    elif 'claude-3-opus' in model_lower:
        score = 82   # Previous gen flagship
    elif 'claude-3-sonnet' in model_lower:
        score = 75
    elif 'claude-3-haiku' in model_lower:
        score = 70
    elif 'gemini-1.5' in model_lower:
        score = 70
    elif 'gpt-3.5-turbo' in model_lower:
        score = 65
    
    # NO additional boost for aliases here since it's handled above
    
    # Adjust for specific variants
    if 'mini' in model_lower:
        score += 3  # Mini models are efficient
    elif '32k' in model_lower:
        score -= 10  # Older large context models
    elif any(date in model_lower for date in ['0613', '0314']):
        score -= 15  # Older dated models
    
    return max(0, min(100, score))

# =============================================================================
# MODEL DEDUPLICATION AND FILTERING FUNCTIONS
# =============================================================================

def deduplicate_and_filter_models(models: List[UnifiedModelInfo]) -> List[UnifiedModelInfo]:
    """
    🧠 Smart deduplication to fix the "3 GPT Turbos, 4 GPT 4os" problem.
    
    This function intelligently groups similar models and selects the best variant
    from each group, dramatically improving the user experience.
    """
    
    # Group models by base name (e.g., all GPT-4 variants together)
    model_groups = {}
    
    for model in models:
        # Extract base model name for grouping
        base_name = extract_base_model_name(model.id)
        
        if base_name not in model_groups:
            model_groups[base_name] = []
        model_groups[base_name].append(model)
    
    # Select best model from each group
    deduplicated_models = []
    
    for base_name, group_models in model_groups.items():
        if len(group_models) == 1:
            # No duplicates, keep the model
            deduplicated_models.extend(group_models)
        else:
            # Multiple variants - select the best one
            best_model = select_best_model_variant(group_models)
            deduplicated_models.append(best_model)
            
            logger.info(f"Deduplicated {len(group_models)} variants of {base_name}, selected: {best_model.id}")
    
    return deduplicated_models

def extract_base_model_name(model_id: str) -> str:
    """Extract base model name for grouping similar models."""
    model_lower = model_id.lower()
    
    # GPT models
    if 'gpt-4o' in model_lower:
        return 'gpt-4o'
    elif 'gpt-4-turbo' in model_lower:
        return 'gpt-4-turbo'
    elif 'gpt-4' in model_lower:
        return 'gpt-4'
    elif 'gpt-3.5' in model_lower:
        return 'gpt-3.5-turbo'
    elif 'chatgpt' in model_lower:
        return 'chatgpt'
    
    # Claude 4 models
    elif 'claude-opus-4' in model_lower:
        return 'claude-opus-4'
    elif 'claude-sonnet-4' in model_lower:
        return 'claude-sonnet-4'
    
    # Claude 3.7 models  
    elif 'claude-3-7-sonnet' in model_lower:
        return 'claude-3.7-sonnet'
    
    # Claude 3.5 models
    elif 'claude-3-5-sonnet' in model_lower:
        return 'claude-3.5-sonnet'
    elif 'claude-3-5-haiku' in model_lower:
        return 'claude-3.5-haiku'
    
    # Claude 3 models
    elif 'claude-3-opus' in model_lower:
        return 'claude-3-opus'
    elif 'claude-3-sonnet' in model_lower:
        return 'claude-3-sonnet'
    elif 'claude-3-haiku' in model_lower:
        return 'claude-3-haiku'
    elif 'claude-instant' in model_lower:
        return 'claude-instant'
    
    # Gemini models
    elif 'gemini-1.5-pro' in model_lower:
        return 'gemini-1.5-pro'
    elif 'gemini-1.5-flash' in model_lower:
        return 'gemini-1.5-flash'
    elif 'gemini-pro' in model_lower:
        return 'gemini-pro'
    
    # Default: return the model ID as-is
    return model_id

def select_best_model_variant(models: List[UnifiedModelInfo]) -> UnifiedModelInfo:
    """
    Select the best variant from a group of similar models.
    
    Priority order:
    1. Highest relevance score
    2. Is recommended
    3. Is default
    4. Shortest/cleanest name (indicates canonical version)
    """
    
    return max(models, key=lambda m: (
        m.relevance_score if m.relevance_score else 0,  # Higher relevance first
        1 if m.is_recommended else 0,                   # Recommended first
        1 if m.is_default else 0,                       # Default first
        -len(m.id),                                     # Shorter names first (canonical)
        -ord(m.id[0]) if m.id else 0                    # Alphabetical tie-breaker
    ))

# =============================================================================
# MODEL CREATION HELPER FUNCTIONS  
# =============================================================================

def create_unified_model_info(
    model_id: str,
    provider: str,
    config_id: int,
    config_name: str,
    is_default: bool = False
) -> UnifiedModelInfo:
    """
    Create a UnifiedModelInfo object with all metadata populated.
    
    Args:
        model_id: The model identifier
        provider: Provider name
        config_id: Configuration ID
        config_name: Configuration name
        is_default: Whether this is the default model
        
    Returns:
        UnifiedModelInfo object with all fields populated
    """
    return UnifiedModelInfo(
        id=model_id,
        display_name=get_model_display_name(model_id),
        provider=provider,
        config_id=config_id,
        config_name=config_name,
        is_default=is_default,
        cost_tier=get_model_cost_tier(model_id),
        capabilities=get_model_capabilities(model_id),
        is_recommended=is_model_recommended(model_id),
        relevance_score=get_model_relevance_score(model_id)
    )
