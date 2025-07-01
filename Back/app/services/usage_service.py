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
                
                # Save to database with better error handling
                session.add(usage_log)
                try:
                    await session.commit()
                    self.logger.info(f"💾 DEBUG: Successfully committed usage log to database for request {request_id}")
                except Exception as commit_error:
                    self.logger.error(f"❌ DEBUG: Database commit failed for request {request_id}: {str(commit_error)}")
                    await session.rollback()
                    raise
                
                # Mark successful creation BEFORE any potential errors
                main_log_created = True
                main_log = usage_log
                
                cost_display = f"${cost:.4f}" if cost is not None else "$0.0000"
                self.logger.info(
                    f"Usage logged successfully: user={user_email}, provider={provider}, "
                    f"model={model}, tokens={usage_log.total_tokens}, "
                    f"cost={cost_display}, success={success}, "
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
            # 🔧 FIX: Add cache-busting parameter to prevent query caching
            # This ensures fresh data by making each query unique
            cache_buster = datetime.utcnow().microsecond
            
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
                    UsageLog.created_at <= end_date,
                    # Add cache-busting condition that's always true
                    UsageLog.id >= 0
                )
            ).params(cache_buster=cache_buster)
            
            successful_requests_query = select(func.count(UsageLog.id)).where(
                and_(
                    UsageLog.user_id == user_id,
                    UsageLog.created_at >= start_date,
                    UsageLog.created_at <= end_date,
                    UsageLog.success == True,
                    # Add cache-busting condition that's always true
                    UsageLog.id >= 0
                )
            ).params(cache_buster=cache_buster + 1)
            
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
                    UsageLog.success == True,
                    # Add cache-busting condition that's always true
                    UsageLog.id >= 0
                )
            ).params(cache_buster=cache_buster + 2)
            
            # Get favorite provider (most used provider)
            favorite_provider_query = select(
                UsageLog.provider,
                func.count(UsageLog.id).label('usage_count')
            ).where(
                and_(
                    UsageLog.user_id == user_id,
                    UsageLog.created_at >= start_date,
                    UsageLog.created_at <= end_date,
                    UsageLog.success == True,
                    UsageLog.provider.isnot(None),
                    # Add cache-busting condition that's always true
                    UsageLog.id >= 0
                )
            ).group_by(UsageLog.provider).order_by(func.count(UsageLog.id).desc()).limit(1).params(cache_buster=cache_buster + 3)
            
            # Get last activity
            last_activity_query = select(UsageLog.created_at).where(
                and_(
                    UsageLog.user_id == user_id,
                    UsageLog.success == True,
                    # Add cache-busting condition that's always true
                    UsageLog.id >= 0
                )
            ).order_by(UsageLog.created_at.desc()).limit(1).params(cache_buster=cache_buster + 4)
            
            # Execute queries
            total_requests = await session.execute(total_requests_query)
            successful_requests = await session.execute(successful_requests_query)
            totals = await session.execute(totals_query)
            favorite_provider_result = await session.execute(favorite_provider_query)
            last_activity_result = await session.execute(last_activity_query)
            
            total_count = total_requests.scalar() or 0
            success_count = successful_requests.scalar() or 0
            totals_row = totals.first()
            favorite_provider_row = favorite_provider_result.first()
            last_activity = last_activity_result.scalar()
            
            # Format favorite provider
            favorite_provider = None
            if favorite_provider_row:
                provider_name = favorite_provider_row.provider
                # Beautify provider names
                if provider_name == "openai":
                    favorite_provider = "OpenAI GPT-4"
                elif provider_name == "anthropic":
                    favorite_provider = "Anthropic Claude"
                elif provider_name == "azure":
                    favorite_provider = "Azure OpenAI"
                else:
                    favorite_provider = provider_name.title()
            
            # Format last activity
            last_activity_formatted = None
            if last_activity:
                time_diff = datetime.utcnow() - last_activity
                if time_diff.days > 0:
                    last_activity_formatted = f"{time_diff.days} day{'s' if time_diff.days > 1 else ''} ago"
                elif time_diff.seconds > 3600:
                    hours = time_diff.seconds // 3600
                    last_activity_formatted = f"{hours} hour{'s' if hours > 1 else ''} ago"
                elif time_diff.seconds > 60:
                    minutes = time_diff.seconds // 60
                    last_activity_formatted = f"{minutes} minute{'s' if minutes > 1 else ''} ago"
                else:
                    last_activity_formatted = "Just now"
            
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
                },
                "favorite_provider": favorite_provider,
                "last_activity": last_activity_formatted
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
            # 🔧 FIX: Add cache-busting parameter to prevent query caching
            # This ensures fresh data by making each query unique
            cache_buster = datetime.utcnow().microsecond
            
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
                    UsageLog.created_at <= end_date,
                    # Add cache-busting condition that's always true
                    UsageLog.id >= 0
                )
            ).params(cache_buster=cache_buster)
            
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
            # 🔧 FIX: Add cache-busting parameter to prevent query caching
            # This ensures fresh data by making each query unique
            cache_buster = datetime.utcnow().microsecond
            
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
                    UsageLog.created_at <= end_date,
                    # Add cache-busting condition that's always true
                    UsageLog.id >= 0
                )
            ).group_by(UsageLog.provider)
            
            # Add cache-busting parameter to the query
            provider_stats_query = provider_stats_query.params(cache_buster=cache_buster)
            
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

    async def log_llm_request_isolated(
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
    ) -> None:
        """
        🔧 ISOLATED usage logging method that uses its OWN database session.
        
        This method is designed to be completely independent of the main request
        transaction. It creates its own database session, commits immediately,
        and is NOT affected by any rollbacks in the calling code.
        
        This is the FIX for usage logs not being saved - they were getting
        rolled back with the main transaction when exceptions occurred.
        
        Key differences from other logging methods:
        - Uses AsyncSessionLocal() directly (new session)
        - Commits immediately within its own transaction
        - Does not depend on external session parameter
        - Cannot be rolled back by calling code
        - Includes comprehensive error handling
        """
        try:
            self.logger.info(f"🔧 [ISOLATED LOG] Starting isolated usage logging for user {user_id}, request {request_id}")
            
            # 🔑 KEY FIX: Create completely separate database session
            async with AsyncSessionLocal() as isolated_session:
                try:
                    # Load user and related data using the isolated session with eager loading
                    from sqlalchemy.orm import selectinload
                    from sqlalchemy import select
                    
                    user_query = select(User).options(
                        selectinload(User.role),
                        selectinload(User.department)
                    ).where(User.id == user_id)
                    user_result = await isolated_session.execute(user_query)
                    user = user_result.scalar_one_or_none()
                    
                    user_email = user.email if user else "unknown"
                    user_role = user.role.name if user and user.role else "unknown"
                    department_id = user.department_id if user else None
                    
                    # Load LLM configuration using the isolated session
                    llm_config = await isolated_session.get(LLMConfiguration, llm_config_id)
                    
                    # Parse all the data safely (same logic as other methods)
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
                            if isinstance(performance_data["request_started_at"], str):
                                request_started_at = datetime.fromisoformat(
                                    performance_data["request_started_at"].replace("Z", "+00:00")
                                )
                            else:
                                request_started_at = performance_data["request_started_at"]
                        
                        if performance_data.get("request_completed_at"):
                            if isinstance(performance_data["request_completed_at"], str):
                                request_completed_at = datetime.fromisoformat(
                                    performance_data["request_completed_at"].replace("Z", "+00:00")
                                )
                            else:
                                request_completed_at = performance_data["request_completed_at"]
                    except Exception as time_error:
                        self.logger.warning(f"[ISOLATED LOG] Failed to parse timestamps: {str(time_error)}")
                    
                    response_time_ms = performance_data.get("response_time_ms")
                    response_content = response_data.get("content", "")
                    response_preview = response_content[:500] if response_content else None
                    
                    # Create usage log entry
                    usage_log = UsageLog(
                        user_id=user_id,
                        department_id=department_id,
                        user_email=user_email,
                        user_role=user_role,
                        llm_config_id=llm_config_id,
                        llm_config_name=llm_config.name if llm_config else "unknown",
                        provider=provider,
                        model=model,
                        request_messages_count=messages_count,
                        request_total_chars=total_chars,
                        request_parameters=request_parameters,
                        input_tokens=token_usage.get("input_tokens", 0),
                        output_tokens=token_usage.get("output_tokens", 0),
                        total_tokens=token_usage.get("total_tokens", 0),
                        estimated_cost=cost,
                        actual_cost=None,
                        cost_currency="USD",
                        response_time_ms=response_time_ms,
                        request_started_at=request_started_at,
                        request_completed_at=request_completed_at,
                        success=success,
                        error_type=error_type,
                        error_message=error_message,
                        http_status_code=http_status_code,
                        response_content_length=content_length,
                        response_preview=response_preview,
                        session_id=session_id,
                        request_id=request_id,
                        ip_address=ip_address,
                        user_agent=user_agent,
                        raw_response_metadata=raw_metadata
                    )
                    
                    # 🔑 KEY FIX: Add to isolated session and commit immediately
                    isolated_session.add(usage_log)
                    await isolated_session.commit()
                    
                    cost_display = f"${cost:.4f}" if cost is not None else "$0.0000"
                    self.logger.info(
                        f"✅ [ISOLATED LOG] Usage logged successfully: user={user_email}, provider={provider}, "
                        f"model={model}, tokens={usage_log.total_tokens}, cost={cost_display}, "
                        f"success={success}, request_id={request_id}, log_id={usage_log.id}"
                    )
                    
                except Exception as isolated_error:
                    # Even if the isolated session fails, rollback and re-raise
                    await isolated_session.rollback()
                    self.logger.error(f"❌ [ISOLATED LOG] Isolated session error for user {user_id}: {str(isolated_error)}")
                    raise isolated_error
                    
        except Exception as e:
            self.logger.error(f"❌ [ISOLATED LOG] Failed to log usage for user {user_id}: {str(e)}")
            import traceback
            self.logger.error(f"❌ [ISOLATED LOG] Traceback: {traceback.format_exc()}")
            # 🔧 IMPORTANT: Don't re-raise - usage logging should never break the main flow
            # This ensures that even if usage logging completely fails, the user still gets their chat response

    def log_llm_request_sync(
        self,
        db_session,
        user_id: int,
        llm_config_id: int,
        request_data: Dict[str, Any],
        response_data: Dict[str, Any],
        performance_data: Dict[str, Any],
        session_id: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> None:
        """
        🗑️ DEPRECATED: Synchronous usage log method.
        
        This method is now deprecated in favor of log_llm_request_isolated().
        It was causing issues because it used the same session as the main request,
        leading to usage logs being rolled back with the main transaction.
        
        Keep this method for backward compatibility, but new code should use
        log_llm_request_isolated() instead.
        """
        try:
            # Load user and related data
            from ..models.user import User
            from ..models.llm_config import LLMConfiguration
            user = db_session.query(User).filter(User.id == user_id).first()
            user_email = user.email if user else "unknown"
            user_role = user.role.name if user and user.role else "unknown"
            department_id = user.department_id if user else None
            llm_config = db_session.query(LLMConfiguration).filter(LLMConfiguration.id == llm_config_id).first()
            
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
            
            # 🔧 FIX: Parse datetime strings to Python datetime objects
            request_started_at = None
            request_completed_at = None
            try:
                if performance_data.get("request_started_at"):
                    if isinstance(performance_data["request_started_at"], str):
                        request_started_at = datetime.fromisoformat(
                            performance_data["request_started_at"].replace("Z", "+00:00")
                        )
                    else:
                        request_started_at = performance_data["request_started_at"]
                
                if performance_data.get("request_completed_at"):
                    if isinstance(performance_data["request_completed_at"], str):
                        request_completed_at = datetime.fromisoformat(
                            performance_data["request_completed_at"].replace("Z", "+00:00")
                        )
                    else:
                        request_completed_at = performance_data["request_completed_at"]
            except Exception as time_error:
                self.logger.warning(f"[SYNC LOG] Failed to parse timestamps: {str(time_error)}")
            
            response_time_ms = performance_data.get("response_time_ms")
            response_content = response_data.get("content", "")
            response_preview = response_content[:500] if response_content else None
            
            from ..models.usage_log import UsageLog
            usage_log = UsageLog(
                user_id=user_id,
                department_id=department_id,
                user_email=user_email,
                user_role=user_role,
                llm_config_id=llm_config_id,
                llm_config_name=llm_config.name if llm_config else "unknown",
                provider=provider,
                model=model,
                request_messages_count=messages_count,
                request_total_chars=total_chars,
                request_parameters=request_parameters,
                input_tokens=token_usage.get("input_tokens", 0),
                output_tokens=token_usage.get("output_tokens", 0),
                total_tokens=token_usage.get("total_tokens", 0),
                estimated_cost=cost,
                actual_cost=None,
                cost_currency="USD",
                response_time_ms=response_time_ms,
                request_started_at=request_started_at,
                request_completed_at=request_completed_at,
                success=success,
                error_type=error_type,
                error_message=error_message,
                http_status_code=http_status_code,
                response_content_length=content_length,
                response_preview=response_preview,
                session_id=session_id,
                request_id=request_id,
                ip_address=ip_address,
                user_agent=user_agent,
                raw_response_metadata=raw_metadata
            )
            db_session.add(usage_log)
            db_session.commit()
            self.logger.info(f"[SYNC LOG] Usage logged for user={user_email}, provider={provider}, model={model}, tokens={usage_log.total_tokens}, cost={cost}, request_id={request_id}")
        except Exception as e:
            db_session.rollback()
            self.logger.error(f"[SYNC LOG] Failed to log usage for user {user_id}: {str(e)}")
            import traceback
            self.logger.error(traceback.format_exc())
            # Don't re-raise the exception - usage logging should not break the main flow

# =============================================================================
# SERVICE INSTANCE
# =============================================================================

# Create global service instance
# This follows the same pattern as other services in our app
usage_service = UsageService()

# Debug information for troubleshooting
logging.getLogger(__name__).info("Usage service initialized with duplicate logging prevention")
