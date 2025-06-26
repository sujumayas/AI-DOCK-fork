# AI Dock LLM Request Logger
# Atomic component for coordinating request logging activities

from typing import Dict, Any, Optional
import logging
from datetime import datetime

from ..usage_logger import get_usage_logger
from ..models import ChatResponse


class RequestLogger:
    """
    Atomic component responsible for coordinating request logging activities.
    
    Single Responsibility:
    - Coordinate between different logging components
    - Provide unified logging interface for handlers
    - Handle logging metadata and formatting
    """
    
    def __init__(self):
        """Initialize request logger with dependencies."""
        self.usage_logger = get_usage_logger()
        self.logger = logging.getLogger(__name__)
    
    async def log_successful_request(
        self,
        user_id: int,
        config_id: int,
        request_data: Dict,
        response: ChatResponse,
        performance_data: Dict,
        session_id: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        quota_check_result = None,
        bypass_quota: bool = False,
        db_session = None,
        additional_metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Log a successful request with comprehensive metadata.
        
        Args:
            user_id: User making the request
            config_id: Configuration used
            request_data: Request data dictionary
            response: ChatResponse from provider
            performance_data: Performance metrics
            session_id: Session identifier
            request_id: Request identifier
            ip_address: Client IP address
            user_agent: Client user agent
            quota_check_result: Result from quota checking
            bypass_quota: Whether quota was bypassed
            db_session: Database session
            additional_metadata: Optional additional metadata
        """
        try:
            # Prepare response data for logging
            response_data = self.usage_logger.create_success_response_data(
                response,
                quota_check_passed=quota_check_result is not None,
                quota_details=quota_check_result.quota_details if quota_check_result else {}
            )
            
            # Add additional metadata if provided
            if additional_metadata:
                response_data.update(additional_metadata)
            
            # Log through usage logger
            await self.usage_logger.log_llm_request_with_quota(
                user_id, config_id, request_data, response_data, performance_data,
                session_id, request_id, ip_address, user_agent, response, bypass_quota, db_session
            )
            
            self.logger.debug(f"Successfully logged request for user {user_id}")
            
        except Exception as e:
            self.logger.error(f"Failed to log successful request: {str(e)}")
    
    async def log_failed_request(
        self,
        error: Exception,
        user_id: int,
        config_id: int,
        request_data: Dict,
        performance_data: Dict,
        model: Optional[str] = None,
        provider_name: Optional[str] = None,
        session_id: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        quota_check_result = None,
        additional_context: Optional[Dict[str, Any]] = None
    ):
        """
        Log a failed request with error details.
        
        Args:
            error: Exception that occurred
            user_id: User making the request
            config_id: Configuration used
            request_data: Request data dictionary
            performance_data: Performance metrics
            model: Model that was used
            provider_name: Provider name
            session_id: Session identifier
            request_id: Request identifier
            ip_address: Client IP address
            user_agent: Client user agent
            quota_check_result: Result from quota checking
            additional_context: Optional additional context
        """
        try:
            # Update performance data with completion time
            performance_data.update({
                "request_completed_at": datetime.utcnow().isoformat(),
                "response_time_ms": int(
                    (datetime.utcnow() - datetime.fromisoformat(performance_data["request_started_at"]))
                    .total_seconds() * 1000
                )
            })
            
            # Create error response data
            response_data = self.usage_logger.create_error_response_data(
                error,
                model,
                provider_name,
                quota_check_passed=False,
                quota_details=quota_check_result.quota_details if quota_check_result else {}
            )
            
            # Add additional context if provided
            if additional_context:
                response_data.update(additional_context)
            
            # Log through usage logger
            await self.usage_logger.log_llm_request_with_quota(
                user_id, config_id, request_data, response_data, performance_data,
                session_id, request_id, ip_address, user_agent
            )
            
            self.logger.debug(f"Successfully logged failed request for user {user_id}")
            
        except Exception as logging_error:
            self.logger.error(f"Failed to log failed request: {str(logging_error)}")
    
    async def log_streaming_request(
        self,
        user_id: int,
        config_id: int,
        request_data: Dict,
        final_response: Optional[ChatResponse],
        performance_data: Dict,
        session_id: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        quota_check_result = None,
        bypass_quota: bool = False,
        db_session = None,
        chunk_count: int = 0,
        streaming_metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Log a streaming request with streaming-specific metadata.
        
        Args:
            user_id: User making the request
            config_id: Configuration used
            request_data: Request data dictionary
            final_response: Final response (None for failed requests)
            performance_data: Performance metrics
            session_id: Session identifier
            request_id: Request identifier
            ip_address: Client IP address
            user_agent: Client user agent
            quota_check_result: Result from quota checking
            bypass_quota: Whether quota was bypassed
            db_session: Database session
            chunk_count: Number of chunks sent
            streaming_metadata: Streaming-specific metadata
        """
        try:
            if final_response:
                # Successful streaming request
                response_data = self.usage_logger.create_success_response_data(
                    final_response,
                    streaming=True,
                    chunks_sent=chunk_count,
                    quota_check_passed=quota_check_result is not None,
                    quota_details=quota_check_result.quota_details if quota_check_result else {}
                )
            else:
                # Failed streaming request - create error response data
                response_data = {
                    "success": False,
                    "streaming": True,
                    "chunks_sent": chunk_count,
                    "quota_check_passed": False
                }
            
            # Add streaming metadata if provided
            if streaming_metadata:
                response_data.update(streaming_metadata)
            
            # Log through usage logger's streaming method
            await self.usage_logger.log_streaming_usage_background(
                user_id, config_id, request_data, response_data, performance_data,
                session_id, request_id, ip_address, user_agent, final_response, bypass_quota, db_session
            )
            
            self.logger.debug(f"Successfully logged streaming request for user {user_id}")
            
        except Exception as e:
            self.logger.error(f"Failed to log streaming request: {str(e)}")
    
    def create_request_metadata(
        self,
        request_id: Optional[str] = None,
        session_id: Optional[str] = None,
        user_id: Optional[int] = None,
        config_id: Optional[int] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create standardized request metadata.
        
        Args:
            request_id: Unique request identifier
            session_id: Session identifier
            user_id: User making the request
            config_id: Configuration used
            additional_data: Optional additional metadata
            
        Returns:
            Dictionary with standardized metadata structure
        """
        metadata = {
            "request_metadata": {
                "request_id": request_id,
                "session_id": session_id,
                "user_id": user_id,
                "config_id": config_id,
                "logged_at": datetime.utcnow().isoformat()
            }
        }
        
        if additional_data:
            metadata["request_metadata"].update(additional_data)
        
        return metadata
    
    def create_performance_snapshot(
        self,
        start_time: datetime,
        end_time: Optional[datetime] = None,
        additional_metrics: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create performance metrics snapshot.
        
        Args:
            start_time: Request start time
            end_time: Request end time (defaults to now)
            additional_metrics: Optional additional performance metrics
            
        Returns:
            Dictionary with performance metrics
        """
        if end_time is None:
            end_time = datetime.utcnow()
        
        performance_data = {
            "request_started_at": start_time.isoformat(),
            "request_completed_at": end_time.isoformat(),
            "response_time_ms": int((end_time - start_time).total_seconds() * 1000)
        }
        
        if additional_metrics:
            performance_data.update(additional_metrics)
        
        return performance_data


# Factory function for dependency injection
def get_request_logger() -> RequestLogger:
    """
    Get request logger instance.
    
    Returns:
        RequestLogger instance
    """
    return RequestLogger()
