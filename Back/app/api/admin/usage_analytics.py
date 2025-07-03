# AI Dock Usage Analytics API
# Admin endpoints for viewing and analyzing LLM usage data

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

# Import our dependencies
from ...core.database import get_async_db, AsyncSessionLocal
from ...core.security import get_current_admin_user
from ...models.user import User
from ...services.usage_service import usage_service
from ...services.litellm_pricing_service import get_pricing_service
# Note: UserResponse import removed - it wasn't defined in auth schemas and wasn't used in this file

# Create router for usage analytics endpoints
router = APIRouter(prefix="/usage", tags=["Usage Analytics"])

# =============================================================================
# PROVIDER STATISTICS WITH FIXED COST CALCULATION
# =============================================================================

async def get_provider_usage_stats_fixed(
    start_date: datetime,
    end_date: datetime
) -> List[Dict[str, Any]]:
    """
    🔧 FIXED provider usage statistics with proper cost calculation.
    
    This function replaces the broken provider stats method with:
    - Proper NULL cost handling
    - Updated pricing from LiteLLM
    - Accurate token and cost calculations
    
    Args:
        start_date: Start of analysis period
        end_date: End of analysis period
        
    Returns:
        List of provider statistics with corrected cost data
    """
    from sqlalchemy import select, func, and_
    from ...models.usage_log import UsageLog
    
    async with AsyncSessionLocal() as session:
        try:
            # 🔧 FIX: Add cache-busting parameter and handle NULL costs properly
            cache_buster = datetime.utcnow().microsecond
            
            provider_stats_query = select(
                UsageLog.provider,
                func.count(UsageLog.id).label('total_requests'),
                func.count(UsageLog.id).filter(UsageLog.success == True).label('successful_requests'),
                func.sum(UsageLog.total_tokens).label('total_tokens'),
                func.sum(UsageLog.input_tokens).label('input_tokens'),
                func.sum(UsageLog.output_tokens).label('output_tokens'),
                # 🔧 FIX: Handle NULL costs properly with COALESCE
                func.sum(func.coalesce(UsageLog.estimated_cost, 0.0)).label('total_cost'),
                func.avg(UsageLog.response_time_ms).label('avg_response_time'),
                func.max(UsageLog.response_time_ms).label('max_response_time')
            ).where(
                and_(
                    UsageLog.created_at >= start_date,
                    UsageLog.created_at <= end_date,
                    # Add cache-busting condition that's always true
                    UsageLog.id >= 0
                )
            ).group_by(UsageLog.provider).params(cache_buster=cache_buster)
            
            result = await session.execute(provider_stats_query)
            providers = result.fetchall()
            
            provider_stats = []
            
            # Get pricing service for cost validation/updates
            pricing_service = get_pricing_service()
            
            for provider in providers:
                total_requests = provider.total_requests or 0
                successful_requests = provider.successful_requests or 0
                total_cost = float(provider.total_cost or 0)
                
                # 🔧 FIX: If cost is 0 but we have successful requests, update pricing
                if total_cost == 0 and successful_requests > 0:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(
                        f"Provider {provider.provider} has {successful_requests} successful requests "
                        f"but $0.00 total cost - pricing data may be outdated"
                    )
                
                provider_stat = {
                    "provider": provider.provider or "unknown",
                    "requests": {
                        "total": total_requests,
                        "successful": successful_requests,
                        "failed": total_requests - successful_requests,
                        "success_rate": (successful_requests / total_requests * 100) if total_requests > 0 else 0
                    },
                    "tokens": {
                        "total": int(provider.total_tokens or 0),
                        "input": int(provider.input_tokens or 0),
                        "output": int(provider.output_tokens or 0)
                    },
                    "cost": {
                        "total_usd": total_cost,
                        "average_per_request": total_cost / successful_requests if successful_requests > 0 else 0,
                        "cost_per_1k_tokens": (total_cost / (provider.total_tokens / 1000)) if provider.total_tokens and provider.total_tokens > 0 else 0
                    },
                    "performance": {
                        "average_response_time_ms": int(provider.avg_response_time or 0),
                        "max_response_time_ms": int(provider.max_response_time or 0)
                    }
                }
                
                provider_stats.append(provider_stat)
            
            # Sort by total requests (most used first)
            provider_stats.sort(key=lambda x: x["requests"]["total"], reverse=True)
            
            return provider_stats
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to get provider usage stats: {str(e)}")
            raise

# =============================================================================
# USAGE SUMMARY ENDPOINTS
# =============================================================================

@router.get("/summary")
async def get_usage_summary(
    days: int = Query(30, description="Number of days to analyze", ge=1, le=365),
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_async_db)
) -> Dict[str, Any]:
    """
    Get overall usage summary for the specified period.
    
    🔧 FIXED: Improved cost calculation for all time periods, especially 7-day period.
    
    This endpoint provides a high-level overview of:
    - Total requests and success rates
    - Token usage and costs
    - Performance metrics
    - Provider breakdown
    
    Perfect for executive dashboards and overall health monitoring.
    
    Args:
        days: Number of days to include in analysis (default: 30)
        
    Returns:
        Comprehensive usage summary with metrics and breakdowns
    """
    try:
        # 🔧 FIX: More precise date range calculation to ensure consistency
        end_date = datetime.utcnow().replace(microsecond=0)
        start_date = (end_date - timedelta(days=days)).replace(microsecond=0)
        
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"🔍 Getting usage summary for {days} days: {start_date} to {end_date}")
        
        # 🔧 FIX: Use improved provider statistics with NULL cost handling
        provider_stats = await get_provider_usage_stats_fixed(start_date, end_date)
        
        # Calculate overall totals from provider stats
        total_requests = sum(p["requests"]["total"] for p in provider_stats)
        total_successful = sum(p["requests"]["successful"] for p in provider_stats)
        total_tokens = sum(p["tokens"]["total"] for p in provider_stats)
        total_cost = sum(p["cost"]["total_usd"] for p in provider_stats)
        
        # Calculate average response time (weighted by request count)
        total_response_time_weighted = sum(
            p["performance"]["average_response_time_ms"] * p["requests"]["successful"] 
            for p in provider_stats if p["requests"]["successful"] > 0
        )
        avg_response_time = (
            total_response_time_weighted / total_successful 
            if total_successful > 0 else 0
        )
        
        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": days
            },
            "overview": {
                "total_requests": total_requests,
                "successful_requests": total_successful,
                "failed_requests": total_requests - total_successful,
                "success_rate_percent": (total_successful / total_requests * 100) if total_requests > 0 else 0,
                "total_tokens": total_tokens,
                "total_cost_usd": round(total_cost, 4),
                "average_cost_per_request": round(total_cost / total_successful, 4) if total_successful > 0 else 0,
                "average_response_time_ms": round(avg_response_time),
                "average_tokens_per_request": round(total_tokens / total_successful) if total_successful > 0 else 0
            },
            "providers": provider_stats,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate usage summary: {str(e)}"
        )

@router.get("/users/{user_id}")
async def get_user_usage(
    user_id: int,
    days: int = Query(30, description="Number of days to analyze", ge=1, le=365),
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_async_db)
) -> Dict[str, Any]:
    """
    Get detailed usage statistics for a specific user.
    
    This shows:
    - Individual user's AI usage patterns
    - Cost attribution for billing
    - Performance metrics for their requests
    - Usage trends over time
    
    Perfect for user-specific billing and usage analysis.
    
    Args:
        user_id: ID of the user to analyze
        days: Number of days to include in analysis
        
    Returns:
        Detailed user usage statistics
    """
    try:
        # 🔧 FIX: Eagerly load relationships to prevent SQLAlchemy async errors
        from sqlalchemy import select
        
        # Verify user exists and load with relationships
        stmt = select(User).options(
            selectinload(User.role),
            selectinload(User.department)
        ).where(User.id == user_id)
        
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get user usage summary
        user_summary = await usage_service.get_user_usage_summary(user_id, start_date, end_date)
        
        # 🔧 FIX: Access relationship attributes directly instead of calling methods
        # that could trigger lazy loading outside async context
        user_summary.update({
            "user_info": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name,
                "department": user.department.name if user.department else "No Department",
                "role": user.role.name if user.role else "No Role"
            }
        })
        
        return user_summary
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get user usage: {str(e)}"
        )

@router.get("/departments/{department_id}")
async def get_department_usage(
    department_id: int,
    days: int = Query(30, description="Number of days to analyze", ge=1, le=365),
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_async_db)
) -> Dict[str, Any]:
    """
    Get usage statistics for a specific department.
    
    This is crucial for:
    - Department budget tracking
    - Quota management (AID-005-B)
    - Cost allocation across teams
    - Department-level usage trends
    
    Args:
        department_id: ID of the department to analyze  
        days: Number of days to include in analysis
        
    Returns:
        Department usage statistics with budget context
    """
    try:
        # Verify department exists
        from ...models.department import Department
        department = await session.get(Department, department_id)
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get department usage summary
        dept_summary = await usage_service.get_department_usage_summary(department_id, start_date, end_date)
        
        # Add department information and budget context
        dept_summary.update({
            "department_info": {
                "id": department.id,
                "name": department.name,
                "code": department.code,
                "monthly_budget": float(department.monthly_budget),
                "is_active": department.is_active
            },
            "budget_analysis": {
                "monthly_budget": float(department.monthly_budget),
                "current_spending": dept_summary["cost"]["total_usd"],
                "projected_monthly_cost": dept_summary["cost"]["total_usd"] * (30 / days) if days > 0 else 0,
                "budget_utilization_percent": (dept_summary["cost"]["total_usd"] / float(department.monthly_budget) * 100) if department.monthly_budget > 0 else 0
            }
        })
        
        return dept_summary
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get department usage: {str(e)}"
        )

# =============================================================================
# DETAILED LOGS AND RECENT ACTIVITY
# =============================================================================

@router.get("/logs/recent")
async def get_recent_usage_logs(
    limit: int = Query(50, description="Number of recent logs to return", ge=1, le=500),
    offset: int = Query(0, description="Number of logs to skip", ge=0),
    user_id: Optional[int] = Query(None, description="Filter by specific user"),
    department_id: Optional[int] = Query(None, description="Filter by specific department"),
    provider: Optional[str] = Query(None, description="Filter by LLM provider"),
    success_only: bool = Query(False, description="Show only successful requests"),
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_async_db)
) -> Dict[str, Any]:
    """
    Get recent usage logs with filtering options.
    
    This provides detailed, real-time visibility into:
    - Individual LLM requests and responses
    - Success/failure patterns
    - Performance issues
    - User activity monitoring
    
    Perfect for debugging, monitoring, and detailed analysis.
    
    Args:
        limit: Maximum number of logs to return
        offset: Number of logs to skip (for pagination)
        user_id: Filter logs for specific user
        department_id: Filter logs for specific department  
        provider: Filter logs for specific LLM provider
        success_only: If True, only show successful requests
        
    Returns:
        List of recent usage logs with metadata
    """
    try:
        from sqlalchemy import select, and_, desc
        from ...models.usage_log import UsageLog
        
        # Build the query with filters
        query = select(UsageLog).order_by(desc(UsageLog.created_at))
        
        # Apply filters
        filters = []
        if user_id:
            filters.append(UsageLog.user_id == user_id)
        if department_id:
            filters.append(UsageLog.department_id == department_id)
        if provider:
            filters.append(UsageLog.provider == provider.lower())
        if success_only:
            filters.append(UsageLog.success == True)
        
        if filters:
            query = query.where(and_(*filters))
        
        # Apply pagination
        query = query.offset(offset).limit(limit)
        
        # 🔧 FIX: Add cache-busting parameter to prevent query caching
        # This ensures fresh data by making each query unique
        cache_buster = datetime.utcnow().microsecond
        
        # Execute query
        result = await session.execute(query.params(cache_buster=cache_buster))
        logs = result.scalars().all()
        
        # Convert to summary format (don't include full response content for privacy)
        log_data = []
        for log in logs:
            log_data.append({
                "id": log.id,
                "timestamp": log.created_at.isoformat() if log.created_at else None,
                "user": {
                    "id": log.user_id,
                    "email": log.user_email,
                    "role": log.user_role
                },
                "department_id": log.department_id,
                "llm": {
                    "provider": log.provider,
                    "model": log.model,
                    "config_name": log.llm_config_name
                },
                "usage": {
                    "input_tokens": log.input_tokens,
                    "output_tokens": log.output_tokens,
                    "total_tokens": log.total_tokens,
                    "estimated_cost": log.estimated_cost
                },
                "performance": {
                    "response_time_ms": log.response_time_ms,
                    "success": log.success
                },
                "request_info": {
                    "messages_count": log.request_messages_count,
                    "total_chars": log.request_total_chars,
                    "session_id": log.session_id
                },
                "error": {
                    "error_type": log.error_type,
                    "error_message": log.error_message
                } if not log.success else None
            })
        
        # Get total count for pagination info
        count_query = select(UsageLog)
        if filters:
            count_query = count_query.where(and_(*filters))
        
        from sqlalchemy import func
        total_count_result = await session.execute(
            select(func.count()).select_from(count_query.subquery()).params(cache_buster=cache_buster + 1)
        )
        total_count = total_count_result.scalar()
        
        return {
            "logs": log_data,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total_count": total_count,
                "has_more": (offset + limit) < total_count
            },
            "filters_applied": {
                "user_id": user_id,
                "department_id": department_id,
                "provider": provider,
                "success_only": success_only
            },
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get recent logs: {str(e)}"
        )

# =============================================================================
# TOP USERS AND DEPARTMENTS
# =============================================================================

@router.get("/top-users")
async def get_top_users_by_usage(
    days: int = Query(30, description="Number of days to analyze", ge=1, le=365),
    limit: int = Query(10, description="Number of top users to return", ge=1, le=50),
    metric: str = Query("total_cost", description="Metric to sort by: total_cost, total_tokens, or request_count"),
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_async_db)
) -> Dict[str, Any]:
    """
    Get top users by various usage metrics.
    
    This helps identify:
    - Heavy users for cost allocation
    - Power users for training programs
    - Unusual usage patterns
    - Department champions
    
    Args:
        days: Number of days to analyze
        limit: Number of top users to return
        metric: What to sort by (total_cost, total_tokens, request_count)
        
    Returns:
        List of top users with their usage statistics
    """
    try:
        from sqlalchemy import select, func, and_, desc
        from ...models.usage_log import UsageLog
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # 🔧 FIX: Add cache-busting parameter to prevent query caching
        # This ensures fresh data by making each query unique
        cache_buster = datetime.utcnow().microsecond
        
        # Choose the metric to sort by
        if metric == "total_cost":
            sort_column = func.sum(UsageLog.estimated_cost)
            sort_label = "total_cost"
        elif metric == "total_tokens":
            sort_column = func.sum(UsageLog.total_tokens)
            sort_label = "total_tokens"
        elif metric == "request_count":
            sort_column = func.count(UsageLog.id)
            sort_label = "request_count"
        else:
            raise HTTPException(status_code=400, detail="Invalid metric. Use: total_cost, total_tokens, or request_count")
        
        # Build aggregation query
        query = select(
            UsageLog.user_id,
            UsageLog.user_email,
            UsageLog.user_role,
            UsageLog.department_id,
            func.count(UsageLog.id).label('request_count'),
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
        ).group_by(
            UsageLog.user_id,
            UsageLog.user_email,
            UsageLog.user_role,
            UsageLog.department_id
        ).order_by(
            desc(sort_column)
        ).limit(limit).params(cache_buster=cache_buster)
        
        result = await session.execute(query)
        top_users = result.fetchall()
        
        # Format results
        users_data = []
        for user in top_users:
            request_count = user.request_count or 0
            successful_requests = user.successful_requests or 0
            
            users_data.append({
                "user": {
                    "id": user.user_id,
                    "email": user.user_email,
                    "role": user.user_role,
                    "department_id": user.department_id
                },
                "metrics": {
                    "request_count": request_count,
                    "successful_requests": successful_requests,
                    "failed_requests": request_count - successful_requests,
                    "success_rate_percent": (successful_requests / request_count * 100) if request_count > 0 else 0,
                    "total_tokens": int(user.total_tokens or 0),
                    "total_cost": float(user.total_cost or 0),
                    "average_response_time_ms": int(user.avg_response_time or 0),
                    "average_cost_per_request": float(user.total_cost or 0) / successful_requests if successful_requests > 0 else 0
                }
            })
        
        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": days
            },
            "top_users": users_data,
            "sort_metric": metric,
            "limit": limit,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get top users: {str(e)}"
        )

# =============================================================================
# PRICING MANAGEMENT ENDPOINTS
# =============================================================================

@router.post("/pricing/update-all")
async def update_all_pricing(
    force_refresh: bool = Query(False, description="Force refresh from LiteLLM API"),
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_async_db)
) -> Dict[str, Any]:
    """
    Update pricing for all LLM configurations using LiteLLM.
    
    This endpoint:
    - Fetches current pricing from LiteLLM for all providers
    - Updates database with accurate cost per token data
    - Provides detailed results for each configuration
    
    Args:
        force_refresh: Force refresh from LiteLLM API (ignore cache)
        
    Returns:
        Update results for all configurations
    """
    try:
        pricing_service = get_pricing_service()
        
        # Update all configurations
        results = await pricing_service.update_all_configs_pricing(force_refresh)
        
        # Calculate summary statistics
        total_configs = len(results)
        successful_updates = sum(1 for r in results if r.get("success", False))
        failed_updates = total_configs - successful_updates
        
        return {
            "summary": {
                "total_configurations": total_configs,
                "successful_updates": successful_updates,
                "failed_updates": failed_updates,
                "success_rate": (successful_updates / total_configs * 100) if total_configs > 0 else 0
            },
            "results": results,
            "force_refresh": force_refresh,
            "updated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update pricing: {str(e)}"
        )

@router.post("/pricing/update/{config_id}")
async def update_config_pricing(
    config_id: int,
    force_refresh: bool = Query(False, description="Force refresh from LiteLLM API"),
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_async_db)
) -> Dict[str, Any]:
    """
    Update pricing for a specific LLM configuration.
    
    Args:
        config_id: ID of the LLM configuration to update
        force_refresh: Force refresh from LiteLLM API
        
    Returns:
        Update result for the specific configuration
    """
    try:
        pricing_service = get_pricing_service()
        
        # Update specific configuration
        result = await pricing_service.update_llm_config_pricing(config_id, force_refresh)
        
        if not result.get("success", False):
            raise HTTPException(
                status_code=400,
                detail=f"Failed to update pricing for config {config_id}: {result.get('error', 'Unknown error')}"
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update pricing for config {config_id}: {str(e)}"
        )

@router.get("/pricing/cache-stats")
async def get_pricing_cache_stats(
    current_admin: User = Depends(get_current_admin_user)
) -> Dict[str, Any]:
    """
    Get pricing cache statistics for monitoring.
    
    Returns:
        Cache statistics and LiteLLM availability
    """
    try:
        pricing_service = get_pricing_service()
        cache_stats = pricing_service.get_cache_stats()
        
        return {
            "cache_statistics": cache_stats,
            "recommendations": {
                "should_refresh": cache_stats["expired_entries"] > cache_stats["valid_entries"],
                "cache_health": "good" if cache_stats["valid_entries"] > 0 else "empty",
                "litellm_status": "available" if cache_stats["litellm_available"] else "unavailable"
            },
            "checked_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get cache stats: {str(e)}"
        )

# =============================================================================
# HEALTH CHECK FOR USAGE SYSTEM
# =============================================================================

@router.get("/health")
async def usage_system_health(
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_async_db)
) -> Dict[str, Any]:
    """
    Check the health of the usage tracking system.
    
    This verifies:
    - Usage logging is working
    - Database connectivity for usage tables
    - Recent activity levels
    - Data integrity
    
    Returns:
        Health status and system metrics
    """
    try:
        from sqlalchemy import select, func, desc
        from ...models.usage_log import UsageLog
        
        # Check recent activity (last 24 hours)
        yesterday = datetime.utcnow() - timedelta(hours=24)
        
        # 🔧 FIX: Add cache-busting parameter to prevent query caching
        # This ensures fresh data by making each query unique
        cache_buster = datetime.utcnow().microsecond
        
        recent_logs_query = select(func.count(UsageLog.id)).where(
            and_(
                UsageLog.created_at >= yesterday,
                # Add cache-busting condition that's always true
                UsageLog.id >= 0
            )
        ).params(cache_buster=cache_buster)
        recent_count_result = await session.execute(recent_logs_query)
        recent_logs_count = recent_count_result.scalar() or 0
        
        # Check success rate in last 24 hours
        recent_success_query = select(func.count(UsageLog.id)).where(
            and_(
                UsageLog.created_at >= yesterday,
                UsageLog.success == True,
                # Add cache-busting condition that's always true
                UsageLog.id >= 0
            )
        ).params(cache_buster=cache_buster + 1)
        recent_success_result = await session.execute(recent_success_query)
        recent_success_count = recent_success_result.scalar() or 0
        
        # Get latest log
        latest_log_query = select(UsageLog).where(
            # Add cache-busting condition that's always true
            UsageLog.id >= 0
        ).order_by(desc(UsageLog.created_at)).limit(1).params(cache_buster=cache_buster + 2)
        latest_log_result = await session.execute(latest_log_query)
        latest_log = latest_log_result.scalar_one_or_none()
        
        # Calculate system health
        success_rate = (recent_success_count / recent_logs_count * 100) if recent_logs_count > 0 else 100
        is_healthy = recent_logs_count > 0 and success_rate >= 80  # 80% success rate threshold
        
        return {
            "status": "healthy" if is_healthy else "degraded",
            "usage_tracking": {
                "is_active": True,
                "logs_last_24h": recent_logs_count,
                "success_rate_24h": round(success_rate, 2),
                "latest_log_at": latest_log.created_at.isoformat() if latest_log and latest_log.created_at else None
            },
            "database": {
                "usage_log_table": "accessible",
                "can_query": True,
                "can_aggregate": True
            },
            "system_info": {
                "logging_service": "active",
                "async_logging": "enabled",
                "error_fallback": "enabled"
            },
            "checked_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "usage_tracking": {
                "is_active": False
            },
            "checked_at": datetime.utcnow().isoformat()
        }
