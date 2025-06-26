# AI Dock LLM Provider Factory
# Manages provider instantiation and caching

from typing import Dict, Type
import logging

from app.models.llm_config import LLMConfiguration, LLMProvider
from .exceptions import LLMServiceError
from .providers import BaseLLMProvider, OpenAIProvider, AnthropicProvider


class LLMProviderFactory:
    """
    Factory class for creating and managing LLM provider instances.
    
    This class handles:
    - Provider class mapping
    - Provider instantiation
    - Provider caching for performance
    - Configuration validation
    """
    
    def __init__(self):
        """Initialize the provider factory."""
        self.logger = logging.getLogger(__name__)
        self._provider_cache: Dict[int, BaseLLMProvider] = {}
        
        # Map of provider types to their implementation classes
        self._provider_classes: Dict[LLMProvider, Type[BaseLLMProvider]] = {
            LLMProvider.OPENAI: OpenAIProvider,
            LLMProvider.ANTHROPIC: AnthropicProvider,
            # Future providers can be added here:
            # LLMProvider.GOOGLE: GoogleProvider,
            # LLMProvider.MISTRAL: MistralProvider,
        }
    
    def get_provider(self, config: LLMConfiguration) -> BaseLLMProvider:
        """
        Get or create a provider instance for the given configuration.
        
        This method implements caching to avoid recreating providers unnecessarily.
        Providers are cached by configuration ID and invalidated when config changes.
        
        Args:
            config: LLM configuration from database
            
        Returns:
            Provider instance ready to handle requests
            
        Raises:
            LLMServiceError: If provider type is not supported
        """
        # Check cache first (avoid recreating providers)
        if config.id in self._provider_cache:
            cached_provider = self._provider_cache[config.id]
            
            # Verify the cached provider is still using current config
            if cached_provider.config.updated_at == config.updated_at:
                self.logger.debug(f"Returning cached provider for config {config.id}")
                return cached_provider
            else:
                # Config has been updated, remove from cache
                self.logger.info(f"Config {config.id} updated, invalidating cached provider")
                del self._provider_cache[config.id]
        
        # Create new provider instance
        provider_class = self._get_provider_class(config.provider)
        provider = provider_class(config)
        
        # Cache it for future use
        self._provider_cache[config.id] = provider
        
        self.logger.info(f"Created new {provider.provider_name} provider for config '{config.name}'")
        return provider
    
    def _get_provider_class(self, provider_type: LLMProvider) -> Type[BaseLLMProvider]:
        """
        Get the provider class for a given provider type.
        
        Args:
            provider_type: The LLM provider enum
            
        Returns:
            Provider class to instantiate
            
        Raises:
            LLMServiceError: If provider type is not supported
        """
        provider_class = self._provider_classes.get(provider_type)
        if not provider_class:
            supported_providers = list(self._provider_classes.keys())
            raise LLMServiceError(
                f"Unsupported provider: {provider_type}. "
                f"Supported providers: {supported_providers}"
            )
        
        return provider_class
    
    def create_config_from_data(self, config_data: Dict[str, any]) -> LLMConfiguration:
        """
        Create a temporary LLMConfiguration object from extracted data.
        
        This avoids SQLAlchemy session issues by creating a detached object
        that doesn't need database access.
        
        Args:
            config_data: Dictionary with configuration data
            
        Returns:
            LLMConfiguration object populated with data
        """
        config = LLMConfiguration()
        
        # Set all the attributes from the data
        for key, value in config_data.items():
            setattr(config, key, value)
        
        return config
    
    def clear_cache(self) -> int:
        """
        Clear the provider cache.
        
        Useful for testing or when configurations change frequently.
        
        Returns:
            Number of cached providers cleared
        """
        count = len(self._provider_cache)
        self._provider_cache.clear()
        self.logger.info(f"Cleared {count} cached providers")
        return count
    
    def get_cache_stats(self) -> Dict[str, any]:
        """
        Get statistics about the provider cache.
        
        Returns:
            Dictionary with cache statistics
        """
        return {
            "cached_providers": len(self._provider_cache),
            "cached_config_ids": list(self._provider_cache.keys()),
            "supported_provider_types": list(self._provider_classes.keys())
        }
    
    def is_provider_supported(self, provider_type: LLMProvider) -> bool:
        """
        Check if a provider type is supported.
        
        Args:
            provider_type: Provider type to check
            
        Returns:
            True if provider is supported, False otherwise
        """
        return provider_type in self._provider_classes
    
    def get_supported_providers(self) -> list:
        """
        Get list of all supported provider types.
        
        Returns:
            List of supported LLMProvider enum values
        """
        return list(self._provider_classes.keys())
    
    def remove_from_cache(self, config_id: int) -> bool:
        """
        Remove a specific provider from cache.
        
        Args:
            config_id: Configuration ID to remove
            
        Returns:
            True if provider was cached and removed, False if not in cache
        """
        if config_id in self._provider_cache:
            del self._provider_cache[config_id]
            self.logger.info(f"Removed provider for config {config_id} from cache")
            return True
        return False


# Global factory instance (singleton pattern)
_provider_factory = None

def get_provider_factory() -> LLMProviderFactory:
    """
    Get the global provider factory instance.
    
    Returns:
        Singleton provider factory instance
    """
    global _provider_factory
    if _provider_factory is None:
        _provider_factory = LLMProviderFactory()
    return _provider_factory


# Export factory classes and functions
__all__ = [
    'LLMProviderFactory',
    'get_provider_factory'
]
