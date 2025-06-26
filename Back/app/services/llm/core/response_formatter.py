# AI Dock LLM Response Formatter
# Atomic component for consistent response formatting

from typing import Dict, Any, Optional
from datetime import datetime
import logging

from ..models import ChatResponse


class ResponseFormatter:
    """
    Atomic component responsible for consistent response formatting.
    
    Single Responsibility:
    - Format streaming chunks consistently
    - Format final responses with metadata
    - Ensure consistent response structure across providers
    """
    
    def __init__(self):
        """Initialize the response formatter."""
        self.logger = logging.getLogger(__name__)
    
    def format_streaming_chunk(
        self, 
        chunk_data: Dict[str, Any], 
        chunk_index: int, 
        provider_name: str,
        additional_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Format streaming chunk for consistent API response.
        
        Args:
            chunk_data: Raw chunk data from provider
            chunk_index: Index of this chunk in the stream
            provider_name: Name of the LLM provider
            additional_metadata: Optional additional metadata to include
            
        Returns:
            Formatted streaming chunk dictionary
        """
        formatted_chunk = {
            "content": chunk_data.get("content", ""),
            "is_final": chunk_data.get("is_final", False),
            "model": chunk_data.get("model"),
            "provider": provider_name,
            "chunk_index": chunk_index,
            "timestamp": datetime.utcnow().isoformat(),
            "usage": chunk_data.get("usage"),
            "cost": chunk_data.get("cost"),
            "response_time_ms": chunk_data.get("response_time_ms")
        }
        
        # Add additional metadata if provided
        if additional_metadata:
            formatted_chunk.update(additional_metadata)
        
        self.logger.debug(f"Formatted streaming chunk {chunk_index} for {provider_name}")
        return formatted_chunk
    
    def format_final_response(
        self, 
        response: ChatResponse,
        additional_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Format final chat response with comprehensive metadata.
        
        Args:
            response: ChatResponse object from provider
            additional_metadata: Optional additional metadata to include
            
        Returns:
            Formatted response dictionary
        """
        formatted_response = {
            "content": response.content,
            "model": response.model,
            "provider": response.provider,
            "usage": response.usage,
            "cost": response.cost,
            "response_time_ms": response.response_time_ms,
            "timestamp": datetime.utcnow().isoformat(),
            "success": True
        }
        
        # Add additional metadata if provided
        if additional_metadata:
            formatted_response.update(additional_metadata)
        
        self.logger.debug(f"Formatted final response from {response.provider}")
        return formatted_response
    
    def format_error_response(
        self, 
        error: Exception,
        provider_name: Optional[str] = None,
        model: Optional[str] = None,
        additional_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Format error response with consistent structure.
        
        Args:
            error: Exception that occurred
            provider_name: Name of the LLM provider (if known)
            model: Model name (if known)
            additional_context: Optional additional context information
            
        Returns:
            Formatted error response dictionary
        """
        error_response = {
            "success": False,
            "error": str(error),
            "error_type": type(error).__name__,
            "provider": provider_name,
            "model": model,
            "timestamp": datetime.utcnow().isoformat(),
            "content": None,
            "usage": None,
            "cost": None,
            "response_time_ms": None
        }
        
        # Add additional context if provided
        if additional_context:
            error_response.update(additional_context)
        
        self.logger.debug(f"Formatted error response: {error_response['error_type']}")
        return error_response
    
    def format_quota_exceeded_response(
        self, 
        quota_details: Dict[str, Any],
        config_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Format quota exceeded response with helpful information.
        
        Args:
            quota_details: Quota information from quota manager
            config_name: Name of the LLM configuration (if known)
            
        Returns:
            Formatted quota exceeded response
        """
        response = {
            "success": False,
            "error": "Department quota exceeded",
            "error_type": "QuotaExceededError",
            "timestamp": datetime.utcnow().isoformat(),
            "quota_details": quota_details,
            "config_name": config_name,
            "content": None,
            "usage": None,
            "cost": None,
            "response_time_ms": None
        }
        
        self.logger.debug("Formatted quota exceeded response")
        return response
    
    def format_streaming_final_chunk(
        self, 
        accumulated_content: str,
        final_response: ChatResponse,
        chunk_count: int,
        streaming_duration_ms: int
    ) -> Dict[str, Any]:
        """
        Format the final chunk in a streaming response with complete metadata.
        
        Args:
            accumulated_content: Complete accumulated content from streaming
            final_response: Final response object with usage/cost data
            chunk_count: Total number of chunks sent
            streaming_duration_ms: Total streaming duration in milliseconds
            
        Returns:
            Formatted final streaming chunk
        """
        final_chunk = {
            "content": "",  # Final chunk typically has no additional content
            "is_final": True,
            "model": final_response.model,
            "provider": final_response.provider,
            "chunk_index": chunk_count - 1,
            "timestamp": datetime.utcnow().isoformat(),
            "usage": final_response.usage,
            "cost": final_response.cost,
            "response_time_ms": final_response.response_time_ms,
            "streaming_metadata": {
                "total_chunks": chunk_count,
                "total_content_length": len(accumulated_content),
                "streaming_duration_ms": streaming_duration_ms,
                "average_chunk_size": len(accumulated_content) // max(chunk_count, 1)
            }
        }
        
        self.logger.debug(f"Formatted final streaming chunk: {chunk_count} chunks, "
                         f"{len(accumulated_content)} chars, {streaming_duration_ms}ms")
        return final_chunk
    
    def format_test_response(
        self, 
        test_result: Dict[str, Any],
        config_name: str,
        provider_name: str
    ) -> Dict[str, Any]:
        """
        Format test configuration response.
        
        Args:
            test_result: Result from provider test
            config_name: Name of the configuration tested
            provider_name: Name of the provider
            
        Returns:
            Formatted test response
        """
        formatted_response = {
            "config_name": config_name,
            "provider": provider_name,
            "timestamp": datetime.utcnow().isoformat(),
            "test_result": test_result,
            "success": test_result.get("success", False),
            "response_time_ms": test_result.get("response_time_ms"),
            "error": test_result.get("error")
        }
        
        self.logger.debug(f"Formatted test response for {config_name}: "
                         f"{'SUCCESS' if formatted_response['success'] else 'FAILED'}")
        return formatted_response
    
    def add_request_metadata(
        self, 
        response: Dict[str, Any],
        request_id: Optional[str] = None,
        session_id: Optional[str] = None,
        user_id: Optional[int] = None,
        config_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Add request metadata to response for tracing and debugging.
        
        Args:
            response: Response dictionary to enhance
            request_id: Unique request identifier
            session_id: Session identifier
            user_id: User making the request
            config_id: Configuration used
            
        Returns:
            Enhanced response with metadata
        """
        metadata = {
            "request_metadata": {
                "request_id": request_id,
                "session_id": session_id,
                "user_id": user_id,
                "config_id": config_id
            }
        }
        
        # Add metadata without overwriting existing keys
        enhanced_response = {**response, **metadata}
        
        self.logger.debug(f"Added request metadata: request_id={request_id}")
        return enhanced_response


# Factory function for dependency injection
def get_response_formatter() -> ResponseFormatter:
    """
    Get response formatter instance.
    
    Returns:
        ResponseFormatter instance
    """
    return ResponseFormatter()
