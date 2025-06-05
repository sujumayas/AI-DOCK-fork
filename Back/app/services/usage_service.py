# AI Dock Usage Service
# This service handles creation and management of usage logs for LLM interactions

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

# Import our models and dependencies
from ..models.usage_log import UsageLog
from ..models.user import User
from ..models.department import Department
from ..models.llm_config import LLMConfiguration
from ..core.database import get_async_session

class UsageService:
    """
    Usage Service - The "Accountant" for AI Dock
    
    This service is responsible for:
    - Creating usage logs for every LLM interaction
    - Calculating costs and tracking token usage
    - Providing analytics and reporting data
    - Managing quota enforcement (future)
    
    Think of this as the "accountant" that keeps track of who spent what,
    when they spent it, and how much it cost the company.
    
    Design Principles:
    - Non-blocking: Usage logging should never slow down chat responses
    - Resilient: If logging fails, the chat should still work
    - Comprehensive: Capture everything needed for billing and analytics
    - Fast: Optimized for high-volume logging without performance impact
    """
    
    def __init__(self):
        """Initialize the usage service."""
        self.logger = logging.getLogger(__name__)
    
    # =============================================================================
    # CORE LOGGING METHODS
    # =============================================================================
    
    async def log_llm_request(
        self,
        user_id: int,
        llm_config_id: int,
        request_data: Dict[str, Any],
        response_data: Dict[str, Any],
        performance_data: Dict[str, Any],
        session_id: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> UsageLog:
        """
        Create a usage log entry for an LLM request.
        
        This is the main method that gets called after every LLM interaction.
        It captures all the important details we need for tracking and billing.
        
        Args:
            user_id: ID of user who made the request
            llm_config_id: ID of LLM configuration used
            request_data: Information about the request sent to LLM
            response_data: Information about the LLM response
            performance_data: Timing and performance metrics
            session_id: Optional session identifier for grouping requests
            request_id: Optional unique request identifier for tracing
            ip_address: Client IP address
            user_agent: Client user agent string
            
        Returns:
            Created UsageLog object
            
        Request Data Format:
        {
            "messages_count": 3,
            "total_chars": 150,
            "parameters": {"temperature": 0.7, "max_tokens": 1000},
            "model_override": "gpt-4-turbo"
        }
        
        Response Data Format:
        {
            "success": True,
            "content": "AI response text...",
            "content_length": 245,
            "model": "gpt-4",
            "provider": "OpenAI",
            "token_usage": {
                "input_tokens": 120,
                "output_tokens": 85,
                "total_tokens": 205
            },
            "cost": 0.0041,
            "error_type": None,
            "error_message": None,
            "http_status_code": 200,
            "raw_metadata": {"openai_request_id": "req_123"}
        }
        
        Performance Data Format:
        {
            "request_started_at": "2024-01-01T12:00:00Z",
            "request_completed_at": "2024-01-01T12:00:02Z", 
            "response_time_ms": 2150
        }
        """
        
        # Get database session
        async with get_async_session() as session:
            try:
                # Load user and related data
                user = await self._get_user_with_details(session, user_id)
                if not user:
                    self.logger.error(f"User {user_id} not found for usage logging")
                    # Create a minimal log entry even if user lookup fails
                    return await self._create_minimal_usage_log(
                        session, user_id, llm_config_id, request_data, response_data, performance_data
                    )
                
                # Load LLM configuration
                llm_config = await session.get(LLMConfiguration, llm_config_id)
                if not llm_config:
                    self.logger.error(f"LLM configuration {llm_config_id} not found for usage logging")
                    # Continue anyway - we can still log most of the data
                
                # Parse request data
                messages_count = request_data.get("messages_count", 0)
                total_chars = request_data.get("total_chars", 0)
                request_parameters = request_data.get("parameters", {})
                
                # Parse response data
                success = response_data.get("success", False)
                content_length = response_data.get("content_length", 0)
                model = response_data.get("model", "unknown")
                provider = response_data.get("provider", "unknown")
                token_usage = response_data.get("token_usage", {})
                cost = response_data.get("cost")
                error_type = response_data.get("error_type")
                error_message = response_data.get("error_message")
                http_status_code = response_data.get("http_status_code")
                raw_metadata = response_data.get("raw_metadata", {})
                
                # Parse performance data
                request_started_at = None
                request_completed_at = None
                if performance_data.get("request_started_at"):
                    request_started_at = datetime.fromisoformat(
                        performance_data["request_started_at"].replace("Z", "+00:00")
                    )
                if performance_data.get("request_completed_at"):
                    request_completed_at = datetime.fromisoformat(
                        performance_data["request_completed_at"].replace("Z", "+00:00")
                    )
                
                response_time_ms = performance_data.get("response_time_ms")
                
                # Get response preview (first 500 chars)
                response_content = response_data.get("content", "")
                response_preview = response_content[:500] if response_content else None
                
                # Create usage log entry
                usage_log = UsageLog(
                    # User and context
                    user_id=user.id,
                    department_id=user.department_id,
                    user_email=user.email,
                    user_role=user.role.name if user.role else "unknown",
                    
                    # LLM configuration
                    llm_config_id=llm_config_id,
                    llm_config_name=llm_config.name if llm_config else "unknown",
                    provider=provider,
                    model=model,
                    
                    # Request details
                    request_messages_count=messages_count,
                    request_total_chars=total_chars,
                    request_parameters=request_parameters,
                    
                    # Token usage
                    input_tokens=token_usage.get("input_tokens", 0),
                    output_tokens=token_usage.get("output_tokens", 0),
                    total_tokens=token_usage.get("total_tokens", 0),
                    
                    # Cost tracking
                    estimated_cost=cost,
                    actual_cost=None,  # Will be filled in later if available
                    cost_currency="USD",
                    
                    # Performance metrics
                    response_time_ms=response_time_ms,
                    request_started_at=request_started_at,
                    request_completed_at=request_completed_at,
                    
                    # Success/failure tracking
                    success=success,
                    error_type=error_type,
                    error_message=error_message,
                    http_status_code=http_status_code,
                    
                    # Response details
                    response_content_length=content_length,
                    response_preview=response_preview,
                    
                    # Metadata
                    session_id=session_id,
                    request_id=request_id,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    raw_response_metadata=raw_metadata
                )
                
                # Save to database
                session.add(usage_log)
                await session.commit()
                
                self.logger.info(
                    f"Usage logged: user={user.email}, provider={provider}, "
                    f"model={model}, tokens={usage_log.total_tokens}, "
                    f"cost=${cost:.4f if cost else 0:.4f}, success={success}"
                )
                
                return usage_log
                
            except Exception as e:
                self.logger.error(f"Failed to log usage: {str(e)}", exc_info=True)
                await session.rollback()
                
                # Create a minimal log entry so we don't lose the data completely
                try:
                    return await self._create_minimal_usage_log(
                        session, user_id, llm_config_id, request_data, response_data, performance_data
                    )
                except Exception as fallback_error:
                    self.logger.error(f"Failed to create fallback usage log: {str(fallback_error)}")
                    raise e  # Re-raise original error
    
    async def _get_user_with_details(self, session: AsyncSession, user_id: int) -> Optional[User]:
        """
        Get user with related role and department data loaded.
        
        This uses SQLAlchemy's selectinload to efficiently load related data
        in a single query rather than making multiple database round trips.
        """
        try:
            query = select(User).options(
                selectinload(User.role),
                selectinload(User.department)
            ).where(User.id == user_id)
            
            result = await session.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            self.logger.error(f"Error loading user {user_id}: {str(e)}")
            return None
    
    async def _create_minimal_usage_log(
        self,
        session: AsyncSession,
        user_id: int,
        llm_config_id: int,
        request_data: Dict[str, Any],
        response_data: Dict[str, Any],
        performance_data: Dict[str, Any]
    ) -> UsageLog:
        """
        Create a minimal usage log when full logging fails.
        
        This ensures we don't lose critical data even if there are
        database issues or missing related records.
        """
        usage_log = UsageLog(
            user_id=user_id,
            department_id=None,
            user_email="unknown",
            user_role="unknown",
            llm_config_id=llm_config_id,
            llm_config_name="unknown",
            provider=response_data.get("provider", "unknown"),
            model=response_data.get("model", "unknown"),
            request_messages_count=request_data.get("messages_count", 0),
            request_total_chars=request_data.get("total_chars", 0),
            input_tokens=response_data.get("token_usage", {}).get("input_tokens", 0),
            output_tokens=response_data.get("token_usage", {}).get("output_tokens", 0),
            total_tokens=response_data.get("token_usage", {}).get("total_tokens", 0),
            estimated_cost=response_data.get("cost"),
            response_time_ms=performance_data.get("response_time_ms"),
            success=response_data.get("success", False),
            error_type=response_data.get("error_type"),
            error_message="Minimal log due to logging error",
            response_content_length=response_data.get("content_length", 0)
        )
        
        session.add(usage_log)
        await session.commit()
        
        self.logger.warning(f"Created minimal usage log for user {user_id}")
        return usage_log
    
    # =============================================================================
    # ASYNC LOGGING (NON-BLOCKING)
    # =============================================================================
    
    async def log_llm_request_async(
        self,
        user_id: int,
        llm_config_id: int,
        request_data: Dict[str, Any],
        response_data: Dict[str, Any],
        performance_data: Dict[str, Any],
        **kwargs
    ) -> None:
        """
        Log an LLM request asynchronously without blocking the main thread.
        
        This is useful when you want to log usage but don't want to wait
        for the database operation to complete. The chat response can be
        returned immediately while logging happens in the background.
        
        Use this method when:
        - You want fast response times for users
        - Logging failures shouldn't affect the user experience
        - You don't need the UsageLog object returned immediately
        """
        try:
            # Create a background task for logging
            asyncio.create_task(
                self.log_llm_request(
                    user_id=user_id,
                    llm_config_id=llm_config_id,
                    request_data=request_data,
                    response_data=response_data,
                    performance_data=performance_data,
                    **kwargs
                )
            )
        except Exception as e:
            # Log error but don't raise - this should never break the main flow
            self.logger.error(f"Failed to create async logging task: {str(e)}")
    
    # =============================================================================
    # ANALYTICS AND REPORTING METHODS
    # =============================================================================
    
    async def get_user_usage_summary(
        self,
        user_id: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get usage summary for a specific user.
        
        Args:
            user_id: User to get summary for
            start_date: Start of period (defaults to beginning of current month)
            end_date: End of period (defaults to now)
            
        Returns:
            Dictionary with usage statistics
        """
        if not start_date:
            start_date = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if not end_date:
            end_date = datetime.utcnow()
        
        async with get_async_session() as session:
            # Base query for user's usage logs in date range
            base_query = select(UsageLog).where(
                and_(
                    UsageLog.user_id == user_id,
                    UsageLog.created_at >= start_date,
                    UsageLog.created_at <= end_date
                )
            )
            
            # Get total counts
            total_requests_query = select(func.count(UsageLog.id)).where(
                and_(
                    UsageLog.user_id == user_id,
                    UsageLog.created_at >= start_date,
                    UsageLog.created_at <= end_date
                )
            )
            
            successful_requests_query = select(func.count(UsageLog.id)).where(
                and_(
                    UsageLog.user_id == user_id,
                    UsageLog.created_at >= start_date,
                    UsageLog.created_at <= end_date,
                    UsageLog.success == True
                )
            )
            
            # Get token and cost totals
            totals_query = select(
                func.sum(UsageLog.total_tokens).label('total_tokens'),
                func.sum(UsageLog.input_tokens).label('input_tokens'),
                func.sum(UsageLog.output_tokens).label('output_tokens'),
                func.sum(UsageLog.estimated_cost).label('total_cost'),
                func.avg(UsageLog.response_time_ms).label('avg_response_time'),
                func.max(UsageLog.response_time_ms).label('max_response_time')
            ).where(
                and_(
                    UsageLog.user_id == user_id,
                    UsageLog.created_at >= start_date,
                    UsageLog.created_at <= end_date,
                    UsageLog.success == True
                )
            )
            
            # Execute queries
            total_requests = await session.execute(total_requests_query)
            successful_requests = await session.execute(successful_requests_query)
            totals = await session.execute(totals_query)
            
            total_count = total_requests.scalar() or 0
            success_count = successful_requests.scalar() or 0
            totals_row = totals.first()
            
            return {
                "user_id": user_id,
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                },
                "requests": {
                    "total": total_count,
                    "successful": success_count,
                    "failed": total_count - success_count,
                    "success_rate": (success_count / total_count * 100) if total_count > 0 else 0
                },
                "tokens": {
                    "total": int(totals_row.total_tokens or 0),
                    "input": int(totals_row.input_tokens or 0),
                    "output": int(totals_row.output_tokens or 0)
                },
                "cost": {
                    "total_usd": float(totals_row.total_cost or 0),
                    "average_per_request": float(totals_row.total_cost or 0) / success_count if success_count > 0 else 0
                },
                "performance": {
                    "average_response_time_ms": int(totals_row.avg_response_time or 0),
                    "max_response_time_ms": int(totals_row.max_response_time or 0)
                }
            }
    
    async def get_department_usage_summary(
        self,
        department_id: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get usage summary for a specific department.
        
        This is crucial for quota management and departmental billing.
        """
        if not start_date:
            start_date = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if not end_date:
            end_date = datetime.utcnow()
        
        async with get_async_session() as session:
            # Similar to user summary but filtered by department
            totals_query = select(
                func.count(UsageLog.id).label('total_requests'),
                func.sum(UsageLog.total_tokens).label('total_tokens'),
                func.sum(UsageLog.estimated_cost).label('total_cost'),
                func.count(UsageLog.id).filter(UsageLog.success == True).label('successful_requests'),
                func.avg(UsageLog.response_time_ms).label('avg_response_time')
            ).where(
                and_(
                    UsageLog.department_id == department_id,
                    UsageLog.created_at >= start_date,
                    UsageLog.created_at <= end_date
                )
            )
            
            result = await session.execute(totals_query)
            totals_row = result.first()
            
            total_requests = totals_row.total_requests or 0
            successful_requests = totals_row.successful_requests or 0
            
            return {
                "department_id": department_id,
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                },
                "requests": {
                    "total": total_requests,
                    "successful": successful_requests,
                    "failed": total_requests - successful_requests,
                    "success_rate": (successful_requests / total_requests * 100) if total_requests > 0 else 0
                },
                "tokens": {
                    "total": int(totals_row.total_tokens or 0)
                },
                "cost": {
                    "total_usd": float(totals_row.total_cost or 0),
                    "average_per_request": float(totals_row.total_cost or 0) / successful_requests if successful_requests > 0 else 0
                },
                "performance": {
                    "average_response_time_ms": int(totals_row.avg_response_time or 0)
                }
            }
    
    async def get_provider_usage_stats(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get usage statistics by LLM provider.
        
        Useful for understanding which providers are most popular
        and comparing their performance and costs.
        """
        if not start_date:
            start_date = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if not end_date:
            end_date = datetime.utcnow()
        
        async with get_async_session() as session:
            provider_stats_query = select(
                UsageLog.provider,
                func.count(UsageLog.id).label('total_requests'),
                func.sum(UsageLog.total_tokens).label('total_tokens'),
                func.sum(UsageLog.estimated_cost).label('total_cost'),
                func.avg(UsageLog.response_time_ms).label('avg_response_time'),
                func.count(UsageLog.id).filter(UsageLog.success == True).label('successful_requests')
            ).where(
                and_(
                    UsageLog.created_at >= start_date,
                    UsageLog.created_at <= end_date
                )
            ).group_by(UsageLog.provider)
            
            result = await session.execute(provider_stats_query)
            providers = result.fetchall()
            
            provider_stats = []
            for provider in providers:
                total_requests = provider.total_requests or 0
                successful_requests = provider.successful_requests or 0
                
                provider_stats.append({
                    "provider": provider.provider,
                    "requests": {
                        "total": total_requests,
                        "successful": successful_requests,
                        "success_rate": (successful_requests / total_requests * 100) if total_requests > 0 else 0
                    },
                    "tokens": {
                        "total": int(provider.total_tokens or 0)
                    },
                    "cost": {
                        "total_usd": float(provider.total_cost or 0),
                        "average_per_request": float(provider.total_cost or 0) / successful_requests if successful_requests > 0 else 0
                    },
                    "performance": {
                        "average_response_time_ms": int(provider.avg_response_time or 0)
                    }
                })
            
            return provider_stats
    
    # =============================================================================
    # QUOTA ENFORCEMENT HELPERS (FOR AID-005-B)
    # =============================================================================
    
    async def check_user_quota_status(
        self,
        user_id: int,
        period_days: int = 30
    ) -> Dict[str, Any]:
        """
        Check current quota usage for a user.
        
        This will be expanded in AID-005-B for quota enforcement.
        """
        start_date = datetime.utcnow() - timedelta(days=period_days)
        end_date = datetime.utcnow()
        
        summary = await self.get_user_usage_summary(user_id, start_date, end_date)
        
        return {
            "user_id": user_id,
            "period_days": period_days,
            "current_usage": summary,
            "quota_status": "within_limits",  # Will be calculated based on actual quotas in AID-005-B
            "quota_remaining": None,  # Will be calculated in AID-005-B
            "quota_utilization_percent": 0  # Will be calculated in AID-005-B
        }
    
    async def check_department_quota_status(
        self,
        department_id: int,
        period_days: int = 30
    ) -> Dict[str, Any]:
        """
        Check current quota usage for a department.
        
        This will be expanded in AID-005-B for quota enforcement.
        """
        start_date = datetime.utcnow() - timedelta(days=period_days)
        end_date = datetime.utcnow()
        
        summary = await self.get_department_usage_summary(department_id, start_date, end_date)
        
        return {
            "department_id": department_id,
            "period_days": period_days,
            "current_usage": summary,
            "quota_status": "within_limits",  # Will be calculated in AID-005-B
            "quota_remaining": None,  # Will be calculated in AID-005-B
            "quota_utilization_percent": 0  # Will be calculated in AID-005-B
        }

# =============================================================================
# SERVICE INSTANCE
# =============================================================================

# Create global service instance
# This follows the same pattern as other services in our app
usage_service = UsageService()
