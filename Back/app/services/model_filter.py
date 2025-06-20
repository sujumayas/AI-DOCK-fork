# AI Dock Model Filtering System
# This module provides intelligent filtering for LLM models to show only relevant ones

import re
from enum import Enum
from typing import List, Tuple, Dict, Any
import logging

logger = logging.getLogger(__name__)

class ModelFilterLevel(Enum):
    """
    Different levels of model filtering.
    
    🎓 Learning: Using enums makes our filtering system more maintainable
    and provides clear options for different use cases.
    """
    ESSENTIAL_ONLY = "essential"      # 3-5 most important models only
    RECOMMENDED = "recommended"       # 8-12 recommended models  
    INCLUDE_SPECIALIZED = "specialized"  # 15-20 models including specialized ones
    SHOW_ALL = "show_all"            # No filtering (admin debug)

class OpenAIModelFilter:
    """
    🧠 Intelligent filtering system for OpenAI models.
    
    This class analyzes model names and applies smart filtering to show only
    relevant, recent, and useful models instead of cluttering the UI with
    50+ deprecated and irrelevant models.
    
    🎓 Learning Goals:
    - Understand regex patterns for text analysis
    - Learn classification algorithms and scoring systems
    - Practice enterprise UX principles (progressive disclosure)
    - See how to balance user needs vs admin flexibility
    """
    
    def __init__(self):
        """Initialize the model filter with classification rules."""
        
        # 🎯 Model priority patterns (higher score = more important)
        self.priority_patterns = [
            (r'^gpt-4o(?:-preview)?(?:-\d{4}-\d{2}-\d{2})?$', 100),  # GPT-4o (latest)
            (r'^gpt-4-turbo(?:-preview)?(?:-\d{4}-\d{2}-\d{2})?$', 95),  # GPT-4 Turbo
            (r'^gpt-4(?!-32k)(?:-\d{4}-\d{2}-\d{2})?$', 90),  # GPT-4 (but not 32k variant)
            (r'^gpt-3\.5-turbo(?:-16k)?(?:-\d{4}-\d{2}-\d{2})?$', 85),  # GPT-3.5 Turbo
            (r'^claude-3-5-sonnet', 88),  # Claude 3.5 Sonnet
            (r'^claude-3-opus', 87),      # Claude 3 Opus
            (r'^claude-3-sonnet', 85),    # Claude 3 Sonnet
            (r'^claude-3-haiku', 80),     # Claude 3 Haiku
        ]
        
        # 🚫 Deprecated model patterns (should be filtered out)
        self.deprecated_patterns = [
            r'.*-0613$',           # Old June 2023 models
            r'.*-0301$',           # Old March 2023 models
            r'.*-0314$',           # Old March 2023 models
            r'.*-instruct-',       # Instruct variants (deprecated)
            r'^text-davinci-',     # Text Davinci models (deprecated)
            r'^text-curie-',       # Text Curie models (deprecated)
            r'^text-babbage-',     # Text Babbage models (deprecated)
            r'^text-ada-',         # Text Ada models (deprecated)
            r'^davinci-',          # Davinci models (deprecated)
            r'^curie-',            # Curie models (deprecated)
            r'^babbage-',          # Babbage models (deprecated)
            r'^ada-',              # Ada models (deprecated)
        ]
        
        # ❌ Irrelevant model patterns (not for chat)
        self.irrelevant_patterns = [
            r'^whisper-',          # Audio models
            r'^dall-e-',           # Image generation models
            r'^tts-',              # Text-to-speech models
            r'^text-embedding-',   # Embedding models
            r'^text-similarity-',  # Similarity models
            r'^text-search-',      # Search models
            r'^text-moderation-',  # Moderation models
            r'-edit-',             # Edit models
            r'-insert',            # Insert models
        ]
    
    def filter_models(
        self, 
        model_list: List[str], 
        filter_level: ModelFilterLevel = ModelFilterLevel.RECOMMENDED
    ) -> Tuple[List[str], Dict[str, Any]]:
        """
        🎯 Apply intelligent filtering to a list of models.
        
        Args:
            model_list: Raw list of model names from API
            filter_level: Level of filtering to apply
            
        Returns:
            Tuple of (filtered_models, metadata)
            
        Example:
            filtered, metadata = filter.filter_models(
                ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo', 'text-davinci-003', 'whisper-1'],
                ModelFilterLevel.RECOMMENDED
            )
            # Returns: (['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'], {...metadata...})
        """
        
        if filter_level == ModelFilterLevel.SHOW_ALL:
            # Admin requested all models - no filtering
            return model_list, {
                "filtering_applied": False,
                "filter_level": filter_level.value,
                "total_raw_models": len(model_list),
                "total_filtered_models": len(model_list),
                "filtered_out_count": 0
            }
        
        logger.info(f"Applying {filter_level.value} filtering to {len(model_list)} models")
        
        # Step 1: Remove irrelevant models (always filter these)
        relevant_models = self._filter_irrelevant_models(model_list)
        
        # Step 2: Remove deprecated models (always filter these) 
        current_models = self._filter_deprecated_models(relevant_models)
        
        # Step 3: Score and rank remaining models
        scored_models = self._score_models(current_models)
        
        # Step 4: Apply level-specific filtering
        filtered_models = self._apply_level_filtering(scored_models, filter_level)
        
        # Step 5: Generate metadata
        excluded_models = [m for m in model_list if m not in filtered_models]
        
        metadata = {
            "filtering_applied": True,
            "filter_level": filter_level.value,
            "total_raw_models": len(model_list),
            "total_filtered_models": len(filtered_models),
            "filtered_out_count": len(excluded_models),
            "excluded_models": excluded_models[:10],  # First 10 for debugging
            "filtering_steps": {
                "1_irrelevant_removed": len(model_list) - len(relevant_models),
                "2_deprecated_removed": len(relevant_models) - len(current_models),
                "3_level_filtering_applied": len(current_models) - len(filtered_models)
            }
        }
        
        logger.info(f"Filtering complete: {len(model_list)} → {len(filtered_models)} models")
        
        return filtered_models, metadata
    
    def _filter_irrelevant_models(self, models: List[str]) -> List[str]:
        """Remove models that aren't relevant for chat completion."""
        relevant = []
        
        for model in models:
            is_irrelevant = any(
                re.match(pattern, model, re.IGNORECASE) 
                for pattern in self.irrelevant_patterns
            )
            
            if not is_irrelevant:
                relevant.append(model)
        
        logger.debug(f"Filtered irrelevant models: {len(models)} → {len(relevant)}")
        return relevant
    
    def _filter_deprecated_models(self, models: List[str]) -> List[str]:
        """Remove deprecated or outdated models."""
        current = []
        
        for model in models:
            is_deprecated = any(
                re.match(pattern, model, re.IGNORECASE)
                for pattern in self.deprecated_patterns
            )
            
            if not is_deprecated:
                current.append(model)
        
        logger.debug(f"Filtered deprecated models: {len(models)} → {len(current)}")
        return current
    
    def _score_models(self, models: List[str]) -> List[Tuple[str, int]]:
        """
        Score models based on priority patterns.
        
        Returns list of (model_name, score) tuples sorted by score descending.
        """
        scored = []
        
        for model in models:
            score = 0
            
            # Check against priority patterns
            for pattern, pattern_score in self.priority_patterns:
                if re.match(pattern, model, re.IGNORECASE):
                    score = max(score, pattern_score)
                    break
            
            # Default score for unmatched models
            if score == 0:
                score = 50  # Neutral score
            
            scored.append((model, score))
        
        # Sort by score descending (highest priority first)
        scored.sort(key=lambda x: x[1], reverse=True)
        
        logger.debug(f"Scored {len(scored)} models (top 3: {scored[:3]})")
        return scored
    
    def _apply_level_filtering(
        self, 
        scored_models: List[Tuple[str, int]], 
        filter_level: ModelFilterLevel
    ) -> List[str]:
        """Apply filtering based on the specified level."""
        
        if filter_level == ModelFilterLevel.ESSENTIAL_ONLY:
            # Top 3-5 models only
            limit = 5
            threshold = 85  # Only very high-priority models
            
        elif filter_level == ModelFilterLevel.RECOMMENDED:
            # 8-12 recommended models
            limit = 12
            threshold = 70  # Good models and above
            
        elif filter_level == ModelFilterLevel.INCLUDE_SPECIALIZED:
            # 15-20 models including specialized ones
            limit = 20
            threshold = 40  # Include specialized models
            
        else:  # SHOW_ALL handled earlier
            return [model for model, score in scored_models]
        
        # Apply threshold and limit
        filtered = [
            model for model, score in scored_models 
            if score >= threshold
        ][:limit]
        
        logger.debug(f"Applied {filter_level.value} filtering: {len(scored_models)} → {len(filtered)} models")
        return filtered

class ModelDisplayHelper:
    """
    🎨 Helper class for formatting model names and metadata for UI display.
    
    This class handles the presentation layer of our model system,
    converting technical model IDs into user-friendly display names.
    """
    
    @staticmethod
    def get_display_name(model_id: str) -> str:
        """
        Convert technical model ID to user-friendly display name.
        
        Args:
            model_id: Technical model identifier
            
        Returns:
            User-friendly display name
            
        Examples:
            'gpt-4-turbo-preview' → 'GPT-4 Turbo Preview'
            'gpt-3.5-turbo' → 'GPT-3.5 Turbo'
            'claude-3-opus-20240229' → 'Claude 3 Opus'
        """
        
        display_names = {
            # OpenAI Models
            'gpt-4o': 'GPT-4o',
            'gpt-4o-preview': 'GPT-4o Preview',
            'gpt-4-turbo': 'GPT-4 Turbo',
            'gpt-4-turbo-preview': 'GPT-4 Turbo Preview',
            'gpt-4': 'GPT-4',
            'gpt-4-0613': 'GPT-4 (June 2023)',
            'gpt-4-32k': 'GPT-4 32K',
            'gpt-3.5-turbo': 'GPT-3.5 Turbo',
            'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K',
            'gpt-3.5-turbo-0613': 'GPT-3.5 Turbo (June 2023)',
            
            # Claude Models
            'claude-3-opus-20240229': 'Claude 3 Opus',
            'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
            'claude-3-haiku-20240307': 'Claude 3 Haiku',
            'claude-3-5-sonnet-20240620': 'Claude 3.5 Sonnet',
        }
        
        # Return mapped name or cleaned version of original
        return display_names.get(model_id, model_id.replace('-', ' ').title())
    
    @staticmethod
    def get_model_description(model_id: str) -> str:
        """Get descriptive text for a model."""
        
        descriptions = {
            'gpt-4o': 'Latest and most capable GPT-4 model with multimodal capabilities',
            'gpt-4-turbo': 'Improved GPT-4 with better performance and lower cost',
            'gpt-4': 'Most capable model, best for complex tasks requiring reasoning',
            'gpt-3.5-turbo': 'Fast and efficient, great for most conversations',
            'claude-3-opus-20240229': 'Most powerful Claude model for complex analysis tasks',
            'claude-3-sonnet-20240229': 'Balanced Claude model for general use',
            'claude-3-haiku-20240307': 'Fastest Claude model for quick responses',
        }
        
        return descriptions.get(model_id, 'Advanced language model')
    
    @staticmethod  
    def get_cost_tier(model_id: str) -> str:
        """Get cost tier indicator for a model."""
        
        if any(term in model_id.lower() for term in ['gpt-4', 'opus']):
            return 'high'
        elif any(term in model_id.lower() for term in ['turbo', 'sonnet']):
            return 'medium'
        else:
            return 'low'
    
    @staticmethod
    def get_capabilities(model_id: str) -> List[str]:
        """Get capability tags for a model."""
        
        capabilities_map = {
            'gpt-4o': ['reasoning', 'multimodal', 'coding', 'analysis'],
            'gpt-4-turbo': ['reasoning', 'analysis', 'coding', 'creative-writing'],
            'gpt-4': ['reasoning', 'analysis', 'coding', 'creative-writing'],
            'gpt-3.5-turbo': ['conversation', 'writing', 'basic-coding'],
            'claude-3-opus-20240229': ['reasoning', 'analysis', 'research', 'writing'],
            'claude-3-sonnet-20240229': ['conversation', 'writing', 'analysis'],
            'claude-3-haiku-20240307': ['conversation', 'quick-responses'],
        }
        
        return capabilities_map.get(model_id, ['conversation'])

# =============================================================================
# 🎓 EDUCATIONAL EXAMPLES AND USAGE
# =============================================================================

def example_usage():
    """
    📚 Example of how to use the model filtering system.
    
    This function demonstrates the typical workflow for filtering
    models in a production environment.
    """
    
    # Simulate a raw model list from OpenAI API
    raw_models = [
        'gpt-4o',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-4-0613',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-0613',
        'text-davinci-003',
        'text-davinci-002',
        'whisper-1',
        'dall-e-3',
        'text-embedding-ada-002',
    ]
    
    # Create filter instance
    filter_engine = OpenAIModelFilter()
    
    # Apply different filtering levels
    for level in ModelFilterLevel:
        filtered_models, metadata = filter_engine.filter_models(raw_models, level)
        
        print(f"\n{level.value.upper()} FILTERING:")
        print(f"  Models: {filtered_models}")
        print(f"  Count: {metadata['total_filtered_models']}/{metadata['total_raw_models']}")
        print(f"  Excluded: {metadata['filtered_out_count']}")

if __name__ == "__main__":
    # Run example when script is executed directly
    example_usage()
