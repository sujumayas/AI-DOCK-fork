# AI Dock LLM Cost Calculator
# Atomic component for cost estimation and calculation

from typing import Dict, Any, Optional, List
import logging

from ..models import ChatRequest, ChatResponse


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
    
    def calculate_actual_cost(
        self, 
        response: ChatResponse, 
        config_data: Dict[str, Any]
    ) -> Optional[float]:
        """
        Calculate actual cost from response usage data.
        
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
            
            # Get pricing information
            cost_per_1k_input = config_data.get('cost_per_1k_input_tokens')
            cost_per_1k_output = config_data.get('cost_per_1k_output_tokens')
            cost_per_request = config_data.get('cost_per_request')
            
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
    
    def calculate_streaming_cost(
        self, 
        usage: Dict[str, int], 
        config_data: Dict[str, Any]
    ) -> Optional[float]:
        """
        Calculate cost for streaming response usage.
        
        Args:
            usage: Usage data with token counts
            config_data: LLM configuration data with pricing information
            
        Returns:
            Cost in USD, or None if calculation not possible
        """
        try:
            if not usage or not config_data.get('cost_per_1k_input_tokens'):
                return None
            
            cost_per_1k_input = float(config_data.get('cost_per_1k_input_tokens', 0))
            cost_per_1k_output = float(config_data.get('cost_per_1k_output_tokens', 0))
            cost_per_request = float(config_data.get('cost_per_request', 0))
            
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
    
    def get_cost_breakdown(
        self, 
        usage: Dict[str, int], 
        config_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Get detailed cost breakdown for analysis.
        
        Args:
            usage: Usage data with token counts
            config_data: LLM configuration data with pricing information
            
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
                'total_cost': 0.0
            }
            
            # Calculate input cost
            if config_data.get('cost_per_1k_input_tokens'):
                cost_per_1k_input = float(config_data['cost_per_1k_input_tokens'])
                breakdown['input_cost'] = (breakdown['input_tokens'] / 1000) * cost_per_1k_input
            
            # Calculate output cost
            if config_data.get('cost_per_1k_output_tokens'):
                cost_per_1k_output = float(config_data['cost_per_1k_output_tokens'])
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
                'total_cost': 0.0
            }


# Factory function for dependency injection
def get_cost_calculator() -> CostCalculator:
    """
    Get cost calculator instance.
    
    Returns:
        CostCalculator instance
    """
    return CostCalculator()
