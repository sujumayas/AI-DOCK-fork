# AI Dock LiteLLM Pricing Service
# Real-time pricing data integration for accurate cost calculations

import logging
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import json
from decimal import Decimal

try:
    import litellm
    from litellm import get_model_cost_map
    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False
    logging.warning("LiteLLM not available - using fallback pricing")

from ..core.database import AsyncSessionLocal
from ..models.llm_config import LLMConfiguration, LLMProvider


class LiteLLMPricingService:
    """
    Service for fetching real-time pricing data using LiteLLM.
    
    This service provides:
    - Up-to-date pricing for all major LLM providers
    - Automatic model name mapping
    - Fallback pricing when LiteLLM is unavailable
    - Cached pricing data to reduce API calls
    """
    
    def __init__(self):
        """Initialize the pricing service."""
        self.logger = logging.getLogger(__name__)
        self.cache = {}
        self.cache_ttl = timedelta(hours=6)  # Cache pricing for 6 hours
        self.last_cache_update = {}
        
        if LITELLM_AVAILABLE:
            self.logger.info("LiteLLM pricing service initialized with real-time data")
        else:
            self.logger.warning("LiteLLM not available - using fallback pricing")
    
    async def get_model_pricing(
        self, 
        provider: str, 
        model: str,
        force_refresh: bool = False
    ) -> Dict[str, Optional[float]]:
        """
        Get pricing data for a specific model.
        
        Args:
            provider: Provider name (openai, anthropic, etc.)
            model: Model name (gpt-4, claude-3-opus, etc.)
            force_refresh: Force refresh from LiteLLM API
            
        Returns:
            Dict with input_cost_per_1k, output_cost_per_1k, and request_cost
        """
        cache_key = f"{provider}:{model}"
        
        # Check cache first (unless force refresh)
        if not force_refresh and self._is_cache_valid(cache_key):
            self.logger.debug(f"Using cached pricing for {cache_key}")
            return self.cache[cache_key]
        
        try:
            pricing = await self._fetch_pricing_from_litellm(provider, model)
            
            # Cache the result
            self.cache[cache_key] = pricing
            self.last_cache_update[cache_key] = datetime.utcnow()
            
            self.logger.info(f"Updated pricing for {cache_key}: {pricing}")
            return pricing
            
        except Exception as e:
            self.logger.error(f"Failed to fetch pricing for {cache_key}: {str(e)}")
            
            # Return fallback pricing
            fallback = self._get_fallback_pricing(provider, model)
            self.logger.warning(f"Using fallback pricing for {cache_key}: {fallback}")
            return fallback
    
    async def _fetch_pricing_from_litellm(
        self, 
        provider: str, 
        model: str
    ) -> Dict[str, Optional[float]]:
        """
        Fetch pricing from LiteLLM API.
        
        Args:
            provider: Provider name
            model: Model name
            
        Returns:
            Pricing dictionary
        """
        if not LITELLM_AVAILABLE:
            return self._get_fallback_pricing(provider, model)
        
        try:
            # Map our provider names to LiteLLM format
            litellm_model = self._map_to_litellm_model(provider, model)
            
            # Get cost map from LiteLLM
            cost_map = get_model_cost_map()
            
            if litellm_model in cost_map:
                model_costs = cost_map[litellm_model]
                
                return {
                    "input_cost_per_1k": model_costs.get("input_cost_per_token", 0) * 1000,
                    "output_cost_per_1k": model_costs.get("output_cost_per_token", 0) * 1000,
                    "request_cost": model_costs.get("request_cost", 0)
                }
            else:
                self.logger.warning(f"Model {litellm_model} not found in LiteLLM cost map")
                return self._get_fallback_pricing(provider, model)
                
        except Exception as e:
            self.logger.error(f"LiteLLM API error: {str(e)}")
            return self._get_fallback_pricing(provider, model)
    
    def _map_to_litellm_model(self, provider: str, model: str) -> str:
        """
        Map our model names to LiteLLM format.
        
        Args:
            provider: Our provider name
            model: Our model name
            
        Returns:
            LiteLLM-compatible model name
        """
        provider_lower = provider.lower()
        
        # OpenAI models
        if provider_lower == "openai":
            return model  # OpenAI models usually match directly
        
        # Anthropic models
        elif provider_lower == "anthropic":
            # Map Claude model names to LiteLLM format
            claude_mappings = {
                "claude-opus-4-0": "claude-3-opus-20240229",
                "claude-sonnet-4-0": "claude-3-sonnet-20240229", 
                "claude-3-7-sonnet-latest": "claude-3-5-sonnet-20241022",
                "claude-3-5-sonnet-latest": "claude-3-5-sonnet-20241022",
                "claude-3-5-haiku-latest": "claude-3-5-haiku-20241022",
                "claude-opus-4-20250514": "claude-3-opus-20240229",
                "claude-sonnet-4-20250514": "claude-3-sonnet-20240229",
                "claude-3-7-sonnet-20250219": "claude-3-5-sonnet-20241022"
            }
            return claude_mappings.get(model, model)
        
        # Google models
        elif provider_lower == "google":
            if model.startswith("gemini"):
                return model
            return f"gemini/{model}"
        
        # Default: return as-is
        return f"{provider}/{model}"
    
    def _get_fallback_pricing(self, provider: str, model: str) -> Dict[str, Optional[float]]:
        """
        Get fallback pricing when LiteLLM is unavailable.
        
        Args:
            provider: Provider name
            model: Model name
            
        Returns:
            Fallback pricing dictionary
        """
        provider_lower = provider.lower()
        
        # OpenAI fallback pricing (as of January 2025)
        if provider_lower == "openai":
            if "gpt-4" in model.lower():
                if "turbo" in model.lower():
                    return {
                        "input_cost_per_1k": 0.01,
                        "output_cost_per_1k": 0.03,
                        "request_cost": 0
                    }
                else:
                    return {
                        "input_cost_per_1k": 0.03,
                        "output_cost_per_1k": 0.06,
                        "request_cost": 0
                    }
            elif "gpt-3.5" in model.lower():
                return {
                    "input_cost_per_1k": 0.0015,
                    "output_cost_per_1k": 0.002,
                    "request_cost": 0
                }
        
        # Anthropic fallback pricing (as of January 2025)
        elif provider_lower == "anthropic":
            if "opus" in model.lower():
                return {
                    "input_cost_per_1k": 0.015,
                    "output_cost_per_1k": 0.075,
                    "request_cost": 0
                }
            elif "sonnet" in model.lower():
                return {
                    "input_cost_per_1k": 0.003,
                    "output_cost_per_1k": 0.015,
                    "request_cost": 0
                }
            elif "haiku" in model.lower():
                return {
                    "input_cost_per_1k": 0.00025,
                    "output_cost_per_1k": 0.00125,
                    "request_cost": 0
                }
        
        # Google fallback pricing
        elif provider_lower == "google":
            return {
                "input_cost_per_1k": 0.00035,
                "output_cost_per_1k": 0.00105,
                "request_cost": 0
            }
        
        # Default fallback
        self.logger.warning(f"No fallback pricing for {provider}:{model}")
        return {
            "input_cost_per_1k": 0.001,
            "output_cost_per_1k": 0.002,
            "request_cost": 0
        }
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """
        Check if cached pricing is still valid.
        
        Args:
            cache_key: Cache key to check
            
        Returns:
            True if cache is valid
        """
        if cache_key not in self.cache:
            return False
        
        if cache_key not in self.last_cache_update:
            return False
        
        age = datetime.utcnow() - self.last_cache_update[cache_key]
        return age < self.cache_ttl
    
    async def update_llm_config_pricing(
        self, 
        config_id: int,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Update pricing for a specific LLM configuration.
        
        Args:
            config_id: LLM configuration ID
            force_refresh: Force refresh from LiteLLM
            
        Returns:
            Update results
        """
        async with AsyncSessionLocal() as session:
            try:
                # Get the configuration
                config = await session.get(LLMConfiguration, config_id)
                if not config:
                    raise ValueError(f"LLM configuration {config_id} not found")
                
                provider = config.provider.value if hasattr(config.provider, 'value') else str(config.provider)
                model = config.default_model
                
                # Get current pricing
                pricing = await self.get_model_pricing(provider, model, force_refresh)
                
                # Update the configuration
                old_input_cost = float(config.cost_per_1k_input_tokens or 0)
                old_output_cost = float(config.cost_per_1k_output_tokens or 0)
                
                config.cost_per_1k_input_tokens = Decimal(str(pricing["input_cost_per_1k"]))
                config.cost_per_1k_output_tokens = Decimal(str(pricing["output_cost_per_1k"]))
                config.cost_per_request = Decimal(str(pricing["request_cost"] or 0))
                config.updated_at = datetime.utcnow()
                
                await session.commit()
                
                self.logger.info(f"Updated pricing for config {config_id} ({provider}:{model})")
                
                return {
                    "success": True,
                    "config_id": config_id,
                    "provider": provider,
                    "model": model,
                    "old_pricing": {
                        "input_cost_per_1k": old_input_cost,
                        "output_cost_per_1k": old_output_cost
                    },
                    "new_pricing": pricing,
                    "updated_at": config.updated_at.isoformat()
                }
                
            except Exception as e:
                await session.rollback()
                self.logger.error(f"Failed to update pricing for config {config_id}: {str(e)}")
                return {
                    "success": False,
                    "config_id": config_id,
                    "error": str(e)
                }
    
    async def update_all_configs_pricing(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Update pricing for all active LLM configurations.
        
        Args:
            force_refresh: Force refresh from LiteLLM
            
        Returns:
            List of update results
        """
        async with AsyncSessionLocal() as session:
            try:
                from sqlalchemy import select
                
                # Get all active configurations
                stmt = select(LLMConfiguration).where(LLMConfiguration.is_active == True)
                result = await session.execute(stmt)
                configs = result.scalars().all()
                
                results = []
                for config in configs:
                    update_result = await self.update_llm_config_pricing(
                        config.id, 
                        force_refresh
                    )
                    results.append(update_result)
                    
                    # Add small delay to avoid rate limits
                    await asyncio.sleep(0.1)
                
                successful = sum(1 for r in results if r["success"])
                self.logger.info(f"Updated pricing for {successful}/{len(results)} configurations")
                
                return results
                
            except Exception as e:
                self.logger.error(f"Failed to update all pricing: {str(e)}")
                return [{
                    "success": False,
                    "error": str(e)
                }]
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics for monitoring.
        
        Returns:
            Cache statistics
        """
        total_entries = len(self.cache)
        valid_entries = sum(1 for key in self.cache.keys() if self._is_cache_valid(key))
        
        return {
            "total_entries": total_entries,
            "valid_entries": valid_entries,
            "expired_entries": total_entries - valid_entries,
            "cache_ttl_hours": self.cache_ttl.total_seconds() / 3600,
            "litellm_available": LITELLM_AVAILABLE
        }


# Global service instance
_pricing_service = None

def get_pricing_service() -> LiteLLMPricingService:
    """
    Get the global pricing service instance.
    
    Returns:
        Singleton pricing service instance
    """
    global _pricing_service
    if _pricing_service is None:
        _pricing_service = LiteLLMPricingService()
    return _pricing_service
