# AI Dock Admin Quota Management API
# FastAPI endpoints for managing department quotas

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc, asc
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.quota import DepartmentQuota, QuotaType, QuotaPeriod, QuotaStatus
from ...models.department import Department
from ...models.llm_config import LLMConfiguration
from ...services.quota_service import get_quota_service, QuotaService
from ...schemas.quota import (
    QuotaCreateRequest,
    QuotaUpdateRequest, 
    QuotaFilterRequest,
    QuotaResponse,
    QuotaListResponse,
    DepartmentQuotaStatusResponse,
    QuotaResetResponse,
    BulkQuotaOperationResponse,
    QuotaErrorResponse,
    convert_quota_to_response
)

# Create the router for quota management endpoints
router = APIRouter(prefix="/quotas", tags=["Admin - Quota Management"])

# Set up logging
logger = logging.getLogger(__name__)

# =============================================================================
# DEPENDENCY FUNCTIONS
# =============================================================================

async def require_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency to ensure the current user is an admin.
    
    This protects all quota management endpoints to admin users only.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required for quota management"
        )
    return current_user

def get_quota_service_dep(db: Session = Depends(get_db)) -> QuotaService:
    """Dependency to get a quota service instance"""
    return get_quota_service(db)

# =============================================================================
# QUOTA CRUD ENDPOINTS
# =============================================================================

@router.post(
    "/",
    response_model=QuotaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Quota",
    description="Create a new department quota with specified limits and configuration"
)
async def create_quota(
    quota_data: QuotaCreateRequest,
    current_user: User = Depends(require_admin_user),
    quota_service: QuotaService = Depends(get_quota_service_dep),
    db: Session = Depends(get_db)
):
    """
    Create a new department quota.
    
    This endpoint allows admins to set up new spending/usage limits for departments.
    Each quota specifies:
    - Which department it applies to
    - Which LLM provider (or all providers)
    - What type of limit (cost, tokens, requests)
    - How often it resets (daily, monthly, etc.)
    - The actual limit amount
    """
    logger.info(f"Admin {current_user.email} creating quota: {quota_data.name}")
    
    try:
        # Create the quota using our service
        quota = await quota_service.create_quota(
            department_id=quota_data.department_id,
            quota_type=quota_data.quota_type,
            quota_period=quota_data.quota_period,
            limit_value=quota_data.limit_value,
            name=quota_data.name,
            created_by=current_user.email,
            llm_config_id=quota_data.llm_config_id,
            description=quota_data.description,
            is_enforced=quota_data.is_enforced
        )
        
        # Get related names for response
        department = db.query(Department).filter(Department.id == quota.department_id).first()
        llm_config = None
        if quota.llm_config_id:
            llm_config = db.query(LLMConfiguration).filter(LLMConfiguration.id == quota.llm_config_id).first()
        
        logger.info(f"Created quota {quota.id}: {quota.name}")
        
        return convert_quota_to_response(
            quota,
            department_name=department.name if department else None,
            llm_config_name=llm_config.name if llm_config else "All Providers"
        )
        
    except ValueError as e:
        logger.warning(f"Validation error creating quota: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating quota: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create quota"
        )

@router.get(
    "/",
    response_model=QuotaListResponse,
    summary="List Quotas",
    description="Get a paginated list of quotas with optional filtering and sorting"
)
async def list_quotas(
    # Filtering parameters
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    llm_config_id: Optional[int] = Query(None, description="Filter by LLM configuration ID"),
    quota_type: Optional[QuotaType] = Query(None, description="Filter by quota type"),
    quota_period: Optional[QuotaPeriod] = Query(None, description="Filter by reset period"),
    status: Optional[QuotaStatus] = Query(None, description="Filter by quota status"),
    is_enforced: Optional[bool] = Query(None, description="Filter by enforcement status"),
    is_exceeded: Optional[bool] = Query(None, description="Filter by exceeded status"),
    search: Optional[str] = Query(None, description="Search in names and descriptions"),
    
    # Pagination parameters  
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    
    # Sorting parameters
    sort_by: str = Query("name", description="Field to sort by"),
    sort_order: str = Query("asc", regex="^(asc|desc)$", description="Sort order"),
    
    # Dependencies
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get a paginated list of department quotas with filtering and sorting.
    
    This endpoint supports comprehensive filtering, searching, and sorting
    to help admins find and manage quotas efficiently.
    """
    logger.info(f"Admin {current_user.email} listing quotas with filters")
    
    try:
        # Build base query with joins for efficient data loading
        query = db.query(DepartmentQuota).options(
            joinedload(DepartmentQuota.department),
            joinedload(DepartmentQuota.llm_config)
        )
        
        # Apply filters
        if department_id:
            query = query.filter(DepartmentQuota.department_id == department_id)
        
        if llm_config_id:
            query = query.filter(DepartmentQuota.llm_config_id == llm_config_id)
        
        if quota_type:
            query = query.filter(DepartmentQuota.quota_type == quota_type)
        
        if quota_period:
            query = query.filter(DepartmentQuota.quota_period == quota_period)
        
        if status:
            query = query.filter(DepartmentQuota.status == status)
        
        if is_enforced is not None:
            query = query.filter(DepartmentQuota.is_enforced == is_enforced)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    DepartmentQuota.name.ilike(search_term),
                    DepartmentQuota.description.ilike(search_term)
                )
            )
        
        # Handle exceeded filter (requires computed field)
        if is_exceeded is not None:
            if is_exceeded:
                query = query.filter(DepartmentQuota.current_usage >= DepartmentQuota.limit_value)
            else:
                query = query.filter(DepartmentQuota.current_usage < DepartmentQuota.limit_value)
        
        # Apply sorting
        sort_column = getattr(DepartmentQuota, sort_by, DepartmentQuota.name)
        if sort_order.lower() == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))
        
        # Get total count before pagination
        total_count = query.count()
        
        # Apply pagination
        offset = (page - 1) * page_size
        quotas = query.offset(offset).limit(page_size).all()
        
        # Convert to response format
        quota_responses = []
        for quota in quotas:
            quota_responses.append(convert_quota_to_response(
                quota,
                department_name=quota.department.name if quota.department else None,
                llm_config_name=quota.llm_config.name if quota.llm_config else "All Providers"
            ))
        
        # Calculate pagination metadata
        total_pages = (total_count + page_size - 1) // page_size
        has_next = page < total_pages
        has_previous = page > 1
        
        # Calculate summary statistics
        summary = _calculate_quota_summary(quotas)
        
        logger.info(f"Returned {len(quota_responses)} quotas (page {page}/{total_pages})")
        
        return QuotaListResponse(
            quotas=quota_responses,
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=has_next,
            has_previous=has_previous,
            summary=summary
        )
        
    except Exception as e:
        logger.error(f"Error listing quotas: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list quotas"
        )

@router.get(
    "/{quota_id}",
    response_model=QuotaResponse,
    summary="Get Quota Details",
    description="Get detailed information about a specific quota"
)
async def get_quota(
    quota_id: int,
    current_user: User = Depends(require_admin_user),
    quota_service: QuotaService = Depends(get_quota_service_dep),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific quota"""
    logger.info(f"Admin {current_user.email} requesting quota {quota_id}")
    
    quota = await quota_service.get_quota(quota_id)
    if not quota:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quota {quota_id} not found"
        )
    
    # Get related names
    department = db.query(Department).filter(Department.id == quota.department_id).first()
    llm_config = None
    if quota.llm_config_id:
        llm_config = db.query(LLMConfiguration).filter(LLMConfiguration.id == quota.llm_config_id).first()
    
    return convert_quota_to_response(
        quota,
        department_name=department.name if department else None,
        llm_config_name=llm_config.name if llm_config else "All Providers"
    )

@router.put(
    "/{quota_id}",
    response_model=QuotaResponse,
    summary="Update Quota",
    description="Update an existing quota's configuration"
)
async def update_quota(
    quota_id: int,
    update_data: QuotaUpdateRequest,
    current_user: User = Depends(require_admin_user),
    quota_service: QuotaService = Depends(get_quota_service_dep),
    db: Session = Depends(get_db)
):
    """Update an existing quota's configuration"""
    logger.info(f"Admin {current_user.email} updating quota {quota_id}")
    
    # Convert Pydantic model to dict, excluding None values
    updates = update_data.dict(exclude_unset=True, exclude_none=True)
    
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields provided for update"
        )
    
    quota = await quota_service.update_quota(quota_id, **updates)
    
    if not quota:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quota {quota_id} not found"
        )
    
    # Get related names for response
    department = db.query(Department).filter(Department.id == quota.department_id).first()
    llm_config = None
    if quota.llm_config_id:
        llm_config = db.query(LLMConfiguration).filter(LLMConfiguration.id == quota.llm_config_id).first()
    
    logger.info(f"Updated quota {quota_id}: {quota.name}")
    
    return convert_quota_to_response(
        quota,
        department_name=department.name if department else None,
        llm_config_name=llm_config.name if llm_config else "All Providers"
    )

@router.delete(
    "/{quota_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Quota",
    description="Delete a quota (this action cannot be undone)"
)
async def delete_quota(
    quota_id: int,
    current_user: User = Depends(require_admin_user),
    quota_service: QuotaService = Depends(get_quota_service_dep)
):
    """Delete a quota (this action cannot be undone)"""
    logger.info(f"Admin {current_user.email} deleting quota {quota_id}")
    
    success = await quota_service.delete_quota(quota_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quota {quota_id} not found"
        )
    
    logger.info(f"Deleted quota {quota_id}")

# =============================================================================
# DEPARTMENT QUOTA STATUS ENDPOINTS
# =============================================================================

@router.get(
    "/department/{department_id}/status",
    response_model=DepartmentQuotaStatusResponse,
    summary="Get Department Quota Status",
    description="Get comprehensive quota status for a specific department"
)
async def get_department_quota_status(
    department_id: int,
    current_user: User = Depends(require_admin_user),
    quota_service: QuotaService = Depends(get_quota_service_dep),
    db: Session = Depends(get_db)
):
    """Get comprehensive quota status for a specific department"""
    logger.info(f"Admin {current_user.email} requesting quota status for department {department_id}")
    
    # Verify department exists
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department {department_id} not found"
        )
    
    try:
        # Get comprehensive status from service
        status_data = await quota_service.get_department_quota_status(department_id)
        
        # Convert quota data to response format
        quota_responses = []
        for quota_dict in status_data["quotas"]:
            # Create a minimal quota object for conversion
            # In a real implementation, you might want to fetch the actual quota objects
            quota_responses.append(QuotaResponse(**quota_dict))
        
        return DepartmentQuotaStatusResponse(
            department_id=department_id,
            department_name=department.name,
            last_updated=datetime.fromisoformat(status_data["last_updated"]),
            overall_status=status_data["overall_status"],
            total_quotas=status_data["total_quotas"],
            active_quotas=status_data["active_quotas"],
            exceeded_quotas=status_data["exceeded_quotas"],
            near_limit_quotas=status_data["near_limit_quotas"],
            suspended_quotas=status_data["suspended_quotas"],
            inactive_quotas=status_data["inactive_quotas"],
            quotas_by_type=status_data["quotas_by_type"],
            quotas=quota_responses
        )
        
    except Exception as e:
        logger.error(f"Error getting department quota status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get department quota status"
        )

# =============================================================================
# QUOTA MANAGEMENT OPERATIONS
# =============================================================================

@router.post(
    "/{quota_id}/reset",
    response_model=QuotaResetResponse,
    summary="Reset Quota Usage",
    description="Manually reset a quota's current usage to zero"
)
async def reset_quota(
    quota_id: int,
    current_user: User = Depends(require_admin_user),
    quota_service: QuotaService = Depends(get_quota_service_dep)
):
    """Manually reset a quota's current usage to zero"""
    logger.info(f"Admin {current_user.email} resetting quota {quota_id}")
    
    # Get quota details before reset
    quota = await quota_service.get_quota(quota_id)
    if not quota:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quota {quota_id} not found"
        )
    
    previous_usage = float(quota.current_usage)
    
    # Perform the reset
    success = await quota_service.reset_quota(quota_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset quota"
        )
    
    logger.info(f"Reset quota {quota_id}: {quota.name} (was: {previous_usage})")
    
    return QuotaResetResponse(
        success=True,
        message="Quota reset successfully",
        quota_id=quota_id,
        quota_name=quota.name,
        reset_at=datetime.utcnow(),
        previous_usage=previous_usage,
        new_usage=0.0
    )

@router.post(
    "/bulk/reset",
    response_model=BulkQuotaOperationResponse,
    summary="Bulk Reset Quotas",
    description="Reset multiple quotas at once"
)
async def bulk_reset_quotas(
    quota_ids: List[int],
    current_user: User = Depends(require_admin_user),
    quota_service: QuotaService = Depends(get_quota_service_dep)
):
    """Reset multiple quotas at once"""
    logger.info(f"Admin {current_user.email} bulk resetting {len(quota_ids)} quotas")
    
    if not quota_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No quota IDs provided"
        )
    
    if len(quota_ids) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reset more than 50 quotas at once"
        )
    
    results = []
    successful_operations = 0
    failed_operations = 0
    
    for quota_id in quota_ids:
        try:
            # Get quota name for result
            quota = await quota_service.get_quota(quota_id)
            if not quota:
                results.append({
                    "quota_id": quota_id,
                    "success": False,
                    "message": "Quota not found"
                })
                failed_operations += 1
                continue
            
            # Perform reset
            success = await quota_service.reset_quota(quota_id)
            
            if success:
                results.append({
                    "quota_id": quota_id,
                    "quota_name": quota.name,
                    "success": True,
                    "message": "Reset successful"
                })
                successful_operations += 1
            else:
                results.append({
                    "quota_id": quota_id,
                    "success": False,
                    "message": "Reset failed"
                })
                failed_operations += 1
                
        except Exception as e:
            results.append({
                "quota_id": quota_id,
                "success": False,
                "message": f"Error: {str(e)}"
            })
            failed_operations += 1
    
    logger.info(f"Bulk reset completed: {successful_operations} successful, {failed_operations} failed")
    
    return BulkQuotaOperationResponse(
        success=failed_operations == 0,
        message=f"Bulk reset completed: {successful_operations} successful, {failed_operations} failed",
        total_requested=len(quota_ids),
        successful_operations=successful_operations,
        failed_operations=failed_operations,
        results=results
    )

# =============================================================================
# ANALYTICS AND REPORTING ENDPOINTS
# =============================================================================

@router.get(
    "/analytics/summary",
    response_model=Dict[str, Any],
    summary="Get Quota Analytics Summary",
    description="Get overall quota system analytics and statistics"
)
async def get_quota_analytics_summary(
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db)
):
    """Get overall quota system analytics and statistics"""
    logger.info(f"Admin {current_user.email} requesting quota analytics summary")
    
    try:
        # Get overall statistics
        total_quotas = db.query(DepartmentQuota).count()
        active_quotas = db.query(DepartmentQuota).filter(DepartmentQuota.status == QuotaStatus.ACTIVE).count()
        exceeded_quotas = db.query(DepartmentQuota).filter(
            and_(
                DepartmentQuota.current_usage >= DepartmentQuota.limit_value,
                DepartmentQuota.status == QuotaStatus.ACTIVE
            )
        ).count()
        
        # Get quotas by type
        quota_types = db.query(
            DepartmentQuota.quota_type,
            func.count(DepartmentQuota.id).label('count'),
            func.sum(DepartmentQuota.limit_value).label('total_limit'),
            func.sum(DepartmentQuota.current_usage).label('total_usage')
        ).filter(
            DepartmentQuota.status == QuotaStatus.ACTIVE
        ).group_by(DepartmentQuota.quota_type).all()
        
        # Get quotas by period
        quota_periods = db.query(
            DepartmentQuota.quota_period,
            func.count(DepartmentQuota.id).label('count')
        ).filter(
            DepartmentQuota.status == QuotaStatus.ACTIVE
        ).group_by(DepartmentQuota.quota_period).all()
        
        # Get top departments by quota count
        top_departments = db.query(
            Department.name,
            func.count(DepartmentQuota.id).label('quota_count'),
            func.sum(DepartmentQuota.current_usage).label('total_usage')
        ).join(
            DepartmentQuota, Department.id == DepartmentQuota.department_id
        ).filter(
            DepartmentQuota.status == QuotaStatus.ACTIVE
        ).group_by(
            Department.id, Department.name
        ).order_by(
            desc(func.count(DepartmentQuota.id))
        ).limit(10).all()
        
        return {
            "overview": {
                "total_quotas": total_quotas,
                "active_quotas": active_quotas,
                "exceeded_quotas": exceeded_quotas,
                "health_percentage": round((active_quotas - exceeded_quotas) / max(active_quotas, 1) * 100, 2)
            },
            "by_type": {
                str(qt.quota_type.value): {
                    "count": qt.count,
                    "total_limit": float(qt.total_limit or 0),
                    "total_usage": float(qt.total_usage or 0),
                    "utilization_percentage": round(float(qt.total_usage or 0) / max(float(qt.total_limit or 1), 1) * 100, 2)
                } for qt in quota_types
            },
            "by_period": {
                str(qp.quota_period.value): qp.count for qp in quota_periods
            },
            "top_departments": [
                {
                    "department_name": td.name,
                    "quota_count": td.quota_count,
                    "total_usage": float(td.total_usage or 0)
                } for td in top_departments
            ],
            "last_updated": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting quota analytics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get quota analytics"
        )

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def _calculate_quota_summary(quotas: List[DepartmentQuota]) -> Dict[str, Any]:
    """Calculate summary statistics for a list of quotas"""
    if not quotas:
        return {
            "total_quotas": 0,
            "active_quotas": 0,
            "exceeded_quotas": 0,
            "near_limit_quotas": 0,
            "total_monthly_cost_limit": 0.0,
            "total_monthly_cost_used": 0.0
        }
    
    summary = {
        "total_quotas": len(quotas),
        "active_quotas": 0,
        "exceeded_quotas": 0,
        "near_limit_quotas": 0,
        "total_monthly_cost_limit": 0.0,
        "total_monthly_cost_used": 0.0
    }
    
    for quota in quotas:
        if quota.status == QuotaStatus.ACTIVE:
            summary["active_quotas"] += 1
        
        if quota.is_exceeded():
            summary["exceeded_quotas"] += 1
        elif quota.is_near_limit():
            summary["near_limit_quotas"] += 1
        
        # Sum monthly cost quotas
        if quota.quota_type == QuotaType.COST and quota.quota_period == QuotaPeriod.MONTHLY:
            summary["total_monthly_cost_limit"] += float(quota.limit_value)
            summary["total_monthly_cost_used"] += float(quota.current_usage)
    
    return summary
