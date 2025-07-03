# AI Dock LLM Cost Calculator
# Atomic component for cost estimation and calculation

from typing import Dict, Any, Optional, List
import logging

from ..models import ChatRequest, ChatResponse
from ...litellm_pricing_service import get_pricing_service


class CostCalculator:
    """
    Atomic component responsible for cost estimation and calculation.
    
    Single Responsibility:
    - Estimate costs before requests
    - Calculate actual costs from responses
    - Handle different pricing models (per-token, per-request)
    """
    
    def __init__(self):
        """Initialize the cost calculator."""
        self.logger = logging.getLogger(__name__)
        self.pricing_service = get_pricing_service()
    
    def estimate_request_cost(
        self, 
        request: ChatRequest, 
        config_data: Dict[str, Any]
    ) -> Optional[float]:
        """
        Estimate the cost of a chat request based on configuration pricing.
        
        Args:
            request: Chat request to estimate cost for
            config_data: LLM configuration data with pricing information
            
        Returns:
            Estimated cost in USD, or None if estimation not possible
        """
        try:
            # Get pricing information from config
            cost_per_1k_input = config_data.get('cost_per_1k_input_tokens')
            cost_per_1k_output = config_data.get('cost_per_1k_output_tokens')
            cost_per_request = config_data.get('cost_per_request')
            
            # Base request cost
            total_cost = float(cost_per_request or 0)
            
            # Estimate input tokens (rough estimation)
            if cost_per_1k_input:
                estimated_input_tokens = self._estimate_input_tokens(request.messages)
                input_cost = (estimated_input_tokens / 1000) * float(cost_per_1k_input)
                total_cost += input_cost
                
                self.logger.debug(f"Estimated input tokens: {estimated_input_tokens}, cost: ${input_cost:.4f}")
            
            # Estimate output tokens if max_tokens is specified
            if cost_per_1k_output and request.max_tokens:
                # Use max_tokens as upper bound for output estimation
                estimated_output_tokens = min(request.max_tokens, 1000)  # Conservative estimate
                output_cost = (estimated_output_tokens / 1000) * float(cost_per_1k_output)
                total_cost += output_cost
                
                self.logger.debug(f"Estimated output tokens: {estimated_output_tokens}, cost: ${output_cost:.4f}")
            
            self.logger.debug(f"Total estimated cost: ${total_cost:.4f}")
            return total_cost if total_cost > 0 else None
            
        except Exception as e:
            self.logger.warning(f"Failed to estimate cost: {str(e)}")
            return None
    
    async def calculate_actual_cost(
        self, 
        response: ChatResponse, 
        config_data: Dict[str, Any]
    ) -> Optional[float]:
        """
        Calculate actual cost from response usage data.
        
        🔧 ENHANCED: Now uses LiteLLM pricing when config data is missing or outdated.
        
        Args:
            response: Chat response with usage information
            config_data: LLM configuration data with pricing information
            
        Returns:
            Actual cost in USD, or None if calculation not possible
        """
        try:
            if not response.usage:
                self.logger.debug("No usage data available for cost calculation")
                return None
            
            # Get pricing information from config
            cost_per_1k_input = config_data.get('cost_per_1k_input_tokens')
            cost_per_1k_output = config_data.get('cost_per_1k_output_tokens')
            cost_per_request = config_data.get('cost_per_request')
            
            # 🔧 FIX: If pricing is missing or zero, fetch from LiteLLM
            if not cost_per_1k_input or not cost_per_1k_output or (float(cost_per_1k_input or 0) == 0 and float(cost_per_1k_output or 0) == 0):
                provider = config_data.get('provider', 'unknown')
                model = response.model or config_data.get('model', 'unknown')  # FIXED: Use actual model from response
                
                self.logger.info(f"🔧 Config pricing missing/zero for {provider}:{model}, fetching from LiteLLM")
                
                try:
                    # Fetch real-time pricing from LiteLLM
                    litellm_pricing = await self.pricing_service.get_model_pricing(provider, model)
                    
                    if litellm_pricing:
                        cost_per_1k_input = litellm_pricing.get('input_cost_per_1k', cost_per_1k_input)
                        cost_per_1k_output = litellm_pricing.get('output_cost_per_1k', cost_per_1k_output)
                        cost_per_request = litellm_pricing.get('request_cost', cost_per_request)
                        
                        self.logger.info(f"✅ Updated pricing from LiteLLM: input=${cost_per_1k_input}/1k, output=${cost_per_1k_output}/1k")
                    
                except Exception as pricing_error:
                    self.logger.warning(f"⚠️ Failed to fetch LiteLLM pricing: {str(pricing_error)}")
            
            # Base request cost
            total_cost = float(cost_per_request or 0)
            
            # Calculate input token cost
            if cost_per_1k_input and response.usage.get('input_tokens'):
                input_tokens = response.usage['input_tokens']
                input_cost = (input_tokens / 1000) * float(cost_per_1k_input)
                total_cost += input_cost
                
                self.logger.debug(f"Input tokens: {input_tokens}, cost: ${input_cost:.4f}")
            
            # Calculate output token cost
            if cost_per_1k_output and response.usage.get('output_tokens'):
                output_tokens = response.usage['output_tokens']
                output_cost = (output_tokens / 1000) * float(cost_per_1k_output)
                total_cost += output_cost
                
                self.logger.debug(f"Output tokens: {output_tokens}, cost: ${output_cost:.4f}")
            
            self.logger.debug(f"Total actual cost: ${total_cost:.4f}")
            return total_cost if total_cost > 0 else None
            
        except Exception as e:
            self.logger.warning(f"Failed to calculate actual cost: {str(e)}")
            return None
    
    async def calculate_streaming_cost(
        self, 
        usage: Dict[str, int], 
        config_data: Dict[str, Any],
        actual_model: Optional[str] = None
    ) -> Optional[float]:
        """
        Calculate cost for streaming response usage.
        
        🔧 ENHANCED: Now uses LiteLLM pricing when config data is missing or outdated.
        
        Args:
            usage: Usage data with token counts
            config_data: LLM configuration data with pricing information
            actual_model: The actual model used (overrides config default)
            
        Returns:
            Cost in USD, or None if calculation not possible
        """
        try:
            if not usage:
                return None
            
            # Get pricing information from config
            cost_per_1k_input = config_data.get('cost_per_1k_input_tokens')
            cost_per_1k_output = config_data.get('cost_per_1k_output_tokens')
            cost_per_request = config_data.get('cost_per_request')
            
            # 🔧 FIX: If pricing is missing or zero, fetch from LiteLLM
            if not cost_per_1k_input or not cost_per_1k_output or (float(cost_per_1k_input or 0) == 0 and float(cost_per_1k_output or 0) == 0):
                provider = config_data.get('provider', 'unknown')
                model = actual_model or config_data.get('model', 'unknown')  # FIXED: Use actual model
                
                self.logger.info(f"🔧 Streaming: Config pricing missing/zero for {provider}:{model}, fetching from LiteLLM")
                
                try:
                    # Fetch real-time pricing from LiteLLM
                    litellm_pricing = await self.pricing_service.get_model_pricing(provider, model)
                    
                    if litellm_pricing:
                        cost_per_1k_input = litellm_pricing.get('input_cost_per_1k', cost_per_1k_input)
                        cost_per_1k_output = litellm_pricing.get('output_cost_per_1k', cost_per_1k_output)
                        cost_per_request = litellm_pricing.get('request_cost', cost_per_request)
                        
                        self.logger.info(f"✅ Streaming: Updated pricing from LiteLLM: input=${cost_per_1k_input}/1k, output=${cost_per_1k_output}/1k")
                    
                except Exception as pricing_error:
                    self.logger.warning(f"⚠️ Streaming: Failed to fetch LiteLLM pricing: {str(pricing_error)}")
            
            # If we still don't have pricing, return None
            if not cost_per_1k_input and not cost_per_1k_output:
                self.logger.warning("No pricing data available for streaming cost calculation")
                return None
            
            cost_per_1k_input = float(cost_per_1k_input or 0)
            cost_per_1k_output = float(cost_per_1k_output or 0)
            cost_per_request = float(cost_per_request or 0)
            
            # Base request cost
            total_cost = cost_per_request
            
            # Token costs
            input_tokens = usage.get("input_tokens", 0)
            output_tokens = usage.get("output_tokens", 0)
            
            input_cost = (input_tokens / 1000) * cost_per_1k_input
            output_cost = (output_tokens / 1000) * cost_per_1k_output
            
            total_cost += input_cost + output_cost
            
            self.logger.debug(f"Streaming cost - Input: {input_tokens} tokens (${input_cost:.4f}), "
                            f"Output: {output_tokens} tokens (${output_cost:.4f}), "
                            f"Total: ${total_cost:.4f}")
            
            return total_cost
            
        except Exception as e:
            self.logger.warning(f"Failed to calculate streaming cost: {str(e)}")
            return None
    
    def _estimate_input_tokens(self, messages: List[Dict[str, str]]) -> int:
        """
        Rough estimation of input tokens based on message content.
        
        This is a simplified estimation. Real tokenization would require
        provider-specific tokenizers.
        
        Args:
            messages: List of message dictionaries
            
        Returns:
            Estimated number of input tokens
        """
        total_chars = 0
        for message in messages:
            content = message.get('content', '')
            total_chars += len(content)
        
        # Rough approximation: 4 characters per token on average
        estimated_tokens = total_chars // 4
        
        # Add overhead for message structure
        estimated_tokens += len(messages) * 10  # ~10 tokens per message for structure
        
        return max(estimated_tokens, 1)  # Minimum 1 token
    
    async def get_cost_breakdown(
        self, 
        usage: Dict[str, int], 
        config_data: Dict[str, Any],
        actual_model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get detailed cost breakdown for analysis.
        
        🔧 ENHANCED: Now uses LiteLLM pricing when config data is missing or outdated.
        
        Args:
            usage: Usage data with token counts
            config_data: LLM configuration data with pricing information
            actual_model: The actual model used (overrides config default)
            
        Returns:
            Dictionary with detailed cost breakdown
        """
        try:
            breakdown = {
                'input_tokens': usage.get('input_tokens', 0),
                'output_tokens': usage.get('output_tokens', 0),
                'total_tokens': usage.get('total_tokens', 0),
                'input_cost': 0.0,
                'output_cost': 0.0,
                'request_cost': float(config_data.get('cost_per_request', 0)),
                'total_cost': 0.0,
                'pricing_source': 'config'  # Track where pricing came from
            }
            
            # Get pricing information from config
            cost_per_1k_input = config_data.get('cost_per_1k_input_tokens')
            cost_per_1k_output = config_data.get('cost_per_1k_output_tokens')
            
            # 🔧 FIX: If pricing is missing or zero, fetch from LiteLLM
            if not cost_per_1k_input or not cost_per_1k_output or (float(cost_per_1k_input or 0) == 0 and float(cost_per_1k_output or 0) == 0):
                provider = config_data.get('provider', 'unknown')
                model = actual_model or config_data.get('model', 'unknown')  # FIXED: Use actual model
                
                self.logger.info(f"🔧 Breakdown: Config pricing missing/zero for {provider}:{model}, fetching from LiteLLM")
                
                try:
                    # Fetch real-time pricing from LiteLLM
                    litellm_pricing = await self.pricing_service.get_model_pricing(provider, model)
                    
                    if litellm_pricing:
                        cost_per_1k_input = litellm_pricing.get('input_cost_per_1k', cost_per_1k_input)
                        cost_per_1k_output = litellm_pricing.get('output_cost_per_1k', cost_per_1k_output)
                        breakdown['request_cost'] = float(litellm_pricing.get('request_cost', breakdown['request_cost']))
                        breakdown['pricing_source'] = 'litellm'
                        
                        self.logger.info(f"✅ Breakdown: Updated pricing from LiteLLM: input=${cost_per_1k_input}/1k, output=${cost_per_1k_output}/1k")
                    
                except Exception as pricing_error:
                    self.logger.warning(f"⚠️ Breakdown: Failed to fetch LiteLLM pricing: {str(pricing_error)}")
                    breakdown['pricing_source'] = 'fallback'
            
            # Calculate input cost
            if cost_per_1k_input:
                cost_per_1k_input = float(cost_per_1k_input)
                breakdown['input_cost'] = (breakdown['input_tokens'] / 1000) * cost_per_1k_input
            
            # Calculate output cost
            if cost_per_1k_output:
                cost_per_1k_output = float(cost_per_1k_output)
                breakdown['output_cost'] = (breakdown['output_tokens'] / 1000) * cost_per_1k_output
            
            # Total cost
            breakdown['total_cost'] = (
                breakdown['input_cost'] + 
                breakdown['output_cost'] + 
                breakdown['request_cost']
            )
            
            return breakdown
            
        except Exception as e:
            self.logger.error(f"Failed to create cost breakdown: {str(e)}")
            return {
                'error': str(e),
                'total_cost': 0.0,
                'pricing_source': 'error'
            }


# Factory function for dependency injection
def get_cost_calculator() -> CostCalculator:
    """
    Get cost calculator instance.
    
    Returns:
        CostCalculator instance
    """
    return CostCalculator()
