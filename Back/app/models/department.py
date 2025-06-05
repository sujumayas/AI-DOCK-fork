# AI Dock Department Model
# This defines organizational departments for user grouping and quota management

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Dict, List, Optional
from decimal import Decimal

from ..core.database import Base

class Department(Base):
    """
    Department model representing organizational departments.
    
    Departments are used for:
    - Organizing users by business unit
    - Setting usage quotas per department  
    - Tracking and reporting usage by department
    - Managing costs and budgets
    
    Examples: Engineering, Sales, Marketing, HR, Finance
    
    Table: departments
    Purpose: Organize users and manage departmental AI usage quotas
    """
    
    # =============================================================================
    # TABLE CONFIGURATION
    # =============================================================================
    
    __tablename__ = "departments"
    
    # =============================================================================
    # COLUMNS (DATABASE FIELDS)
    # =============================================================================
    
    # Primary Key - unique identifier for each department
    id = Column(
        Integer, 
        primary_key=True, 
        index=True,
        comment="Unique department identifier"
    )
    
    # Department name (Engineering, Sales, etc.)
    name = Column(
        String(100),
        unique=True,                # Each department name must be unique
        index=True,
        nullable=False,
        comment="Department name (Engineering, Sales, Marketing, etc.)"
    )
    
    # Short code for the department (ENG, SALES, MKT)
    code = Column(
        String(10),
        unique=True,
        index=True,
        nullable=False,
        comment="Short department code for IDs and reporting"
    )
    
    # Detailed description of the department
    description = Column(
        Text,
        nullable=True,
        comment="Detailed description of department responsibilities"
    )
    
    # Is this department currently active?
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether this department is currently active"
    )
    
    # =============================================================================
    # HIERARCHY SUPPORT (PARENT-CHILD RELATIONSHIPS)
    # =============================================================================
    
    # Parent department (for organizational hierarchy)
    # This is a "self-referencing foreign key" - departments can have parent departments
    parent_id = Column(
        Integer,
        ForeignKey('departments.id'),   # References the id of another department
        nullable=True,
        comment="Parent department ID for hierarchy support"
    )
    
    # =============================================================================
    # BUDGET AND QUOTA INFORMATION
    # =============================================================================
    
    # Monthly AI usage budget (in USD)
    monthly_budget = Column(
        Numeric(10, 2),             # Up to $99,999,999.99
        default=Decimal('1000.00'), # $1000 default budget
        nullable=False,
        comment="Monthly AI usage budget in USD"
    )
    
    # Cost center or billing code
    cost_center = Column(
        String(50),
        nullable=True,
        comment="Cost center or billing code for accounting"
    )
    
    # Department settings as JSON (flexible configuration)
    settings = Column(
        JSON,
        default=dict,
        nullable=False,
        comment="JSON object containing department-specific settings"
    )
    
    # =============================================================================
    # CONTACT INFORMATION
    # =============================================================================
    
    # Department manager/head contact
    manager_email = Column(
        String(255),
        nullable=True,
        comment="Email of department manager or head"
    )
    
    # Physical location or office
    location = Column(
        String(200),
        nullable=True,
        comment="Physical location or office of the department"
    )
    
    # =============================================================================
    # METADATA AND TRACKING
    # =============================================================================
    
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="When the department was created"
    )
    
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="When the department was last updated"
    )
    
    # Who created this department
    created_by = Column(
        String(100),
        nullable=True,
        comment="Username of who created this department"
    )
    
    # =============================================================================
    # RELATIONSHIPS (HOW TABLES CONNECT TO EACH OTHER)
    # =============================================================================
    
    # Parent-Child relationship for department hierarchy
    # One department can have many child departments
    children = relationship(
        "Department",
        backref="parent",           # This creates a "parent" attribute automatically
        remote_side=[id],           # Tells SQLAlchemy this is a self-reference
        cascade="all"               # Removed "delete-orphan" - only use on "one" side
    )
    
    # One department can have many users
    # We'll add this after we update the User model with foreign keys
    # users = relationship("User", back_populates="department")
    
    # One department can have many usage logs
    # usage_logs = relationship("UsageLog", back_populates="department")
    
    # One department can have many quota configurations
    # quotas = relationship("DepartmentQuota", back_populates="department")
    
    # =============================================================================
    # MODEL METHODS
    # =============================================================================
    
    def __repr__(self) -> str:
        """String representation for debugging."""
        return f"<Department(id={self.id}, name='{self.name}', code='{self.code}')>"
    
    def __str__(self) -> str:
        """Human-friendly string representation."""
        return f"{self.name} ({self.code})"
    
    # =============================================================================
    # HIERARCHY METHODS
    # =============================================================================
    
    def get_full_path(self) -> str:
        """
        Get the full hierarchical path of this department.
        
        Returns:
            String like "Company > Engineering > Backend Team"
        """
        path_parts = [self.name]
        current = self.parent
        
        while current:
            path_parts.insert(0, current.name)
            current = current.parent
            
        return " > ".join(path_parts)
    
    def get_all_children(self) -> List['Department']:
        """
        Get all child departments recursively.
        
        Returns:
            List of all descendant departments
        """
        all_children = []
        
        for child in self.children:
            all_children.append(child)
            all_children.extend(child.get_all_children())
            
        return all_children
    
    def get_root_department(self) -> 'Department':
        """
        Get the root (top-level) department in this hierarchy.
        
        Returns:
            The root department
        """
        current = self
        while current.parent:
            current = current.parent
        return current
    
    def is_ancestor_of(self, other_department: 'Department') -> bool:
        """
        Check if this department is an ancestor of another department.
        
        Args:
            other_department: Department to check
            
        Returns:
            True if this department is an ancestor
        """
        current = other_department.parent
        while current:
            if current.id == self.id:
                return True
            current = current.parent
        return False
    
    def is_descendant_of(self, other_department: 'Department') -> bool:
        """
        Check if this department is a descendant of another department.
        
        Args:
            other_department: Department to check
            
        Returns:
            True if this department is a descendant
        """
        return other_department.is_ancestor_of(self)
    
    # =============================================================================
    # BUDGET AND QUOTA METHODS
    # =============================================================================
    
    def get_budget_status(self) -> Dict[str, any]:
        """
        Get current budget status for this department.
        This would typically query usage logs to calculate spent amount.
        
        Returns:
            Dictionary with budget information
        """
        # In a real implementation, this would query the database
        # for actual usage and calculate remaining budget
        return {
            "monthly_budget": float(self.monthly_budget),
            "spent_this_month": 0.0,  # Would be calculated from usage logs
            "remaining_budget": float(self.monthly_budget),
            "budget_utilization_percent": 0.0
        }
    
    def can_afford_usage(self, estimated_cost: Decimal) -> bool:
        """
        Check if department can afford a usage request.
        
        Args:
            estimated_cost: Estimated cost of the operation
            
        Returns:
            True if department can afford the usage
        """
        budget_status = self.get_budget_status()
        return budget_status["remaining_budget"] >= float(estimated_cost)
    
    def update_budget(self, new_budget: Decimal) -> None:
        """
        Update the monthly budget for this department.
        
        Args:
            new_budget: New monthly budget amount
        """
        self.monthly_budget = new_budget
    
    # =============================================================================
    # USER MANAGEMENT METHODS
    # =============================================================================
    
    def get_user_count(self) -> int:
        """
        Get the number of users in this department.
        This would be implemented once we add the User relationship.
        
        Returns:
            Number of users in this department
        """
        # Will implement once we add the users relationship
        # return len(self.users)
        return 0
    
    def get_active_user_count(self) -> int:
        """
        Get the number of active users in this department.
        
        Returns:
            Number of active users
        """
        # Will implement once we add the users relationship
        # return len([u for u in self.users if u.is_active])
        return 0
    
    # =============================================================================
    # UTILITY METHODS
    # =============================================================================
    
    @classmethod
    def get_by_code(cls, session, code: str) -> Optional['Department']:
        """
        Find a department by its code.
        
        Args:
            session: Database session
            code: Department code to search for
            
        Returns:
            Department if found, None otherwise
        """
        return session.query(cls).filter(cls.code == code.upper()).first()
    
    @classmethod
    def get_top_level_departments(cls, session) -> List['Department']:
        """
        Get all top-level departments (no parent).
        
        Args:
            session: Database session
            
        Returns:
            List of top-level departments
        """
        return session.query(cls).filter(cls.parent_id.is_(None)).all()
    
    def activate(self) -> None:
        """Activate this department."""
        self.is_active = True
    
    def deactivate(self) -> None:
        """Deactivate this department."""
        self.is_active = False

# =============================================================================
# HELPER FUNCTIONS FOR CREATING DEFAULT DEPARTMENTS
# =============================================================================

def create_default_departments() -> List[Department]:
    """
    Create default departments for a new AI Dock installation.
    
    This creates a typical company department structure.
    """
    departments = []
    
    # =============================================================================
    # TOP-LEVEL DEPARTMENTS
    # =============================================================================
    
    # Engineering Department
    engineering = Department(
        name="Engineering",
        code="ENG",
        description="Software development, DevOps, and technical infrastructure",
        monthly_budget=Decimal('5000.00'),
        manager_email="eng-manager@company.com",
        location="Tech Building, Floor 3",
        created_by="system"
    )
    departments.append(engineering)
    
    # Sales Department
    sales = Department(
        name="Sales",
        code="SALES",
        description="Revenue generation, client acquisition, and account management",
        monthly_budget=Decimal('2000.00'),
        manager_email="sales-manager@company.com",
        location="Main Building, Floor 1",
        created_by="system"
    )
    departments.append(sales)
    
    # Marketing Department
    marketing = Department(
        name="Marketing",
        code="MKT",
        description="Brand management, content creation, and lead generation",
        monthly_budget=Decimal('1500.00'),
        manager_email="marketing-manager@company.com",
        location="Main Building, Floor 2",
        created_by="system"
    )
    departments.append(marketing)
    
    # Human Resources
    hr = Department(
        name="Human Resources",
        code="HR",
        description="Employee relations, recruitment, and organizational development",
        monthly_budget=Decimal('500.00'),
        manager_email="hr-manager@company.com",
        location="Main Building, Floor 4",
        created_by="system"
    )
    departments.append(hr)
    
    # Finance Department
    finance = Department(
        name="Finance",
        code="FIN",
        description="Financial planning, accounting, and budget management",
        monthly_budget=Decimal('800.00'),
        manager_email="finance-manager@company.com",
        location="Main Building, Floor 5",
        created_by="system"
    )
    departments.append(finance)
    
    return departments

def create_engineering_sub_departments(engineering_dept: Department) -> List[Department]:
    """
    Create sub-departments under Engineering.
    
    Args:
        engineering_dept: Parent engineering department
        
    Returns:
        List of engineering sub-departments
    """
    sub_departments = []
    
    # Backend Team
    backend = Department(
        name="Backend Development",
        code="BACKEND",
        description="API development, database design, and server infrastructure",
        parent_id=engineering_dept.id,
        monthly_budget=Decimal('2000.00'),
        manager_email="backend-lead@company.com",
        created_by="system"
    )
    sub_departments.append(backend)
    
    # Frontend Team
    frontend = Department(
        name="Frontend Development",
        code="FRONTEND",
        description="User interface development and user experience design",
        parent_id=engineering_dept.id,
        monthly_budget=Decimal('1500.00'),
        manager_email="frontend-lead@company.com",
        created_by="system"
    )
    sub_departments.append(frontend)
    
    # DevOps Team
    devops = Department(
        name="DevOps & Infrastructure",
        code="DEVOPS",
        description="CI/CD, deployment automation, and infrastructure management",
        parent_id=engineering_dept.id,
        monthly_budget=Decimal('1000.00'),
        manager_email="devops-lead@company.com",
        created_by="system"
    )
    sub_departments.append(devops)
    
    # QA Team
    qa = Department(
        name="Quality Assurance",
        code="QA",
        description="Testing, quality control, and release validation",
        parent_id=engineering_dept.id,
        monthly_budget=Decimal('500.00'),
        manager_email="qa-lead@company.com",
        created_by="system"
    )
    sub_departments.append(qa)
    
    return sub_departments

def get_default_department() -> str:
    """Get the default department code for new users."""
    return "ENG"  # Engineering as default
