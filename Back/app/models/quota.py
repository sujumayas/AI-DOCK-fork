# AI Dock Quota Management Model
# This model defines usage quotas/limits for departments to control AI spending

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timedelta
from enum import Enum
from decimal import Decimal
from typing import Dict, Any, Optional, Tuple
import calendar

from ..core.database import Base

# =============================================================================
# ENUMS - THESE DEFINE THE VALID OPTIONS FOR OUR QUOTA SYSTEM
# =============================================================================

class QuotaType(str, Enum):
    """
    Types of quotas we can set for departments.
    
    This enum defines what we're limiting:
    - COST: Limit spending in dollars/euros ($1000/month)
    - TOKENS: Limit total tokens used (100K tokens/month) 
    - REQUESTS: Limit number of API calls (500 requests/day)
    
    Why use enums? They prevent typos and ensure consistent values!
    """
    COST = "cost"           # Dollar-based limits ($500/month)
    TOKENS = "tokens"       # Token-based limits (50,000 tokens/month)
    REQUESTS = "requests"   # Request count limits (100 requests/day)

class QuotaPeriod(str, Enum):
    """
    Time periods for quota resets.
    
    This defines how often quotas reset:
    - MONTHLY: Reset on 1st of each month (most common)
    - DAILY: Reset every day at midnight
    - WEEKLY: Reset every Monday
    - YEARLY: Reset on January 1st
    
    Business insight: Most companies use monthly budgets!
    """
    DAILY = "daily"         # Reset every day at midnight
    WEEKLY = "weekly"       # Reset every Monday
    MONTHLY = "monthly"     # Reset on 1st of each month
    YEARLY = "yearly"       # Reset on January 1st

class QuotaStatus(str, Enum):
    """
    Current status of a quota.
    
    This tells us the state of each quota:
    - ACTIVE: Normal operation, quota is enforced
    - SUSPENDED: Temporarily disabled (maybe for emergencies)
    - EXCEEDED: Over the limit, requests should be blocked
    - INACTIVE: Permanently disabled
    """
    ACTIVE = "active"       # Normal operation
    SUSPENDED = "suspended" # Temporarily disabled
    EXCEEDED = "exceeded"   # Over the limit
    INACTIVE = "inactive"   # Permanently disabled

# =============================================================================
# MAIN QUOTA MODEL
# =============================================================================

class DepartmentQuota(Base):
    """
    Department Quota Model - The "Speed Limit" for AI Usage
    
    This table defines spending/usage limits for each department.
    Think of it as setting rules like:
    "Engineering department can spend max $2000/month on OpenAI GPT-4"
    
    Key Features:
    - Links department + LLM provider + quota type
    - Supports multiple limit types (cost, tokens, requests)
    - Automatic reset periods (monthly, daily, etc.)
    - Real-time usage tracking
    - Flexible enforcement policies
    
    Real-world analogy: Like setting spending limits on different credit cards
    for different family members (departments) at different stores (LLM providers).
    """
    
    __tablename__ = "department_quotas"
    
    # =============================================================================
    # PRIMARY IDENTIFICATION
    # =============================================================================
    
    id = Column(Integer, primary_key=True, index=True)
    """Unique identifier for this quota rule"""
    
    # =============================================================================
    # RELATIONSHIP KEYS - WHO AND WHAT IS LIMITED
    # =============================================================================
    
    department_id = Column(
        Integer, 
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    """Which department this quota applies to"""
    
    llm_config_id = Column(
        Integer,
        ForeignKey("llm_configurations.id", ondelete="CASCADE"), 
        nullable=True,  # NULL means "all LLM providers"
        index=True
    )
    """
    Which LLM configuration this quota applies to.
    
    Examples:
    - llm_config_id = 1 (specific OpenAI config)
    - llm_config_id = 2 (specific Claude config)
    - llm_config_id = NULL (applies to ALL LLM providers)
    
    This gives us flexibility:
    - Set different limits per provider
    - Set overall limits across all providers
    """
    
    # =============================================================================
    # QUOTA CONFIGURATION - THE ACTUAL LIMITS
    # =============================================================================
    
    quota_type = Column(
        SQLEnum(QuotaType),
        nullable=False,
        index=True
    )
    """
    What type of limit this is:
    - COST: Dollar amount ($1000)
    - TOKENS: Token count (50,000)
    - REQUESTS: Request count (100)
    """
    
    quota_period = Column(
        SQLEnum(QuotaPeriod),
        nullable=False,
        default=QuotaPeriod.MONTHLY
    )
    """How often this quota resets (monthly, daily, etc.)"""
    
    limit_value = Column(
        Numeric(15, 4),  # Up to 99,999,999,999.9999 (very large numbers)
        nullable=False
    )
    """
    The actual limit amount.
    
    Examples:
    - For COST quota: 1000.00 (means $1000)
    - For TOKENS quota: 50000.0 (means 50,000 tokens)
    - For REQUESTS quota: 100.0 (means 100 requests)
    
    Why Numeric? Because we need precise decimal calculations for money!
    """
    
    # =============================================================================
    # CURRENT USAGE TRACKING
    # =============================================================================
    
    current_usage = Column(
        Numeric(15, 4),
        nullable=False,
        default=Decimal('0.0000')
    )
    """
    Current usage against this quota for the current period.
    
    This gets reset every quota_period and incremented with each usage.
    
    Examples:
    - If limit_value=1000 and current_usage=750, there's $250 left
    - If limit_value=50000 and current_usage=45000, there are 5000 tokens left
    """
    
    # =============================================================================
    # STATUS AND CONTROL
    # =============================================================================
    
    status = Column(
        SQLEnum(QuotaStatus),
        nullable=False,
        default=QuotaStatus.ACTIVE
    )
    """Current status of this quota"""
    
    is_enforced = Column(
        Boolean,
        nullable=False,
        default=True
    )
    """
    Whether to actually enforce this quota.
    
    Business scenarios:
    - True: Block requests when limit exceeded (strict enforcement)
    - False: Track usage but allow overages (monitoring only)
    
    This gives admins flexibility during emergencies or special projects!
    """
    
    # =============================================================================
    # METADATA AND RESET TRACKING
    # =============================================================================
    
    period_start = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now()
    )
    """When the current quota period started"""
    
    period_end = Column(
        DateTime(timezone=True),
        nullable=False
    )
    """When the current quota period ends (auto-calculated)"""
    
    last_reset_at = Column(
        DateTime(timezone=True),
        nullable=True
    )
    """When this quota was last reset (for debugging)"""
    
    next_reset_at = Column(
        DateTime(timezone=True),
        nullable=False
    )
    """When this quota will next reset (pre-calculated for efficiency)"""
    
    # =============================================================================
    # ADMINISTRATIVE FIELDS
    # =============================================================================
    
    name = Column(
        String(200),
        nullable=False
    )
    """
    Human-friendly name for this quota.
    
    Examples:
    - "Engineering OpenAI Monthly Cost Limit"
    - "Sales Claude Token Allowance" 
    - "Marketing Daily Request Quota"
    """
    
    description = Column(
        String(500),
        nullable=True
    )
    """Optional description explaining the business reason for this quota"""
    
    created_by = Column(
        String(100),
        nullable=False
    )
    """Email/username of admin who created this quota"""
    
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    """When this quota was created"""
    
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    """When this quota was last modified"""
    
    # =============================================================================
    # RELATIONSHIPS - HOW THIS CONNECTS TO OTHER TABLES
    # =============================================================================
    
    # Many quotas can belong to one department
    department = relationship("Department", backref="quotas")
    
    # Many quotas can reference one LLM configuration (or none for global quotas)
    llm_config = relationship("LLMConfiguration", backref="quotas")
    
    # =============================================================================
    # MODEL METHODS - BUSINESS LOGIC FOR QUOTA MANAGEMENT
    # =============================================================================
    
    def __repr__(self) -> str:
        """String representation for debugging"""
        provider = self.llm_config.name if self.llm_config else "ALL_PROVIDERS"
        return f"<DepartmentQuota(dept={self.department.name}, provider={provider}, type={self.quota_type}, limit={self.limit_value}, used={self.current_usage})>"
    
    def __str__(self) -> str:
        """Human-friendly string representation"""
        return self.name
    
    # =============================================================================
    # QUOTA CHECKING METHODS
    # =============================================================================
    
    def get_remaining_quota(self) -> Decimal:
        """
        Calculate how much quota is left.
        
        Returns:
            Remaining quota amount (limit - current_usage)
        """
        return Decimal(str(self.limit_value)) - Decimal(str(self.current_usage))
    
    def get_usage_percentage(self) -> float:
        """
        Calculate what percentage of quota has been used.
        
        Returns:
            Percentage from 0.0 to 100.0 (or higher if exceeded)
        """
        if self.limit_value == 0:
            return 0.0
        
        usage_percent = (float(self.current_usage) / float(self.limit_value)) * 100
        return round(usage_percent, 2)
    
    def is_exceeded(self) -> bool:
        """
        Check if quota has been exceeded.
        
        Returns:
            True if current usage >= limit
        """
        return self.current_usage >= self.limit_value
    
    def is_near_limit(self, threshold_percentage: float = 80.0) -> bool:
        """
        Check if quota is approaching the limit.
        
        Args:
            threshold_percentage: Percentage to consider "near" (default 80%)
            
        Returns:
            True if usage is above threshold percentage
        """
        return self.get_usage_percentage() >= threshold_percentage
    
    def can_accommodate_usage(self, requested_amount: Decimal) -> bool:
        """
        Check if a requested usage amount would fit within quota.
        
        Args:
            requested_amount: Amount being requested (cost, tokens, etc.)
            
        Returns:
            True if request can be accommodated without exceeding quota
        """
        projected_usage = self.current_usage + requested_amount
        return projected_usage <= self.limit_value
    
    # =============================================================================
    # USAGE TRACKING METHODS
    # =============================================================================
    
    def add_usage(self, amount: Decimal) -> bool:
        """
        Add usage to current quota.
        
        Args:
            amount: Amount to add to current usage
            
        Returns:
            True if usage was added successfully
        """
        if not isinstance(amount, Decimal):
            amount = Decimal(str(amount))
        
        self.current_usage += amount
        
        # Update status if quota exceeded
        if self.is_exceeded():
            self.status = QuotaStatus.EXCEEDED
            
        return True
    
    def reset_usage(self) -> None:
        """
        Reset current usage to zero and update period dates.
        
        This is called when a quota period expires (monthly, daily, etc.)
        """
        self.current_usage = Decimal('0.0000')
        self.status = QuotaStatus.ACTIVE
        self.last_reset_at = datetime.utcnow()
        
        # Calculate next period dates
        self._update_period_dates()
    
    # =============================================================================
    # PERIOD MANAGEMENT METHODS
    # =============================================================================
    
    def _update_period_dates(self) -> None:
        """
        Update period_start, period_end, and next_reset_at based on quota_period.
        
        This is internal business logic for calculating when quotas reset.
        """
        now = datetime.utcnow()
        
        if self.quota_period == QuotaPeriod.DAILY:
            # Reset daily at midnight
            self.period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            self.period_end = self.period_start + timedelta(days=1)
            self.next_reset_at = self.period_end
            
        elif self.quota_period == QuotaPeriod.WEEKLY:
            # Reset weekly on Monday
            days_since_monday = now.weekday()  # Monday = 0
            self.period_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
            self.period_end = self.period_start + timedelta(days=7)
            self.next_reset_at = self.period_end
            
        elif self.quota_period == QuotaPeriod.MONTHLY:
            # Reset monthly on 1st
            self.period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            # Calculate last day of current month
            if now.month == 12:
                next_month = now.replace(year=now.year + 1, month=1, day=1)
            else:
                next_month = now.replace(month=now.month + 1, day=1)
            
            self.period_end = next_month
            self.next_reset_at = next_month
            
        elif self.quota_period == QuotaPeriod.YEARLY:
            # Reset yearly on January 1st
            self.period_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            self.period_end = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            self.next_reset_at = self.period_end
    
    def needs_reset(self) -> bool:
        """
        Check if this quota needs to be reset based on current time.
        
        Returns:
            True if current time is past next_reset_at
        """
        return datetime.utcnow() >= self.next_reset_at
    
    # =============================================================================
    # FACTORY METHODS FOR CREATING COMMON QUOTAS
    # =============================================================================
    
    @classmethod
    def create_monthly_cost_quota(
        cls,
        department_id: int,
        llm_config_id: Optional[int],
        monthly_limit: Decimal,
        name: str,
        created_by: str,
        description: Optional[str] = None
    ) -> 'DepartmentQuota':
        """
        Factory method for creating monthly cost quotas (most common type).
        
        Args:
            department_id: Department this applies to
            llm_config_id: LLM config (None for all providers)
            monthly_limit: Dollar limit per month
            name: Human-friendly name
            created_by: Admin creating this quota
            description: Optional description
            
        Returns:
            New DepartmentQuota instance
        """
        quota = cls(
            department_id=department_id,
            llm_config_id=llm_config_id,
            quota_type=QuotaType.COST,
            quota_period=QuotaPeriod.MONTHLY,
            limit_value=monthly_limit,
            name=name,
            description=description,
            created_by=created_by
        )
        
        # Set up period dates
        quota._update_period_dates()
        return quota
    
    @classmethod
    def create_daily_request_quota(
        cls,
        department_id: int,
        llm_config_id: Optional[int],
        daily_request_limit: int,
        name: str,
        created_by: str,
        description: Optional[str] = None
    ) -> 'DepartmentQuota':
        """
        Factory method for creating daily request quotas.
        
        Args:
            department_id: Department this applies to
            llm_config_id: LLM config (None for all providers)
            daily_request_limit: Number of requests per day
            name: Human-friendly name
            created_by: Admin creating this quota
            description: Optional description
            
        Returns:
            New DepartmentQuota instance
        """
        quota = cls(
            department_id=department_id,
            llm_config_id=llm_config_id,
            quota_type=QuotaType.REQUESTS,
            quota_period=QuotaPeriod.DAILY,
            limit_value=Decimal(str(daily_request_limit)),
            name=name,
            description=description,
            created_by=created_by
        )
        
        quota._update_period_dates()
        return quota
    
    # =============================================================================
    # UTILITY METHODS
    # =============================================================================
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert quota to dictionary for API responses.
        
        Returns:
            Dictionary representation of quota
        """
        return {
            "id": self.id,
            "department_id": self.department_id,
            "department_name": self.department.name if self.department else None,
            "llm_config_id": self.llm_config_id,
            "llm_config_name": self.llm_config.name if self.llm_config else "All Providers",
            "quota_type": self.quota_type.value,
            "quota_period": self.quota_period.value,
            "limit_value": float(self.limit_value),
            "current_usage": float(self.current_usage),
            "remaining_quota": float(self.get_remaining_quota()),
            "usage_percentage": self.get_usage_percentage(),
            "status": self.status.value,
            "is_enforced": self.is_enforced,
            "is_exceeded": self.is_exceeded(),
            "is_near_limit": self.is_near_limit(),
            "name": self.name,
            "description": self.description,
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
            "next_reset_at": self.next_reset_at.isoformat() if self.next_reset_at else None,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

# =============================================================================
# HELPER FUNCTIONS FOR QUOTA MANAGEMENT
# =============================================================================

def create_default_quotas_for_department(department_id: int, created_by: str) -> list[DepartmentQuota]:
    """
    Create default quotas when a new department is created.
    
    This sets up sensible default limits:
    - $1000/month total cost across all providers
    - 100 requests/day per provider as a safety net
    
    Args:
        department_id: ID of the new department
        created_by: Admin creating the department
        
    Returns:
        List of default quota instances
    """
    quotas = []
    
    # Overall monthly cost limit across all providers
    monthly_cost_quota = DepartmentQuota.create_monthly_cost_quota(
        department_id=department_id,
        llm_config_id=None,  # Apply to all providers
        monthly_limit=Decimal('1000.00'),
        name=f"Monthly Cost Limit (All Providers)",
        created_by=created_by,
        description="Default monthly spending limit across all AI providers"
    )
    quotas.append(monthly_cost_quota)
    
    # Daily request safety net (prevents runaway usage)
    daily_request_quota = DepartmentQuota.create_daily_request_quota(
        department_id=department_id,
        llm_config_id=None,  # Apply to all providers
        daily_request_limit=500,
        name=f"Daily Request Safety Limit",
        created_by=created_by,
        description="Safety limit to prevent excessive daily usage"
    )
    quotas.append(daily_request_quota)
    
    return quotas

def get_quota_summary_for_department(session, department_id: int) -> Dict[str, Any]:
    """
    Get a summary of all quotas for a department.
    
    Args:
        session: Database session
        department_id: Department to summarize
        
    Returns:
        Summary dictionary with quota statistics
    """
    from sqlalchemy import func
    
    # Query all quotas for this department
    quotas = session.query(DepartmentQuota).filter(
        DepartmentQuota.department_id == department_id,
        DepartmentQuota.status != QuotaStatus.INACTIVE
    ).all()
    
    summary = {
        "department_id": department_id,
        "total_quotas": len(quotas),
        "active_quotas": len([q for q in quotas if q.status == QuotaStatus.ACTIVE]),
        "exceeded_quotas": len([q for q in quotas if q.is_exceeded()]),
        "near_limit_quotas": len([q for q in quotas if q.is_near_limit()]),
        "quotas_by_type": {},
        "quotas_by_period": {},
        "total_monthly_cost_limit": 0.0,
        "total_monthly_cost_used": 0.0
    }
    
    # Analyze quota breakdown
    for quota in quotas:
        # By type
        quota_type = quota.quota_type.value
        if quota_type not in summary["quotas_by_type"]:
            summary["quotas_by_type"][quota_type] = 0
        summary["quotas_by_type"][quota_type] += 1
        
        # By period
        quota_period = quota.quota_period.value
        if quota_period not in summary["quotas_by_period"]:
            summary["quotas_by_period"][quota_period] = 0
        summary["quotas_by_period"][quota_period] += 1
        
        # Total monthly cost tracking
        if quota.quota_type == QuotaType.COST and quota.quota_period == QuotaPeriod.MONTHLY:
            summary["total_monthly_cost_limit"] += float(quota.limit_value)
            summary["total_monthly_cost_used"] += float(quota.current_usage)
    
    return summary
