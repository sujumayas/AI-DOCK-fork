# 🏢 Department Management API
# Admin endpoints for managing departments

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from ...core.database import get_db
from ...core.security import get_current_admin_user
from ...models.department import Department
from ...models.user import User
from ...schemas.department import (
    DepartmentResponse, 
    DepartmentCreate, 
    DepartmentUpdate,
    DepartmentWithStats
)

router = APIRouter(prefix="/admin/departments", tags=["Admin - Departments"])

# =============================================================================
# DEPARTMENT CRUD OPERATIONS
# =============================================================================

@router.get("/", response_model=List[DepartmentResponse])
async def get_all_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get all departments
    
    This endpoint provides department data for frontend dropdowns and management.
    """
    try:
        departments = db.query(Department).order_by(Department.id).all()
        return departments
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch departments: {str(e)}"
        )

@router.get("/list", response_model=List[Dict[str, Any]])
async def get_departments_for_dropdown(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get departments formatted for frontend dropdowns
    
    Returns simplified format: [{"value": id, "label": name}, ...]
    """
    try:
        departments = db.query(Department).order_by(Department.name).all()
        
        return [
            {"value": dept.id, "label": dept.name}
            for dept in departments
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch department list: {str(e)}"
        )

@router.get("/with-stats", response_model=List[DepartmentWithStats])
async def get_departments_with_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get departments with user count statistics
    """
    try:
        departments = db.query(Department).all()
        result = []
        
        for dept in departments:
            user_count = db.query(User).filter(User.department_id == dept.id).count()
            
            dept_with_stats = DepartmentWithStats(
                id=dept.id,
                name=dept.name,
                code=dept.code,
                description=dept.description,
                monthly_budget=dept.monthly_budget,
                manager_email=dept.manager_email,
                location=dept.location,
                cost_center=dept.cost_center,
                parent_id=dept.parent_id,
                created_at=dept.created_at,
                updated_at=dept.updated_at,
                created_by=dept.created_by,
                user_count=user_count
            )
            result.append(dept_with_stats)
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch departments with stats: {str(e)}"
        )

@router.get("/{department_id}", response_model=DepartmentResponse)
async def get_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get specific department by ID"""
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
    return department

@router.post("/", response_model=DepartmentResponse)
async def create_department(
    department_data: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create new department"""
    try:
        # Check if department name or code already exists
        existing = db.query(Department).filter(
            (Department.name == department_data.name) | 
            (Department.code == department_data.code)
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Department with this name or code already exists"
            )
        
        # Create new department
        department = Department(
            name=department_data.name,
            code=department_data.code,
            description=department_data.description,
            monthly_budget=department_data.monthly_budget,
            created_by=current_user.username
        )
        
        db.add(department)
        db.commit()
        db.refresh(department)
        
        return department
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create department: {str(e)}"
        )

@router.put("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: int,
    department_data: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update existing department"""
    try:
        department = db.query(Department).filter(Department.id == department_id).first()
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found"
            )
        
        # Update fields
        for field, value in department_data.dict(exclude_unset=True).items():
            setattr(department, field, value)
        
        db.commit()
        db.refresh(department)
        
        return department
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update department: {str(e)}"
        )

@router.delete("/{department_id}")
async def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Delete department (only if no users assigned)"""
    try:
        department = db.query(Department).filter(Department.id == department_id).first()
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found"
            )
        
        # Check for assigned users
        user_count = db.query(User).filter(User.department_id == department_id).count()
        if user_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete department with {user_count} assigned users"
            )
        
        db.delete(department)
        db.commit()
        
        return {"message": "Department deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete department: {str(e)}"
        )

# =============================================================================
# DEPARTMENT INITIALIZATION UTILITIES
# =============================================================================

@router.post("/initialize-defaults")
async def initialize_default_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Initialize the 5 standard departments if they don't exist
    
    This creates: Engineering, Sales, Marketing, HR, Finance
    """
    try:
        # Define standard departments
        default_departments = [
            {"name": "Engineering", "code": "ENG", "budget": "5000.00", 
             "description": "Software development, DevOps, and technical infrastructure"},
            {"name": "Sales", "code": "SALES", "budget": "2000.00", 
             "description": "Revenue generation, client acquisition, and account management"},
            {"name": "Marketing", "code": "MKT", "budget": "1500.00", 
             "description": "Brand management, content creation, and lead generation"},
            {"name": "HR", "code": "HR", "budget": "500.00", 
             "description": "Employee relations, recruitment, and organizational development"},
            {"name": "Finance", "code": "FIN", "budget": "800.00", 
             "description": "Financial planning, accounting, and budget management"}
        ]
        
        created_count = 0
        skipped_count = 0
        
        for dept_data in default_departments:
            # Check if department already exists
            existing = db.query(Department).filter(
                (Department.name == dept_data["name"]) | 
                (Department.code == dept_data["code"])
            ).first()
            
            if existing:
                skipped_count += 1
                continue
            
            # Create department
            department = Department(
                name=dept_data["name"],
                code=dept_data["code"],
                description=dept_data["description"],
                monthly_budget=float(dept_data["budget"]),
                created_by=current_user.username
            )
            
            db.add(department)
            created_count += 1
        
        db.commit()
        
        return {
            "message": "Default departments initialization completed",
            "created": created_count,
            "skipped": skipped_count,
            "total_departments": db.query(Department).count()
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize default departments: {str(e)}"
        )

@router.get("/{department_id}/users", response_model=List[Dict[str, Any]])
async def get_department_users(
    department_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get users of a specific department
    
    Args:
        department_id: ID of the department to get users for
        
    Returns:
        List of users in the department with their basic information
        
    Raises:
        404: Department not found
        500: Database error
    """
    try:
        # Verify department exists
        department = db.query(Department).filter(Department.id == department_id).first()
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Department with ID {department_id} not found"
            )
        
        # Get users with their roles
        users = db.query(
            User.id,
            User.username,
            User.email,
            User.full_name,
            User.is_active,
            User.role_id,
            User.job_title,
            User.last_login_at
        ).filter(User.department_id == department_id).all()
        
        return [{
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "role_id": user.role_id,
            "job_title": user.job_title,
            "last_login_at": user.last_login_at
        } for user in users]
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch department users: {str(e)}"
        )
