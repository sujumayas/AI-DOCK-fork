# AI Dock Quota Service
# This service handles all quota-related business logic and enforcement

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, select
from typing import List, Dict, Optional, Tuple, Any
from decimal import Decimal
from datetime import datetime, timedelta
import logging
from enum import Enum

from ..models.quota import DepartmentQuota, QuotaType, QuotaPeriod, QuotaStatus
from ..models.department import Department
from ..models.llm_config import LLMConfiguration
from ..models.usage_log import UsageLog
from ..core.database import get_db

# Set up logging for quota operations
logger = logging.getLogger(__name__)

class QuotaViolationType(str, Enum):
    """Types of quota violations for detailed error reporting"""
    COST_EXCEEDED = "cost_exceeded"
    TOKEN_EXCEEDED = "token_exceeded"
    REQUEST_EXCEEDED = "request_exceeded"
    QUOTA_SUSPENDED = "quota_suspended"
    QUOTA_INACTIVE = "quota_inactive"

class QuotaCheckResult:
    """
    Result of a quota check operation.
    
    This encapsulates whether a request can proceed and provides
    detailed information about quota status for logging and user feedback.
    """
    
    def __init__(
        self,
        allowed: bool,
        department_id: int,
        llm_config_id: Optional[int] = None,
        violation_type: Optional[QuotaViolationType] = None,
        violated_quota: Optional[DepartmentQuota] = None,
        message: str = "",
        quota_details: Dict[str, Any] = None
    ):
        self.allowed = allowed
        self.department_id = department_id
        self.llm_config_id = llm_config_id
        self.violation_type = violation_type
        self.violated_quota = violated_quota
        self.message = message
        self.quota_details = quota_details or {}
    
    @property
    def is_blocked(self) -> bool:
        """Check if request is blocked by quota"""
        return not self.allowed
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            "allowed": self.allowed,
            "department_id": self.department_id,
            "llm_config_id": self.llm_config_id,
            "violation_type": self.violation_type.value if self.violation_type else None,
            "message": self.message,
            "quota_details": self.quota_details
        }

class QuotaService:
    """
    Department Quota Service - The "Budget Enforcer" for AI Usage
    
    This service handles all quota-related operations:
    - Checking if requests are allowed before LLM calls
    - Updating usage counters after LLM calls
    - Managing quota resets and period rollovers
    - Providing quota summaries and analytics
    
    Key Design Patterns:
    - Service Layer: Encapsulates business logic separate from database/API
    - Async Operations: Non-blocking for better performance
    - Result Objects: Rich return values with detailed information
    - Transaction Safety: Ensures data consistency during updates
    
    Real-world analogy: Like a bank account system that checks your balance
    before allowing purchases and updates your spending after each transaction.
    """
    
    def __init__(self, db_session: Session):
        """
        Initialize quota service with database session.
        
        Args:
            db_session: SQLAlchemy database session for queries and updates
        """
        self.db = db_session
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    # =============================================================================
    # QUOTA CHECKING METHODS - "CAN WE AFFORD THIS REQUEST?"
    # =============================================================================
    
    async def check_department_quotas(
        self,
        department_id: int,
        llm_config_id: Optional[int],
        estimated_cost: Optional[Decimal] = None,
        estimated_tokens: Optional[int] = None,
        request_count: int = 1
    ) -> QuotaCheckResult:
        """
        Check if a department can make an LLM request within their quotas.
        
        This is the main method called before every LLM request to ensure
        the department hasn't exceeded their spending/usage limits.
        
        Args:
            department_id: Department making the request
            llm_config_id: LLM configuration being used (None for general quotas)
            estimated_cost: Estimated cost of the request in USD
            estimated_tokens: Estimated total tokens for the request
            request_count: Number of requests (usually 1)
            
        Returns:
            QuotaCheckResult indicating if request is allowed and why
        """
        self.logger.info(f"Checking quotas for department {department_id}, LLM config {llm_config_id}")
        
        try:
            # Reset any expired quotas first
            await self._reset_expired_quotas(department_id)
            
            # Get all applicable quotas for this department and LLM config
            quotas = await self._get_applicable_quotas(department_id, llm_config_id)
            
            if not quotas:
                self.logger.info(f"No quotas found for department {department_id}, allowing request")
                return QuotaCheckResult(
                    allowed=True,
                    department_id=department_id,
                    llm_config_id=llm_config_id,
                    message="No quotas configured - request allowed"
                )
            
            # Check each applicable quota
            for quota in quotas:
                violation = await self._check_single_quota(
                    quota, estimated_cost, estimated_tokens, request_count
                )
                
                if violation:
                    self.logger.warning(f"Quota violation detected: {violation.message}")
                    return violation
            
            # All quotas passed
            self.logger.info(f"All quota checks passed for department {department_id}")
            return QuotaCheckResult(
                allowed=True,
                department_id=department_id,
                llm_config_id=llm_config_id,
                message="All quota checks passed",
                quota_details=await self._get_quota_summary(department_id, llm_config_id)
            )
            
        except Exception as e:
            self.logger.error(f"Error checking quotas: {str(e)}")
            # In case of errors, we allow the request but log the issue
            # This prevents quota system failures from blocking all AI usage
            return QuotaCheckResult(
                allowed=True,
                department_id=department_id,
                llm_config_id=llm_config_id,
                message=f"Quota check failed (allowing request): {str(e)}"
            )
    
    async def _check_single_quota(
        self,
        quota: DepartmentQuota,
        estimated_cost: Optional[Decimal],
        estimated_tokens: Optional[int],
        request_count: int
    ) -> Optional[QuotaCheckResult]:
        """
        Check a single quota against the proposed usage.
        
        Args:
            quota: The quota to check
            estimated_cost: Estimated cost for cost-based quotas
            estimated_tokens: Estimated tokens for token-based quotas
            request_count: Number of requests for request-based quotas
            
        Returns:
            QuotaCheckResult if quota is violated, None if quota allows the request
        """
        # Check if quota is active and enforced
        if quota.status != QuotaStatus.ACTIVE:
            if quota.is_enforced:
                return QuotaCheckResult(
                    allowed=False,
                    department_id=quota.department_id,
                    llm_config_id=quota.llm_config_id,
                    violation_type=QuotaViolationType.QUOTA_SUSPENDED,
                    violated_quota=quota,
                    message=f"Quota '{quota.name}' is not active (status: {quota.status.value})"
                )
            else:
                # Quota not enforced, just log but allow
                self.logger.info(f"Quota '{quota.name}' not active but not enforced - allowing")
                return None
        
        # Check based on quota type
        if quota.quota_type == QuotaType.COST:
            return await self._check_cost_quota(quota, estimated_cost)
        elif quota.quota_type == QuotaType.TOKENS:
            return await self._check_token_quota(quota, estimated_tokens)
        elif quota.quota_type == QuotaType.REQUESTS:
            return await self._check_request_quota(quota, request_count)
        
        return None
    
    async def _check_cost_quota(
        self, 
        quota: DepartmentQuota, 
        estimated_cost: Optional[Decimal]
    ) -> Optional[QuotaCheckResult]:
        """Check if a cost-based quota allows the request"""
        if estimated_cost is None:
            # If we don't have cost estimate, allow the request
            # The actual cost will be tracked after the LLM call
            return None
        
        if not quota.can_accommodate_usage(estimated_cost):
            remaining = quota.get_remaining_quota()
            return QuotaCheckResult(
                allowed=False,
                department_id=quota.department_id,
                llm_config_id=quota.llm_config_id,
                violation_type=QuotaViolationType.COST_EXCEEDED,
                violated_quota=quota,
                message=f"Cost quota exceeded: need ${estimated_cost}, only ${remaining} remaining",
                quota_details={
                    "quota_name": quota.name,
                    "limit": float(quota.limit_value),
                    "current_usage": float(quota.current_usage),
                    "remaining": float(remaining),
                    "requested": float(estimated_cost),
                    "quota_type": "cost"
                }
            )
        
        return None
    
    async def _check_token_quota(
        self, 
        quota: DepartmentQuota, 
        estimated_tokens: Optional[int]
    ) -> Optional[QuotaCheckResult]:
        """Check if a token-based quota allows the request"""
        if estimated_tokens is None:
            return None
        
        token_decimal = Decimal(str(estimated_tokens))
        if not quota.can_accommodate_usage(token_decimal):
            remaining = quota.get_remaining_quota()
            return QuotaCheckResult(
                allowed=False,
                department_id=quota.department_id,
                llm_config_id=quota.llm_config_id,
                violation_type=QuotaViolationType.TOKEN_EXCEEDED,
                violated_quota=quota,
                message=f"Token quota exceeded: need {estimated_tokens}, only {int(remaining)} remaining",
                quota_details={
                    "quota_name": quota.name,
                    "limit": int(quota.limit_value),
                    "current_usage": int(quota.current_usage),
                    "remaining": int(remaining),
                    "requested": estimated_tokens,
                    "quota_type": "tokens"
                }
            )
        
        return None
    
    async def _check_request_quota(
        self, 
        quota: DepartmentQuota, 
        request_count: int
    ) -> Optional[QuotaCheckResult]:
        """Check if a request-count quota allows the request"""
        request_decimal = Decimal(str(request_count))
        if not quota.can_accommodate_usage(request_decimal):
            remaining = quota.get_remaining_quota()
            return QuotaCheckResult(
                allowed=False,
                department_id=quota.department_id,
                llm_config_id=quota.llm_config_id,
                violation_type=QuotaViolationType.REQUEST_EXCEEDED,
                violated_quota=quota,
                message=f"Request quota exceeded: need {request_count}, only {int(remaining)} remaining",
                quota_details={
                    "quota_name": quota.name,
                    "limit": int(quota.limit_value),
                    "current_usage": int(quota.current_usage),
                    "remaining": int(remaining),
                    "requested": request_count,
                    "quota_type": "requests"
                }
            )
        
        return None
    
    # =============================================================================
    # USAGE TRACKING METHODS - "UPDATE SPENDING AFTER PURCHASE"
    # =============================================================================
    
    async def record_usage(
        self,
        department_id: int,
        llm_config_id: Optional[int],
        actual_cost: Optional[Decimal] = None,
        total_tokens: Optional[int] = None,
        request_count: int = 1
    ) -> Dict[str, Any]:
        """
        Record actual usage against department quotas.
        
        This is called after an LLM request completes to update the
        usage counters in all applicable quotas.
        
        Args:
            department_id: Department that made the request
            llm_config_id: LLM configuration used
            actual_cost: Actual cost incurred
            total_tokens: Total tokens used
            request_count: Number of requests made
            
        Returns:
            Dictionary with update results and quota status
        """
        self.logger.info(f"Recording usage for department {department_id}: cost=${actual_cost}, tokens={total_tokens}")
        
        try:
            # Get all applicable quotas
            quotas = await self._get_applicable_quotas(department_id, llm_config_id)
            updated_quotas = []
            
            for quota in quotas:
                if await self._update_quota_usage(quota, actual_cost, total_tokens, request_count):
                    updated_quotas.append({
                        "quota_id": quota.id,
                        "quota_name": quota.name,
                        "quota_type": quota.quota_type.value,
                        "usage_before": float(quota.current_usage) - self._get_usage_amount(quota, actual_cost, total_tokens, request_count),
                        "usage_after": float(quota.current_usage),
                        "remaining": float(quota.get_remaining_quota()),
                        "percentage_used": quota.get_usage_percentage()
                    })
            
            # Commit the changes
            self.db.commit()
            
            self.logger.info(f"Successfully updated {len(updated_quotas)} quotas")
            
            return {
                "success": True,
                "updated_quotas": updated_quotas,
                "quota_summary": await self._get_quota_summary(department_id, llm_config_id)
            }
            
        except Exception as e:
            self.logger.error(f"Error recording usage: {str(e)}")
            self.db.rollback()
            return {
                "success": False,
                "error": str(e),
                "updated_quotas": []
            }
    
    async def _update_quota_usage(
        self,
        quota: DepartmentQuota,
        actual_cost: Optional[Decimal],
        total_tokens: Optional[int],
        request_count: int
    ) -> bool:
        """
        Update a single quota's usage based on the quota type.
        
        Returns:
            True if quota was updated, False otherwise
        """
        usage_amount = self._get_usage_amount(quota, actual_cost, total_tokens, request_count)
        
        if usage_amount > 0:
            quota.add_usage(usage_amount)
            self.logger.debug(f"Updated quota '{quota.name}': added {usage_amount}, new total: {quota.current_usage}")
            return True
        
        return False
    
    def _get_usage_amount(
        self,
        quota: DepartmentQuota,
        actual_cost: Optional[Decimal],
        total_tokens: Optional[int],
        request_count: int
    ) -> Decimal:
        """Get the usage amount to add to a quota based on its type"""
        if quota.quota_type == QuotaType.COST and actual_cost is not None:
            return actual_cost
        elif quota.quota_type == QuotaType.TOKENS and total_tokens is not None:
            return Decimal(str(total_tokens))
        elif quota.quota_type == QuotaType.REQUESTS:
            return Decimal(str(request_count))
        
        return Decimal('0')
    
    # =============================================================================
    # QUOTA MANAGEMENT METHODS - CRUD OPERATIONS
    # =============================================================================
    
    async def create_quota(
        self,
        department_id: int,
        quota_type: QuotaType,
        quota_period: QuotaPeriod,
        limit_value: Decimal,
        name: str,
        created_by: str,
        llm_config_id: Optional[int] = None,
        description: Optional[str] = None,
        is_enforced: bool = True
    ) -> DepartmentQuota:
        """
        Create a new department quota.
        
        Args:
            department_id: Department this quota applies to
            quota_type: Type of quota (cost, tokens, requests)
            quota_period: Reset period (daily, monthly, etc.)
            limit_value: The limit amount
            name: Human-readable name
            created_by: Admin creating the quota
            llm_config_id: Optional LLM config (None for all providers)
            description: Optional description
            is_enforced: Whether to enforce this quota
            
        Returns:
            The created DepartmentQuota instance
        """
        self.logger.info(f"Creating quota: {name} for department {department_id}")
        
        # Validate department exists
        department = self.db.query(Department).filter(Department.id == department_id).first()
        if not department:
            raise ValueError(f"Department {department_id} not found")
        
        # Validate LLM config if provided
        if llm_config_id:
            llm_config = self.db.query(LLMConfiguration).filter(LLMConfiguration.id == llm_config_id).first()
            if not llm_config:
                raise ValueError(f"LLM configuration {llm_config_id} not found")
        
        # Create the quota
        quota = DepartmentQuota(
            department_id=department_id,
            llm_config_id=llm_config_id,
            quota_type=quota_type,
            quota_period=quota_period,
            limit_value=limit_value,
            name=name,
            description=description,
            created_by=created_by,
            is_enforced=is_enforced
        )
        
        # Set up period dates
        quota._update_period_dates()
        
        self.db.add(quota)
        self.db.commit()
        self.db.refresh(quota)
        
        self.logger.info(f"Created quota {quota.id}: {quota.name}")
        return quota
    
    async def get_quota(self, quota_id: int) -> Optional[DepartmentQuota]:
        """Get a quota by ID"""
        return self.db.query(DepartmentQuota).filter(DepartmentQuota.id == quota_id).first()
    
    async def update_quota(
        self,
        quota_id: int,
        **updates
    ) -> Optional[DepartmentQuota]:
        """
        Update a quota with new values.
        
        Args:
            quota_id: ID of quota to update
            **updates: Fields to update
            
        Returns:
            Updated quota or None if not found
        """
        quota = await self.get_quota(quota_id)
        if not quota:
            return None
        
        # Update allowed fields
        allowed_fields = {
            'name', 'description', 'limit_value', 'is_enforced', 
            'status', 'quota_type', 'quota_period'
        }
        
        for field, value in updates.items():
            if field in allowed_fields and hasattr(quota, field):
                setattr(quota, field, value)
        
        # If period changed, update period dates
        if 'quota_period' in updates:
            quota._update_period_dates()
        
        self.db.commit()
        self.db.refresh(quota)
        
        self.logger.info(f"Updated quota {quota_id}")
        return quota
    
    async def delete_quota(self, quota_id: int) -> bool:
        """
        Delete a quota.
        
        Args:
            quota_id: ID of quota to delete
            
        Returns:
            True if deleted, False if not found
        """
        quota = await self.get_quota(quota_id)
        if not quota:
            return False
        
        self.db.delete(quota)
        self.db.commit()
        
        self.logger.info(f"Deleted quota {quota_id}: {quota.name}")
        return True
    
    async def get_department_quotas(
        self, 
        department_id: int,
        include_inactive: bool = False
    ) -> List[DepartmentQuota]:
        """
        Get all quotas for a department.
        
        Args:
            department_id: Department ID
            include_inactive: Whether to include inactive quotas
            
        Returns:
            List of quotas for the department
        """
        query = self.db.query(DepartmentQuota).filter(DepartmentQuota.department_id == department_id)
        
        if not include_inactive:
            query = query.filter(DepartmentQuota.status != QuotaStatus.INACTIVE)
        
        return query.order_by(DepartmentQuota.name).all()
    
    # =============================================================================
    # QUOTA RESET AND MAINTENANCE
    # =============================================================================
    
    async def reset_quota(self, quota_id: int) -> bool:
        """
        Manually reset a quota to zero usage.
        
        Args:
            quota_id: ID of quota to reset
            
        Returns:
            True if reset successful
        """
        quota = await self.get_quota(quota_id)
        if not quota:
            return False
        
        quota.reset_usage()
        self.db.commit()
        
        self.logger.info(f"Manually reset quota {quota_id}: {quota.name}")
        return True
    
    async def _reset_expired_quotas(self, department_id: Optional[int] = None) -> int:
        """
        Reset quotas that have expired (past their period end).
        
        Args:
            department_id: Optional department filter
            
        Returns:
            Number of quotas reset
        """
        query = self.db.query(DepartmentQuota).filter(
            DepartmentQuota.next_reset_at <= datetime.utcnow(),
            DepartmentQuota.status == QuotaStatus.ACTIVE
        )
        
        if department_id:
            query = query.filter(DepartmentQuota.department_id == department_id)
        
        expired_quotas = query.all()
        reset_count = 0
        
        for quota in expired_quotas:
            quota.reset_usage()
            reset_count += 1
            self.logger.info(f"Auto-reset expired quota {quota.id}: {quota.name}")
        
        if reset_count > 0:
            self.db.commit()
            self.logger.info(f"Auto-reset {reset_count} expired quotas")
        
        return reset_count
    
    async def reset_all_quotas_for_period(self, quota_period: QuotaPeriod) -> int:
        """
        Reset all quotas of a specific period type.
        
        Useful for maintenance tasks like monthly resets.
        
        Args:
            quota_period: Period type to reset
            
        Returns:
            Number of quotas reset
        """
        quotas = self.db.query(DepartmentQuota).filter(
            DepartmentQuota.quota_period == quota_period,
            DepartmentQuota.status == QuotaStatus.ACTIVE
        ).all()
        
        reset_count = 0
        for quota in quotas:
            quota.reset_usage()
            reset_count += 1
        
        if reset_count > 0:
            self.db.commit()
            self.logger.info(f"Reset {reset_count} quotas for period {quota_period.value}")
        
        return reset_count
    
    # =============================================================================
    # UTILITY AND HELPER METHODS
    # =============================================================================
    
    async def _get_applicable_quotas(
        self, 
        department_id: int, 
        llm_config_id: Optional[int]
    ) -> List[DepartmentQuota]:
        """
        Get all quotas that apply to a specific department and LLM config.
        
        This includes:
        - Quotas specific to the department + LLM config
        - Quotas for the department that apply to all LLM configs (llm_config_id = None)
        
        Args:
            department_id: Department making the request
            llm_config_id: LLM configuration being used
            
        Returns:
            List of applicable quotas
        """
        # Query for quotas that apply to this department and either:
        # 1. Specific to this LLM config, OR
        # 2. Apply to all LLM configs (llm_config_id is None)
        query = self.db.query(DepartmentQuota).filter(
            DepartmentQuota.department_id == department_id,
            or_(
                DepartmentQuota.llm_config_id == llm_config_id,
                DepartmentQuota.llm_config_id.is_(None)
            )
        ).order_by(DepartmentQuota.name)
        
        return query.all()
    
    async def _get_quota_summary(
        self, 
        department_id: int, 
        llm_config_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get a summary of quota status for a department.
        
        Returns:
            Dictionary with quota summary information
        """
        quotas = await self._get_applicable_quotas(department_id, llm_config_id)
        
        summary = {
            "department_id": department_id,
            "llm_config_id": llm_config_id,
            "total_quotas": len(quotas),
            "active_quotas": 0,
            "exceeded_quotas": 0,
            "near_limit_quotas": 0,
            "quotas": []
        }
        
        for quota in quotas:
            quota_info = {
                "id": quota.id,
                "name": quota.name,
                "type": quota.quota_type.value,
                "period": quota.quota_period.value,
                "limit": float(quota.limit_value),
                "usage": float(quota.current_usage),
                "remaining": float(quota.get_remaining_quota()),
                "percentage": quota.get_usage_percentage(),
                "status": quota.status.value,
                "is_enforced": quota.is_enforced,
                "is_exceeded": quota.is_exceeded(),
                "is_near_limit": quota.is_near_limit(),
                "next_reset": quota.next_reset_at.isoformat() if quota.next_reset_at else None
            }
            
            summary["quotas"].append(quota_info)
            
            if quota.status == QuotaStatus.ACTIVE:
                summary["active_quotas"] += 1
            if quota.is_exceeded():
                summary["exceeded_quotas"] += 1
            if quota.is_near_limit():
                summary["near_limit_quotas"] += 1
        
        return summary
    
    async def get_department_quota_status(self, department_id: int) -> Dict[str, Any]:
        """
        Get comprehensive quota status for a department.
        
        This provides a full overview of all quotas, their status,
        and overall budget health for admin dashboards.
        
        Args:
            department_id: Department to get status for
            
        Returns:
            Comprehensive quota status dictionary
        """
        # Reset expired quotas first
        await self._reset_expired_quotas(department_id)
        
        # Get all quotas for this department
        all_quotas = await self.get_department_quotas(department_id, include_inactive=True)
        
        status = {
            "department_id": department_id,
            "last_updated": datetime.utcnow().isoformat(),
            "overall_status": "healthy",  # Will be calculated below
            "total_quotas": len(all_quotas),
            "active_quotas": 0,
            "exceeded_quotas": 0,
            "near_limit_quotas": 0,
            "suspended_quotas": 0,
            "inactive_quotas": 0,
            "quotas_by_type": {
                "cost": {"count": 0, "total_limit": 0, "total_usage": 0},
                "tokens": {"count": 0, "total_limit": 0, "total_usage": 0},
                "requests": {"count": 0, "total_limit": 0, "total_usage": 0}
            },
            "quotas": []
        }
        
        for quota in all_quotas:
            quota_dict = quota.to_dict()
            status["quotas"].append(quota_dict)
            
            # Count by status
            if quota.status == QuotaStatus.ACTIVE:
                status["active_quotas"] += 1
            elif quota.status == QuotaStatus.SUSPENDED:
                status["suspended_quotas"] += 1
            elif quota.status == QuotaStatus.INACTIVE:
                status["inactive_quotas"] += 1
            
            # Count violations
            if quota.is_exceeded():
                status["exceeded_quotas"] += 1
            elif quota.is_near_limit():
                status["near_limit_quotas"] += 1
            
            # Aggregate by type
            quota_type = quota.quota_type.value
            if quota_type in status["quotas_by_type"]:
                status["quotas_by_type"][quota_type]["count"] += 1
                status["quotas_by_type"][quota_type]["total_limit"] += float(quota.limit_value)
                status["quotas_by_type"][quota_type]["total_usage"] += float(quota.current_usage)
        
        # Determine overall status
        if status["exceeded_quotas"] > 0:
            status["overall_status"] = "exceeded"
        elif status["near_limit_quotas"] > 0:
            status["overall_status"] = "warning"
        elif status["active_quotas"] == 0:
            status["overall_status"] = "no_quotas"
        
        return status

# =============================================================================
# FACTORY FUNCTIONS FOR COMMON QUOTA OPERATIONS
# =============================================================================

async def create_default_department_quotas(
    db_session: Session,
    department_id: int,
    created_by: str
) -> List[DepartmentQuota]:
    """
    Create default quotas for a new department.
    
    Sets up sensible default limits:
    - $1000/month total cost across all providers
    - 500 requests/day as a safety net
    
    Args:
        db_session: Database session
        department_id: Department to create quotas for
        created_by: Admin creating the quotas
        
    Returns:
        List of created quotas
    """
    service = QuotaService(db_session)
    quotas = []
    
    # Monthly cost limit across all providers
    monthly_cost = await service.create_quota(
        department_id=department_id,
        quota_type=QuotaType.COST,
        quota_period=QuotaPeriod.MONTHLY,
        limit_value=Decimal('1000.00'),
        name=f"Monthly Budget - All Providers",
        created_by=created_by,
        description="Default monthly spending limit across all AI providers"
    )
    quotas.append(monthly_cost)
    
    # Daily request safety limit
    daily_requests = await service.create_quota(
        department_id=department_id,
        quota_type=QuotaType.REQUESTS,
        quota_period=QuotaPeriod.DAILY,
        limit_value=Decimal('500'),
        name=f"Daily Request Safety Limit",
        created_by=created_by,
        description="Safety limit to prevent excessive daily usage"
    )
    quotas.append(daily_requests)
    
    return quotas

def get_quota_service(db_session: Session) -> QuotaService:
    """
    Factory function to get a quota service instance.
    
    Args:
        db_session: Database session
        
    Returns:
        QuotaService instance
    """
    return QuotaService(db_session)
