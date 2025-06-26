# AI Dock LLM Quota Manager
# Handles quota checking and enforcement for LLM requests

from typing import Dict, Any, Tuple
from decimal import Decimal
import logging
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.user import User
from app.models.department import Department
from ..quota_service import get_quota_service, QuotaService, QuotaCheckResult
from .exceptions import LLMDepartmentQuotaExceededError, LLMUserNotFoundError
from .models import ChatRequest, ChatResponse
from .provider_factory import get_provider_factory


class LLMQuotaManager:
    """
    Manages quota checking and enforcement for LLM requests.
    
    This class handles:
    - Pre-request quota validation
    - Post-request usage recording
    - User and department lookup
    - Quota status reporting
    """
    
    def __init__(self):
        """Initialize the quota manager."""
        self.logger = logging.getLogger(__name__)
        self.provider_factory = get_provider_factory()
    
    # =============================================================================
    # USER AND DEPARTMENT LOOKUP METHODS
    # =============================================================================
    
    async def get_user_with_department(self, user_id: int, db_session: Session) -> Tuple[User, Department]:
        """
        Get user and their department for quota checking.
        
        Args:
            user_id: ID of the user making the request
            db_session: Database session
            
        Returns:
            Tuple of (user, department)
            
        Raises:
            LLMUserNotFoundError: If user not found or has no department
        """
        # Get user from database
        user = db_session.query(User).filter(User.id == user_id).first()
        if not user:
            raise LLMUserNotFoundError(f"User {user_id} not found")
        
        # Get user's department
        if not user.department_id:
            raise LLMUserNotFoundError(f"User {user_id} has no department assigned")
        
        department = db_session.query(Department).filter(Department.id == user.department_id).first()
        if not department:
            raise LLMUserNotFoundError(f"Department {user.department_id} not found for user {user_id}")
        
        return user, department
    
    # =============================================================================
    # QUOTA CHECKING METHODS
    # =============================================================================
    
    async def check_quotas_before_request(
        self,
        user_id: int,
        config_id: int,
        request: ChatRequest,
        db_session: Session,
        config_data: Dict[str, Any]
    ) -> QuotaCheckResult:
        """
        Check if the user's department can make this LLM request.
        
        Args:
            user_id: User making the request
            config_id: LLM configuration being used
            request: The chat request to check
            db_session: Database session
            config_data: Configuration data (to avoid session issues)
            
        Returns:
            QuotaCheckResult indicating if request is allowed
            
        Raises:
            LLMDepartmentQuotaExceededError: If quota is exceeded
            LLMUserNotFoundError: If user/department not found
        """
        self.logger.info(f"Checking quotas for user {user_id}, config {config_id}")
        
        # Get user and department
        user, department = await self.get_user_with_department(user_id, db_session)
        
        # Get quota service
        quota_service = get_quota_service(db_session)
        
        # Create a temporary config object for estimation (avoiding detached instance)
        temp_config = self.provider_factory.create_config_from_data(config_data)
        provider = self.provider_factory.get_provider(temp_config)
        estimated_cost = provider.estimate_cost(request)
        
        # Estimate tokens (rough calculation)
        total_chars = sum(len(msg.content) for msg in request.messages)
        estimated_tokens = total_chars // 4  # Rough estimate: 1 token ≈ 4 chars
        
        # Add estimated output tokens
        model_params = config_data.get('model_parameters') or {}
        max_tokens = request.max_tokens or model_params.get("max_tokens", 1000)
        estimated_total_tokens = estimated_tokens + min(max_tokens, estimated_tokens)
        
        # Check quotas
        quota_result = await quota_service.check_department_quotas(
            department_id=department.id,
            llm_config_id=config_id,
            estimated_cost=Decimal(str(estimated_cost)) if estimated_cost else None,
            estimated_tokens=estimated_total_tokens,
            request_count=1
        )
        
        # If quota check failed, raise appropriate error
        if quota_result.is_blocked:
            self.logger.warning(f"Quota blocked request for user {user_id}: {quota_result.message}")
            raise LLMDepartmentQuotaExceededError(
                f"Department '{department.name}' quota exceeded: {quota_result.message}",
                department_id=department.id,
                quota_check_result=quota_result
            )
        
        self.logger.info(f"Quota check passed for user {user_id}")
        return quota_result
    
    # =============================================================================
    # QUOTA USAGE RECORDING METHODS
    # =============================================================================
    
    def record_quota_usage_improved(
        self,
        user_id: int,
        config_id: int,
        response: ChatResponse,
        db_session: Session
    ) -> Dict[str, Any]:
        """
        Record actual usage against department quotas (RELIABLE).
        
        This version fixes quota recording by using direct database operations
        without async complications.
        
        Args:
            user_id: User who made the request
            config_id: LLM configuration used
            response: The chat response with actual usage data
            db_session: Database session
            
        Returns:
            Dictionary with quota update results
        """
        self.logger.info(f"🎯 Recording quota usage for user {user_id} (IMPROVED)")
        
        try:
            # Get user and department with explicit error handling
            user = db_session.query(User).filter(User.id == user_id).first()
            if not user:
                self.logger.error(f"User {user_id} not found for quota recording")
                return {"success": False, "error": "User not found"}
            
            if not user.department_id:
                self.logger.error(f"User {user_id} has no department")
                return {"success": False, "error": "User has no department"}
            
            department = db_session.query(Department).filter(Department.id == user.department_id).first()
            if not department:
                self.logger.error(f"Department {user.department_id} not found")
                return {"success": False, "error": "Department not found"}
            
            # Get applicable quotas directly
            from ...models.quota import DepartmentQuota, QuotaStatus, QuotaType
            
            applicable_quotas = db_session.query(DepartmentQuota).filter(
                DepartmentQuota.department_id == department.id,
                or_(
                    DepartmentQuota.llm_config_id == config_id,
                    DepartmentQuota.llm_config_id.is_(None)
                ),
                DepartmentQuota.status == QuotaStatus.ACTIVE
            ).all()
            
            if not applicable_quotas:
                self.logger.info(f"No applicable quotas for department {department.name}")
                return {"success": True, "updated_quotas": []}
            
            # Extract usage data
            actual_cost = Decimal(str(response.cost)) if response.cost else None
            total_tokens = response.usage.get("total_tokens")
            
            updated_quotas = []
            
            # Update each applicable quota
            for quota in applicable_quotas:
                usage_amount = Decimal('0')
                
                if quota.quota_type == QuotaType.COST and actual_cost is not None:
                    usage_amount = actual_cost
                elif quota.quota_type == QuotaType.TOKENS and total_tokens is not None:
                    usage_amount = Decimal(str(total_tokens))
                elif quota.quota_type == QuotaType.REQUESTS:
                    usage_amount = Decimal('1')
                
                if usage_amount > 0:
                    old_usage = quota.current_usage
                    quota.current_usage += usage_amount
                    
                    # Update status if exceeded
                    if quota.current_usage >= quota.limit_value:
                        quota.status = QuotaStatus.EXCEEDED
                    
                    updated_quotas.append({
                        "quota_id": quota.id,
                        "quota_name": quota.name,
                        "usage_before": float(old_usage),
                        "usage_after": float(quota.current_usage),
                        "usage_added": float(usage_amount)
                    })
                    
                    self.logger.info(f"✅ Updated quota {quota.name}: {old_usage} → {quota.current_usage}")
            
            # Commit changes
            db_session.commit()
            
            self.logger.info(f"🎉 Successfully updated {len(updated_quotas)} quota(s)")
            
            return {
                "success": True,
                "updated_quotas": updated_quotas,
                "department_id": department.id
            }
            
        except Exception as e:
            db_session.rollback()
            self.logger.error(f"❌ Quota recording error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def record_quota_usage(
        self,
        user_id: int,
        config_id: int,
        response: ChatResponse,
        db_session: Session
    ) -> Dict[str, Any]:
        """
        Record actual usage against department quotas.
        
        Args:
            user_id: User who made the request
            config_id: LLM configuration used
            response: The chat response with actual usage data
            db_session: Database session
            
        Returns:
            Dictionary with quota update results
        """
        self.logger.info(f"Recording quota usage for user {user_id}")
        
        try:
            # Get user and department
            user, department = await self.get_user_with_department(user_id, db_session)
            
            # Get quota service
            quota_service = get_quota_service(db_session)
            
            # Extract actual usage from response
            actual_cost = Decimal(str(response.cost)) if response.cost else None
            total_tokens = response.usage.get("total_tokens")
            
            # Record usage
            usage_result = await quota_service.record_usage(
                department_id=department.id,
                llm_config_id=config_id,
                actual_cost=actual_cost,
                total_tokens=total_tokens,
                request_count=1
            )
            
            if usage_result["success"]:
                self.logger.info(f"Quota usage recorded for user {user_id}: cost=${actual_cost}, tokens={total_tokens}")
            else:
                self.logger.error(f"Failed to record quota usage: {usage_result.get('error')}")
            
            return usage_result
            
        except Exception as e:
            self.logger.error(f"Error recording quota usage: {str(e)}")
            # Don't fail the request if quota recording fails
            return {"success": False, "error": str(e)}
    
    # =============================================================================
    # QUOTA STATUS METHODS
    # =============================================================================
    
    async def get_user_quota_status(self, user_id: int, db_session: Session) -> Dict[str, Any]:
        """
        Get quota status for a user's department.
        
        Args:
            user_id: User to get quota status for
            db_session: Database session
            
        Returns:
            Dictionary with quota status information
        """
        try:
            # Get user and department
            user, department = await self.get_user_with_department(user_id, db_session)
            
            # Get quota service
            quota_service = get_quota_service(db_session)
            
            # Get comprehensive quota status
            status = await quota_service.get_department_quota_status(department.id)
            
            # Add user-specific information
            status["user_id"] = user_id
            status["user_email"] = user.email
            status["user_name"] = f"{user.first_name} {user.last_name}".strip()
            
            return status
            
        except LLMUserNotFoundError as e:
            return {
                "user_id": user_id,
                "error": str(e),
                "department_id": None,
                "overall_status": "error"
            }
    
    async def check_user_can_use_config(
        self, 
        user_id: int, 
        config_id: int, 
        db_session: Session,
        config_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Check if a user can use a specific LLM configuration based on quotas.
        
        Args:
            user_id: User to check
            config_id: LLM configuration to check
            db_session: Database session
            config_data: Configuration data
            
        Returns:
            Dictionary with availability information
        """
        try:
            # Create a minimal test request
            from .models import ChatMessage
            test_messages = [ChatMessage("user", "test")]
            test_request = ChatRequest(messages=test_messages, max_tokens=100)
            
            # Check quotas
            quota_result = await self.check_quotas_before_request(
                user_id, config_id, test_request, db_session, config_data
            )
            
            return {
                "user_id": user_id,
                "config_id": config_id,
                "can_use": quota_result.allowed,
                "message": quota_result.message,
                "quota_details": quota_result.quota_details
            }
            
        except LLMDepartmentQuotaExceededError as e:
            return {
                "user_id": user_id,
                "config_id": config_id,
                "can_use": False,
                "message": str(e),
                "quota_details": e.quota_check_result.quota_details if e.quota_check_result else {}
            }
        except Exception as e:
            return {
                "user_id": user_id,
                "config_id": config_id,
                "can_use": False,
                "message": f"Error checking availability: {str(e)}",
                "quota_details": {}
            }


# Global quota manager instance (singleton pattern)
_quota_manager = None

def get_quota_manager() -> LLMQuotaManager:
    """
    Get the global quota manager instance.
    
    Returns:
        Singleton quota manager instance
    """
    global _quota_manager
    if _quota_manager is None:
        _quota_manager = LLMQuotaManager()
    return _quota_manager


# Export quota manager classes and functions
__all__ = [
    'LLMQuotaManager',
    'get_quota_manager'
]
