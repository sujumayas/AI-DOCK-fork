# User Usage Analytics API
# User-facing endpoints for viewing personal LLM usage data

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

# Import our dependencies
from ..core.database import get_async_db
from ..core.security import get_current_user
from ..models.user import User
from ..services.usage_service import usage_service

# Create router for user usage analytics endpoints
router = APIRouter(prefix="/usage", tags=["User Usage Analytics"])

# =============================================================================
# USER USAGE ANALYTICS ENDPOINTS
# =============================================================================

@router.get("/my-stats")
async def get_my_usage_stats(
    days: int = Query(30, description="Number of days to analyze", ge=1, le=365),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_db)
) -> Dict[str, Any]:
    """
    Get detailed usage statistics for the current user.
    
    This shows the current user's:
    - AI usage patterns and costs
    - Performance metrics for their requests
    - Usage trends over time
    - Token consumption
    
    Perfect for users to understand their own usage patterns.
    
    Args:
        days: Number of days to include in analysis (default: 30)
        current_user: Authenticated user (auto-injected)
        session: Database session (auto-injected)
        
    Returns:
        Detailed user usage statistics for the current user
    """
    try:
        # 🔧 FIX: Eagerly load relationships to prevent SQLAlchemy async errors
        from sqlalchemy import select
        
        # Load user with relationships to avoid lazy loading issues
        stmt = select(User).options(
            selectinload(User.role),
            selectinload(User.department)
        ).where(User.id == current_user.id)
        
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get user usage summary
        user_summary = await usage_service.get_user_usage_summary(current_user.id, start_date, end_date)
        
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
            detail=f"Failed to get your usage statistics: {str(e)}"
        )

@router.get("/my-recent-activity")
async def get_my_recent_activity(
    limit: int = Query(20, description="Number of recent activities to return", ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_db)
) -> Dict[str, Any]:
    """
    Get recent usage activity for the current user.
    
    This provides visibility into the user's recent:
    - AI requests and responses
    - Success/failure patterns
    - Performance metrics
    - Token usage per request
    
    Perfect for users to monitor their recent activity.
    
    Args:
        limit: Maximum number of recent activities to return (default: 20)
        current_user: Authenticated user (auto-injected)
        session: Database session (auto-injected)
        
    Returns:
        List of recent usage activities for the current user
    """
    try:
        from sqlalchemy import select, desc
        from ..models.usage_log import UsageLog
        
        # Build query to get user's recent activity
        query = select(UsageLog).where(
            UsageLog.user_id == current_user.id
        ).order_by(desc(UsageLog.created_at)).limit(limit)
        
        # Execute query
        result = await session.execute(query)
        logs = result.scalars().all()
        
        # Convert to user-friendly format (exclude sensitive data)
        activity_data = []
        for log in logs:
            activity_data.append({
                "id": log.id,
                "timestamp": log.created_at.isoformat() if log.created_at else None,
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
                    "total_chars": log.request_total_chars
                },
                "error": {
                    "error_type": log.error_type,
                    "error_message": log.error_message
                } if not log.success else None
            })
        
        return {
            "recent_activity": activity_data,
            "total_records": len(activity_data),
            "user_info": {
                "username": current_user.username,
                "email": current_user.email
            },
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get your recent activity: {str(e)}"
        ) 