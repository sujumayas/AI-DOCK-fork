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
from ..core.database import AsyncSessionLocal

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
        
        FIXED: Prevents duplicate logging by tracking success state properly.
        """
        
        # DEDUPLICATION: Check if this request has already been logged
        if request_id:
            async with AsyncSessionLocal() as check_session:
                try:
                    existing_log_result = await check_session.execute(
                        select(UsageLog).where(UsageLog.request_id == request_id)
                    )
                    existing_log = existing_log_result.scalar_one_or_none()
                    if existing_log:
                        self.logger.info(f"Request {request_id} already logged - returning existing log ID {existing_log.id}")
                        return existing_log
                except Exception as dedup_error:
                    self.logger.warning(f"Deduplication check failed: {str(dedup_error)}")
        
        # Track whether we successfully created the main log
        main_log_created = False
        main_log = None
        
        # Get database session for main logging
        async with AsyncSessionLocal() as session:
            try:
                self.logger.debug(f"Starting usage log creation for user {user_id}, request {request_id}")
                
                # Load user and related data with better error handling
                user = await self._get_user_with_details(session, user_id)
                user_email = "unknown"
                user_role = "unknown"
                department_id = None
                
                if user:
                    user_email = user.email
                    user_role = user.role.name if user.role else "unknown"
                    department_id = user.department_id
                    self.logger.debug(f"User lookup successful: {user_email}")
                else:
                    self.logger.warning(f"User {user_id} not found for logging - using placeholder")
                
                # Load LLM configuration
                llm_config = await session.get(LLMConfiguration, llm_config_id)
                if not llm_config:
                    self.logger.warning(f"LLM configuration {llm_config_id} not found for usage logging")
                
                # Parse all the data safely
                messages_count = request_data.get("messages_count", 0)
                total_chars = request_data.get("total_chars", 0)
                request_parameters = request_data.get("parameters", {})
                
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
                
                # Parse performance data safely
                request_started_at = None
                request_completed_at = None
                try:
                    if performance_data.get("request_started_at"):
                        request_started_at = datetime.fromisoformat(
                            performance_data["request_started_at"].replace("Z", "+00:00")
                        )
                    if performance_data.get("request_completed_at"):
                        request_completed_at = datetime.fromisoformat(
                            performance_data["request_completed_at"].replace("Z", "+00:00")
                        )
                except Exception as time_error:
                    self.logger.warning(f"Failed to parse timestamps: {str(time_error)}")
                
                response_time_ms = performance_data.get("response_time_ms")
                
                # Get response preview safely
                response_content = response_data.get("content", "")
                response_preview = response_content[:500] if response_content else None
                
                # Create usage log entry
                usage_log = UsageLog(
                    # User and context
                    user_id=user_id,
                    department_id=department_id,
                    user_email=user_email,
                    user_role=user_role,
                    
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
                    actual_cost=None,
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
                
                # Mark successful creation BEFORE any potential errors
                main_log_created = True
                main_log = usage_log
                
                self.logger.info(
                    f"Usage logged successfully: user={user_email}, provider={provider}, "
                    f"model={model}, tokens={usage_log.total_tokens}, "
                    f"cost=${cost:.4f if cost else 0:.4f}, success={success}, "
                    f"request_id={request_id}, log_id={usage_log.id}"
                )
                
                return usage_log
                
            except Exception as main_error:
                self.logger.error(f"Main logging failed for user {user_id}: {str(main_error)}", exc_info=True)
                await session.rollback()
                
                # Only create emergency log if main log was NOT successfully created
                if not main_log_created:
                    try:
                        self.logger.warning(f"Creating emergency log for user {user_id} due to main logging failure")
                        
                        # Use a NEW session for emergency logging
                        async with AsyncSessionLocal() as emergency_session:
                            emergency_log = UsageLog(
                                user_id=user_id,
                                department_id=None,
                                user_email="error_fallback",
                                user_role="unknown",
                                llm_config_id=llm_config_id,
                                llm_config_name="unknown",
                                provider=response_data.get("provider", "unknown"),
                                model=response_data.get("model", "unknown"),
                                request_messages_count=request_data.get("messages_count", 0),
                                total_tokens=response_data.get("token_usage", {}).get("total_tokens", 0),
                                estimated_cost=response_data.get("cost"),
                                success=response_data.get("success", False),
                                error_type="logging_error",
                                error_message=f"Emergency log due to: {str(main_error)}",
                                request_id=request_id,
                                session_id=session_id
                            )
                            emergency_session.add(emergency_log)
                            await emergency_session.commit()
                            
                            self.logger.warning(f"Emergency log created for user {user_id}, request_id={request_id}, log_id={emergency_log.id}")
                            return emergency_log
                            
                    except Exception as emergency_error:
                        self.logger.error(f"Emergency logging also failed: {str(emergency_error)}")
                        raise main_error  # Re-raise the original error
                else:
                    # Main log was successfully created, don't create emergency log
                    self.logger.info(f"Main log was successful, not creating emergency log for request {request_id}")
                    return main_log
    
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
    
    # Removed _create_minimal_usage_log method to prevent duplicate logging
    # Emergency logging is now handled inline within log_llm_request method
    
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
        
        IMPROVED: Better error handling and duplicate prevention.
        
        This is useful when you want to log usage but don't want to wait
        for the database operation to complete. The chat response can be
        returned immediately while logging happens in the background.
        
        Use this method when:
        - You want fast response times for users
        - Logging failures shouldn't affect the user experience
        - You don't need the UsageLog object returned immediately
        """
        request_id = kwargs.get('request_id')
        
        try:
            # Add detailed logging for debugging
            if request_id:
                self.logger.debug(f"Creating async logging task for user {user_id}, request {request_id}")
            else:
                self.logger.warning(f"Async logging for user {user_id} has no request_id - potential for duplicates")
            
            # Create a background task for logging with better error handling
            async def safe_log_task():
                try:
                    result = await self.log_llm_request(
                        user_id=user_id,
                        llm_config_id=llm_config_id,
                        request_data=request_data,
                        response_data=response_data,
                        performance_data=performance_data,
                        **kwargs
                    )
                    self.logger.debug(f"Async logging completed for request {request_id}, log_id={result.id if result else 'none'}")
                    return result
                except Exception as task_error:
                    self.logger.error(f"Async logging task failed for user {user_id}, request {request_id}: {str(task_error)}")
                    # Don't re-raise - this is a background task
                    return None
            
            # Create and start the task
            task = asyncio.create_task(safe_log_task())
            
            # Optional: Add a simple done callback for monitoring
            def log_completion(completed_task):
                try:
                    result = completed_task.result()
                    if result:
                        self.logger.debug(f"Async logging task completed successfully for request {request_id}")
                    else:
                        self.logger.warning(f"Async logging task completed with no result for request {request_id}")
                except Exception as callback_error:
                    self.logger.error(f"Error in async logging completion callback: {str(callback_error)}")
            
            task.add_done_callback(log_completion)
            
        except Exception as e:
            # Log error but don't raise - this should never break the main flow
            self.logger.error(f"Failed to create async logging task for user {user_id}: {str(e)}")
    
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
        
        async with AsyncSessionLocal() as session:
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
        
        async with AsyncSessionLocal() as session:
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
        
        async with AsyncSessionLocal() as session:
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

# Debug information for troubleshooting
logging.getLogger(__name__).info("Usage service initialized with duplicate logging prevention")
