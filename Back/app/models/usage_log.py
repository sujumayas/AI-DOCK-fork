# AI Dock Usage Logging Model
# This model tracks every LLM interaction for monitoring, billing, and compliance

from sqlalchemy import Column, Integer, String, Text, Float, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from typing import Dict, Any, Optional
import json

from ..core.database import Base

class UsageLog(Base):
    """
    Usage Log Model - The "Black Box" for AI Dock
    
    This table records every single interaction with LLM providers.
    Think of it as the detailed diary of our AI gateway that helps with:
    - Cost tracking and billing
    - Performance monitoring  
    - Compliance and auditing
    - Quota enforcement
    - Usage analytics
    
    Each row represents one complete chat request/response cycle.
    """
    
    __tablename__ = "usage_logs"
    
    # =============================================================================
    # PRIMARY IDENTIFICATION
    # =============================================================================
    
    id = Column(Integer, primary_key=True, index=True)
    """Unique identifier for this usage log entry"""
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    """When this interaction occurred - critical for time-based analytics"""
    
    # =============================================================================
    # USER AND CONTEXT INFORMATION
    # =============================================================================
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    """Who made this request - essential for per-user tracking"""
    
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True, index=True)
    """Which department - key for department quota management"""
    
    user_email = Column(String(255), nullable=False, index=True)
    """Store email for easy lookup (denormalized for performance)"""
    
    user_role = Column(String(50), nullable=False)
    """User's role at time of request (admin, user, etc.)"""
    
    # =============================================================================
    # LLM CONFIGURATION AND PROVIDER INFO
    # =============================================================================
    
    llm_config_id = Column(Integer, ForeignKey("llm_configurations.id"), nullable=False, index=True)
    """Which LLM configuration was used"""
    
    llm_config_name = Column(String(255), nullable=False)
    """Configuration name (denormalized for reporting)"""
    
    provider = Column(String(50), nullable=False, index=True)
    """LLM provider: 'openai', 'anthropic', etc."""
    
    model = Column(String(100), nullable=False, index=True)
    """Specific model used: 'gpt-4', 'claude-3-opus', etc."""
    
    # =============================================================================
    # REQUEST DETAILS
    # =============================================================================
    
    request_messages_count = Column(Integer, nullable=False, default=0)
    """Number of messages in the conversation (context length indicator)"""
    
    request_total_chars = Column(Integer, nullable=False, default=0)
    """Total characters in request (rough size indicator)"""
    
    request_parameters = Column(JSON, nullable=True)
    """
    Store request parameters as JSON:
    {
        "temperature": 0.7,
        "max_tokens": 1000,
        "model_override": "gpt-4-turbo"
    }
    Helps understand how users configure their requests
    """
    
    # =============================================================================
    # TOKEN USAGE (MOST IMPORTANT FOR BILLING)
    # =============================================================================
    
    input_tokens = Column(Integer, nullable=False, default=0)
    """Tokens consumed by the input (what user sent)"""
    
    output_tokens = Column(Integer, nullable=False, default=0)
    """Tokens generated in response (what AI returned)"""
    
    total_tokens = Column(Integer, nullable=False, default=0)
    """Total tokens used (input + output)"""
    
    # =============================================================================
    # COST TRACKING
    # =============================================================================
    
    estimated_cost = Column(Float, nullable=True)
    """Estimated cost in USD for this request"""
    
    actual_cost = Column(Float, nullable=True)
    """Actual cost if available from provider billing"""
    
    cost_currency = Column(String(3), nullable=False, default="USD")
    """Currency for cost (usually USD)"""
    
    # =============================================================================
    # PERFORMANCE METRICS
    # =============================================================================
    
    response_time_ms = Column(Integer, nullable=True)
    """How long the request took in milliseconds"""
    
    request_started_at = Column(DateTime, nullable=True)
    """When request was initiated"""
    
    request_completed_at = Column(DateTime, nullable=True)
    """When response was received"""
    
    # =============================================================================
    # SUCCESS/FAILURE TRACKING
    # =============================================================================
    
    success = Column(Boolean, nullable=False, default=True)
    """Whether the request completed successfully"""
    
    error_type = Column(String(100), nullable=True)
    """Type of error if failed: 'quota_exceeded', 'api_error', etc."""
    
    error_message = Column(Text, nullable=True)
    """Detailed error message for debugging"""
    
    http_status_code = Column(Integer, nullable=True)
    """HTTP status code from provider API"""
    
    # =============================================================================
    # RESPONSE DETAILS
    # =============================================================================
    
    response_content_length = Column(Integer, nullable=False, default=0)
    """Length of AI response in characters"""
    
    response_preview = Column(String(500), nullable=True)
    """
    First 500 chars of response for debugging/preview
    Note: Be careful with sensitive data - consider truncating or hashing
    """
    
    # =============================================================================
    # METADATA AND CONTEXT
    # =============================================================================
    
    session_id = Column(String(100), nullable=True, index=True)
    """Session identifier to group related requests"""
    
    request_id = Column(String(100), nullable=True, index=True)
    """Unique request ID for tracing"""
    
    ip_address = Column(String(45), nullable=True)
    """Client IP address (IPv4 or IPv6)"""
    
    user_agent = Column(String(500), nullable=True)
    """Browser/client user agent"""
    
    raw_response_metadata = Column(JSON, nullable=True)
    """
    Store additional provider-specific data:
    {
        "openai_request_id": "req_123",
        "rate_limit_remaining": 100,
        "model_version": "gpt-4-0314"
    }
    """
    
    # =============================================================================
    # RELATIONSHIPS
    # =============================================================================
    
    # Define relationships to related tables
    user = relationship("User", back_populates="usage_logs")
    department = relationship("Department", back_populates="usage_logs")
    llm_config = relationship("LLMConfiguration", back_populates="usage_logs")
    
    # =============================================================================
    # BUSINESS LOGIC METHODS
    # =============================================================================
    
    def __repr__(self) -> str:
        """String representation for debugging"""
        return f"<UsageLog(id={self.id}, user={self.user_email}, provider={self.provider}, model={self.model}, tokens={self.total_tokens}, cost=${self.estimated_cost or 0:.4f})>"
    
    @property
    def duration_seconds(self) -> Optional[float]:
        """Calculate request duration in seconds"""
        if self.request_started_at and self.request_completed_at:
            delta = self.request_completed_at - self.request_started_at
            return delta.total_seconds()
        return None
    
    @property
    def cost_per_token(self) -> Optional[float]:
        """Calculate cost per token (useful for comparing efficiency)"""
        if self.estimated_cost and self.total_tokens > 0:
            return self.estimated_cost / self.total_tokens
        return None
    
    @property
    def tokens_per_second(self) -> Optional[float]:
        """Calculate processing speed in tokens per second"""
        duration = self.duration_seconds
        if duration and duration > 0 and self.total_tokens > 0:
            return self.total_tokens / duration
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert usage log to dictionary for API responses
        
        Returns:
            Dictionary representation of the usage log
        """
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "user_email": self.user_email,
            "user_role": self.user_role,
            "department_id": self.department_id,
            "llm_config_name": self.llm_config_name,
            "provider": self.provider,
            "model": self.model,
            "request_messages_count": self.request_messages_count,
            "token_usage": {
                "input_tokens": self.input_tokens,
                "output_tokens": self.output_tokens,
                "total_tokens": self.total_tokens
            },
            "cost": {
                "estimated": self.estimated_cost,
                "actual": self.actual_cost,
                "currency": self.cost_currency,
                "cost_per_token": self.cost_per_token
            },
            "performance": {
                "response_time_ms": self.response_time_ms,
                "duration_seconds": self.duration_seconds,
                "tokens_per_second": self.tokens_per_second
            },
            "success": self.success,
            "error_type": self.error_type,
            "response_content_length": self.response_content_length,
            "session_id": self.session_id,
            "request_id": self.request_id
        }
    
    def to_summary_dict(self) -> Dict[str, Any]:
        """
        Convert to summary format for dashboard displays
        
        Returns:
            Condensed dictionary with key metrics
        """
        return {
            "id": self.id,
            "timestamp": self.created_at.isoformat() if self.created_at else None,
            "user": self.user_email,
            "provider": self.provider,
            "model": self.model,
            "tokens": self.total_tokens,
            "cost": self.estimated_cost,
            "success": self.success,
            "response_time_ms": self.response_time_ms
        }
    
    # =============================================================================
    # CLASS METHODS FOR ANALYTICS
    # =============================================================================
    
    @classmethod
    def get_cost_for_period(cls, session, start_date: datetime, end_date: datetime) -> float:
        """
        Calculate total cost for a time period
        
        Args:
            session: Database session
            start_date: Start of period
            end_date: End of period
            
        Returns:
            Total estimated cost
        """
        from sqlalchemy import func
        
        result = session.query(func.sum(cls.estimated_cost)).filter(
            cls.created_at >= start_date,
            cls.created_at <= end_date,
            cls.success == True,
            cls.estimated_cost.isnot(None)
        ).scalar()
        
        return float(result or 0)
    
    @classmethod  
    def get_token_usage_for_period(cls, session, start_date: datetime, end_date: datetime) -> Dict[str, int]:
        """
        Calculate total token usage for a time period
        
        Args:
            session: Database session
            start_date: Start of period
            end_date: End of period
            
        Returns:
            Dictionary with token usage breakdown
        """
        from sqlalchemy import func
        
        result = session.query(
            func.sum(cls.input_tokens).label('total_input'),
            func.sum(cls.output_tokens).label('total_output'),
            func.sum(cls.total_tokens).label('total_tokens')
        ).filter(
            cls.created_at >= start_date,
            cls.created_at <= end_date,
            cls.success == True
        ).first()
        
        return {
            "input_tokens": int(result.total_input or 0),
            "output_tokens": int(result.total_output or 0),
            "total_tokens": int(result.total_tokens or 0)
        }

# =============================================================================
# UPDATE RELATED MODELS
# =============================================================================

# Note: We need to add back_populates to the related models
# This creates the bidirectional relationships
