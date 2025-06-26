# AI Dock LLM Usage Logger
# Handles comprehensive logging of LLM requests and responses

import asyncio
from typing import Dict, Any, Optional
from datetime import datetime
import logging

from ..usage_service import usage_service
from .models import ChatResponse
from .quota_manager import get_quota_manager


class LLMUsageLogger:
    """
    Manages comprehensive logging of LLM usage for analytics and monitoring.
    
    This class handles:
    - Request/response logging with isolated database operations
    - Performance metrics tracking
    - Error logging and debugging
    - Background task management for non-blocking logging
    """
    
    def __init__(self):
        """Initialize the usage logger."""
        self.logger = logging.getLogger(__name__)
        self.quota_manager = get_quota_manager()
    
    async def log_llm_request_with_quota(
        self,
        user_id: int,
        config_id: int,
        request_data: Dict[str, Any],
        response_data: Dict[str, Any],
        performance_data: Dict[str, Any],
        session_id: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        final_response: Optional[ChatResponse] = None,
        bypass_quota: bool = False,
        db_session = None
    ) -> Dict[str, Any]:
        """
        Log LLM request with quota recording (comprehensive logging).
        
        This method combines usage logging with quota tracking for complete
        request lifecycle management.
        
        Args:
            user_id: User making the request
            config_id: LLM configuration used
            request_data: Request details and parameters
            response_data: Response content and metadata
            performance_data: Timing and performance metrics
            session_id: Session identifier (optional)
            request_id: Unique request identifier (optional)
            ip_address: Client IP address (optional)
            user_agent: Client user agent (optional)
            final_response: ChatResponse object for quota recording (optional)
            bypass_quota: Whether quota was bypassed (optional)
            db_session: Database session for quota operations (optional)
            
        Returns:
            Dictionary with logging and quota results
        """
        results = {
            "usage_logging": {"success": False},
            "quota_recording": {"success": False}
        }
        
        # Log usage with isolated session
        try:
            self.logger.info(f"🔍 Starting isolated usage logging for user {user_id}, request_id {request_id}")
            
            await usage_service.log_llm_request_isolated(
                user_id=user_id,
                llm_config_id=config_id,
                request_data=request_data,
                response_data=response_data,
                performance_data=performance_data,
                session_id=session_id,
                request_id=request_id,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            cost_display = f"${final_response.cost:.4f}" if final_response and final_response.cost else "$0.0000"
            tokens = final_response.usage.get('total_tokens', 0) if final_response else 0
            
            self.logger.info(f"✅ Usage logging completed for user {user_id}: {tokens} tokens, {cost_display}")
            results["usage_logging"] = {"success": True}
            
        except Exception as logging_error:
            self.logger.error(f"❌ Failed to log usage (non-critical): {str(logging_error)}")
            import traceback
            self.logger.error(f"❌ Usage logging traceback: {traceback.format_exc()}")
            results["usage_logging"] = {"success": False, "error": str(logging_error)}
        
        # Record quota usage if applicable
        if final_response and not bypass_quota and db_session:
            try:
                self.logger.info(f"🎯 Starting quota recording for user {user_id}")
                
                quota_result = self.quota_manager.record_quota_usage_improved(
                    user_id, config_id, final_response, db_session
                )
                
                if quota_result["success"]:
                    self.logger.info(f"✅ Quota recording completed: {len(quota_result.get('updated_quotas', []))} quotas updated")
                
                results["quota_recording"] = quota_result
                
            except Exception as quota_error:
                self.logger.error(f"❌ Failed to record quota usage (non-critical): {str(quota_error)}")
                results["quota_recording"] = {"success": False, "error": str(quota_error)}
        
        return results
    
    async def log_streaming_usage_background(
        self,
        user_id: int,
        config_id: int,
        request_data: Dict[str, Any],
        response_data: Dict[str, Any],
        performance_data: Dict[str, Any],
        session_id: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        final_response: Optional[ChatResponse] = None,
        bypass_quota: bool = False,
        db_session = None
    ) -> None:
        """
        Background task for logging streaming LLM usage.
        
        This method runs as a background task to ensure logging doesn't block
        the streaming response to the client. Essential for maintaining
        responsive user experience while ensuring complete audit trails.
        
        Args:
            user_id: User making the request
            config_id: LLM configuration used
            request_data: Request details and parameters
            response_data: Response content and metadata
            performance_data: Timing and performance metrics
            session_id: Session identifier (optional)
            request_id: Unique request identifier (optional)
            ip_address: Client IP address (optional)
            user_agent: Client user agent (optional)
            final_response: ChatResponse object for quota recording (optional)
            bypass_quota: Whether quota was bypassed (optional)
            db_session: Database session for quota operations (optional)
        """
        try:
            self.logger.info(f"🚀 Background logging task started for streaming user {user_id}")
            
            # Use the comprehensive logging method
            results = await self.log_llm_request_with_quota(
                user_id=user_id,
                config_id=config_id,
                request_data=request_data,
                response_data=response_data,
                performance_data=performance_data,
                session_id=session_id,
                request_id=request_id,
                ip_address=ip_address,
                user_agent=user_agent,
                final_response=final_response,
                bypass_quota=bypass_quota,
                db_session=db_session
            )
            
            # Log summary of background task results
            usage_success = results["usage_logging"]["success"]
            quota_success = results["quota_recording"]["success"]
            
            self.logger.info(
                f"🎉 Background logging completed for user {user_id}: "
                f"usage_logged={usage_success}, quota_recorded={quota_success}"
            )
            
        except Exception as e:
            self.logger.error(f"❌ Background logging task failed for user {user_id}: {str(e)}")
            import traceback
            self.logger.error(f"❌ Background logging traceback: {traceback.format_exc()}")
    
    def create_request_data(
        self,
        messages: list,
        parameters: Dict[str, Any],
        streaming: bool = False
    ) -> Dict[str, Any]:
        """
        Create standardized request data for logging.
        
        Args:
            messages: List of chat messages
            parameters: Request parameters (temperature, max_tokens, etc.)
            streaming: Whether this is a streaming request
            
        Returns:
            Standardized request data dictionary
        """
        total_chars = sum(len(msg.get("content", "")) for msg in messages)
        
        return {
            "messages_count": len(messages),
            "total_chars": total_chars,
            "streaming": streaming,
            "parameters": parameters
        }
    
    def create_performance_data(
        self,
        request_started_at: datetime,
        request_completed_at: Optional[datetime] = None,
        response_time_ms: Optional[int] = None,
        streaming: bool = False,
        chunks_sent: int = 0,
        error_during_streaming: bool = False
    ) -> Dict[str, Any]:
        """
        Create standardized performance data for logging.
        
        Args:
            request_started_at: When the request started
            request_completed_at: When the request completed (optional)
            response_time_ms: Response time in milliseconds (optional)
            streaming: Whether this was a streaming request
            chunks_sent: Number of chunks sent (for streaming)
            error_during_streaming: Whether error occurred during streaming
            
        Returns:
            Standardized performance data dictionary
        """
        data = {
            "request_started_at": request_started_at.isoformat(),
            "streaming": streaming
        }
        
        if request_completed_at:
            data["request_completed_at"] = request_completed_at.isoformat()
        
        if response_time_ms is not None:
            data["response_time_ms"] = response_time_ms
        
        if streaming:
            data["chunks_sent"] = chunks_sent
            data["error_during_streaming"] = error_during_streaming
        
        return data
    
    def create_success_response_data(
        self,
        response: ChatResponse,
        streaming: bool = False,
        chunks_sent: int = 0,
        quota_check_passed: bool = False,
        quota_details: Dict = None
    ) -> Dict[str, Any]:
        """
        Create standardized success response data for logging.
        
        Args:
            response: ChatResponse object
            streaming: Whether this was a streaming response
            chunks_sent: Number of chunks sent (for streaming)
            quota_check_passed: Whether quota check passed
            quota_details: Quota check details
            
        Returns:
            Standardized response data dictionary
        """
        return {
            "success": True,
            "content": response.content,
            "content_length": len(response.content),
            "model": response.model,
            "provider": response.provider,
            "token_usage": response.usage,
            "cost": response.cost,
            "error_type": None,
            "error_message": None,
            "http_status_code": 200,
            "streaming": streaming,
            "chunks_sent": chunks_sent if streaming else None,
            "raw_metadata": response.raw_response or {},
            "quota_check_passed": quota_check_passed,
            "quota_details": quota_details or {}
        }
    
    def create_error_response_data(
        self,
        error: Exception,
        model: str,
        provider: str,
        streaming: bool = False,
        chunks_sent: int = 0,
        partial_content: str = "",
        quota_check_passed: bool = False,
        quota_details: Dict = None
    ) -> Dict[str, Any]:
        """
        Create standardized error response data for logging.
        
        Args:
            error: Exception that occurred
            model: Model that was being used
            provider: Provider that was being used
            streaming: Whether this was a streaming request
            chunks_sent: Number of chunks sent before error
            partial_content: Partial content received before error
            quota_check_passed: Whether quota check passed
            quota_details: Quota check details
            
        Returns:
            Standardized error response data dictionary
        """
        # Determine error type and status code
        error_type = type(error).__name__
        http_status_code = None
        
        from .exceptions import LLMProviderError, LLMDepartmentQuotaExceededError
        
        if isinstance(error, LLMProviderError):
            http_status_code = error.status_code
        elif isinstance(error, LLMDepartmentQuotaExceededError):
            http_status_code = 429  # Too Many Requests
        
        return {
            "success": False,
            "content": partial_content,
            "content_length": len(partial_content),
            "model": model,
            "provider": provider,
            "token_usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
            "cost": None,
            "error_type": error_type,
            "error_message": str(error),
            "http_status_code": http_status_code,
            "streaming": streaming,
            "chunks_sent": chunks_sent if streaming else None,
            "partial_response": len(partial_content) > 0,
            "raw_metadata": {},
            "quota_check_passed": quota_check_passed,
            "quota_details": quota_details or {}
        }


# Global usage logger instance (singleton pattern)
_usage_logger = None

def get_usage_logger() -> LLMUsageLogger:
    """
    Get the global usage logger instance.
    
    Returns:
        Singleton usage logger instance
    """
    global _usage_logger
    if _usage_logger is None:
        _usage_logger = LLMUsageLogger()
    return _usage_logger


# Export usage logger classes and functions
__all__ = [
    'LLMUsageLogger',
    'get_usage_logger'
]
