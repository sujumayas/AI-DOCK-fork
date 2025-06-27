"""
File Health Service for AI Dock

Atomic service responsible for system health monitoring:
- Upload directory accessibility
- Database connectivity
- Storage capacity monitoring
- Service availability checks
- Performance health metrics

🎓 LEARNING: Health Check Patterns
=================================
This service implements comprehensive health monitoring:
- Infrastructure checks (disk, database)
- Service availability validation
- Performance threshold monitoring
- Error rate tracking
- Follows integration guide's monitoring patterns
"""

import os
import shutil
from typing import Dict, Any, List
from pathlib import Path
from datetime import datetime

# FastAPI imports
from sqlalchemy.orm import Session

# Internal imports
from ...models.file_upload import FileUpload
from ...schemas.file_upload import FileUploadStatus
from ...core.config import settings


class FileHealthService:
    """
    Atomic service for file system health monitoring.
    
    Following integration guide patterns:
    - Single responsibility (health monitoring only)
    - Non-intrusive checks
    - Comprehensive reporting
    - Performance-conscious operations
    - Clear health status indicators
    """
    
    def __init__(self):
        """Initialize health service with monitoring configuration."""
        # Upload directory configuration
        self.upload_dir = Path(settings.upload_directory if hasattr(settings, 'upload_directory') else "uploads")
        
        # Health thresholds
        self.min_free_space_gb = 1.0  # Minimum 1GB free space
        self.max_error_rate_percent = 5.0  # Maximum 5% error rate
        self.max_response_time_ms = 1000  # Maximum 1 second response time
    
    # =============================================================================
    # MAIN HEALTH CHECK ENTRY POINT
    # =============================================================================
    
    def perform_comprehensive_health_check(self, db: Session) -> Dict[str, Any]:
        """
        Perform comprehensive health check of file system components.
        
        🎓 LEARNING: Comprehensive Health Monitoring
        ==========================================
        Health checks should cover:
        1. Infrastructure (disk space, directories)
        2. Database (connectivity, performance)
        3. Service availability (upload/download)
        4. Error rates and performance metrics
        5. Overall system status
        
        Args:
            db: Database session
            
        Returns:
            Dictionary with comprehensive health status
        """
        health_status = {
            "overall_status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "checks": {},
            "errors": [],
            "warnings": []
        }
        
        try:
            # Infrastructure checks
            health_status["checks"]["infrastructure"] = self._check_infrastructure()
            
            # Database checks
            health_status["checks"]["database"] = self._check_database_health(db)
            
            # Service availability checks
            health_status["checks"]["services"] = self._check_service_availability(db)
            
            # Performance checks
            health_status["checks"]["performance"] = self._check_performance_metrics(db)
            
            # Aggregate overall status
            health_status["overall_status"] = self._determine_overall_status(health_status)
            
        except Exception as e:
            health_status["overall_status"] = "error"
            health_status["errors"].append(f"Health check failed: {str(e)}")
        
        return health_status
    
    # =============================================================================
    # INFRASTRUCTURE HEALTH CHECKS
    # =============================================================================
    
    def _check_infrastructure(self) -> Dict[str, Any]:
        """
        Check infrastructure health (directories, disk space, permissions).
        
        Returns:
            Dictionary with infrastructure health status
        """
        infrastructure_health = {
            "status": "healthy",
            "upload_directory_exists": False,
            "upload_directory_writable": False,
            "disk_space_available": False,
            "free_space_gb": 0.0,
            "errors": []
        }
        
        try:
            # Check upload directory existence
            infrastructure_health["upload_directory_exists"] = self.upload_dir.exists()
            
            if infrastructure_health["upload_directory_exists"]:
                # Check write permissions
                try:
                    test_file = self.upload_dir / ".health_check_write_test"
                    test_file.write_text("health check")
                    test_file.unlink()
                    infrastructure_health["upload_directory_writable"] = True
                except Exception as e:
                    infrastructure_health["errors"].append(f"Upload directory not writable: {e}")
                
                # Check disk space
                try:
                    _, _, free_bytes = shutil.disk_usage(self.upload_dir)
                    free_gb = free_bytes / (1024**3)
                    infrastructure_health["free_space_gb"] = free_gb
                    infrastructure_health["disk_space_available"] = free_gb >= self.min_free_space_gb
                    
                    if free_gb < self.min_free_space_gb:
                        infrastructure_health["errors"].append(f"Low disk space: {free_gb:.1f}GB available")
                        
                except Exception as e:
                    infrastructure_health["errors"].append(f"Cannot check disk space: {e}")
            else:
                infrastructure_health["errors"].append("Upload directory does not exist")
            
            # Determine infrastructure status
            if infrastructure_health["errors"]:
                infrastructure_health["status"] = "unhealthy"
            
        except Exception as e:
            infrastructure_health["status"] = "error"
            infrastructure_health["errors"].append(f"Infrastructure check failed: {e}")
        
        return infrastructure_health
    
    # =============================================================================
    # DATABASE HEALTH CHECKS
    # =============================================================================
    
    def _check_database_health(self, db: Session) -> Dict[str, Any]:
        """
        Check database connectivity and performance.
        
        Args:
            db: Database session
            
        Returns:
            Dictionary with database health status
        """
        database_health = {
            "status": "healthy",
            "connection_active": False,
            "query_performance_ms": 0,
            "file_count": 0,
            "errors": []
        }
        
        try:
            # Test basic connectivity and performance
            start_time = datetime.utcnow()
            
            # Simple query to test database
            file_count = db.query(FileUpload).count()
            
            end_time = datetime.utcnow()
            query_time_ms = (end_time - start_time).total_seconds() * 1000
            
            database_health["connection_active"] = True
            database_health["query_performance_ms"] = query_time_ms
            database_health["file_count"] = file_count
            
            # Check performance thresholds
            if query_time_ms > self.max_response_time_ms:
                database_health["errors"].append(f"Slow database response: {query_time_ms:.1f}ms")
                database_health["status"] = "degraded"
            
        except Exception as e:
            database_health["status"] = "error"
            database_health["errors"].append(f"Database connectivity failed: {e}")
        
        return database_health
    
    # =============================================================================
    # SERVICE AVAILABILITY CHECKS
    # =============================================================================
    
    def _check_service_availability(self, db: Session) -> Dict[str, Any]:
        """
        Check availability of key file service operations.
        
        Args:
            db: Database session
            
        Returns:
            Dictionary with service availability status
        """
        service_health = {
            "status": "healthy",
            "upload_service_available": False,
            "text_extraction_available": False,
            "download_service_available": False,
            "errors": []
        }
        
        try:
            # Check upload service (basic validation)
            try:
                # Test if we can create FileUpload objects
                from ...services.file_services.validation_service import FileValidationService
                validation_service = FileValidationService()
                allowed_types = validation_service.get_allowed_types()
                service_health["upload_service_available"] = len(allowed_types) > 0
            except Exception as e:
                service_health["errors"].append(f"Upload service unavailable: {e}")
            
            # Check text extraction availability
            try:
                from ...services.file_services.extraction_service import TextExtractionService
                extraction_service = TextExtractionService()
                supported_types = extraction_service.get_supported_types()
                service_health["text_extraction_available"] = len(supported_types) > 0
            except Exception as e:
                service_health["errors"].append(f"Text extraction service unavailable: {e}")
            
            # Check download service (test database access)
            try:
                # Test if we can access file records
                recent_files = db.query(FileUpload).limit(1).all()
                service_health["download_service_available"] = True
            except Exception as e:
                service_health["errors"].append(f"Download service unavailable: {e}")
            
            # Determine overall service status
            if service_health["errors"]:
                service_health["status"] = "degraded"
            
        except Exception as e:
            service_health["status"] = "error"
            service_health["errors"].append(f"Service availability check failed: {e}")
        
        return service_health
    
    # =============================================================================
    # PERFORMANCE HEALTH CHECKS
    # =============================================================================
    
    def _check_performance_metrics(self, db: Session) -> Dict[str, Any]:
        """
        Check system performance metrics and error rates.
        
        Args:
            db: Database session
            
        Returns:
            Dictionary with performance health status
        """
        performance_health = {
            "status": "healthy",
            "upload_success_rate_percent": 0.0,
            "error_rate_percent": 0.0,
            "recent_upload_count": 0,
            "errors": []
        }
        
        try:
            # Get recent upload statistics (last 24 hours)
            from datetime import timedelta
            yesterday = datetime.utcnow() - timedelta(days=1)
            
            recent_uploads = db.query(FileUpload).filter(FileUpload.upload_date >= yesterday).all()
            
            if recent_uploads:
                successful_uploads = len([f for f in recent_uploads if f.upload_status == FileUploadStatus.COMPLETED])
                failed_uploads = len([f for f in recent_uploads if f.upload_status == FileUploadStatus.FAILED])
                total_uploads = len(recent_uploads)
                
                success_rate = (successful_uploads / total_uploads * 100) if total_uploads > 0 else 100
                error_rate = (failed_uploads / total_uploads * 100) if total_uploads > 0 else 0
                
                performance_health["upload_success_rate_percent"] = success_rate
                performance_health["error_rate_percent"] = error_rate
                performance_health["recent_upload_count"] = total_uploads
                
                # Check performance thresholds
                if error_rate > self.max_error_rate_percent:
                    performance_health["errors"].append(f"High error rate: {error_rate:.1f}%")
                    performance_health["status"] = "degraded"
            
        except Exception as e:
            performance_health["status"] = "error"
            performance_health["errors"].append(f"Performance metrics check failed: {e}")
        
        return performance_health
    
    # =============================================================================
    # OVERALL STATUS DETERMINATION
    # =============================================================================
    
    def _determine_overall_status(self, health_status: Dict[str, Any]) -> str:
        """
        Determine overall system health status based on individual checks.
        
        Args:
            health_status: Health status dictionary with all checks
            
        Returns:
            Overall status string: "healthy", "degraded", "unhealthy", "error"
        """
        try:
            checks = health_status.get("checks", {})
            
            # Count status types
            error_count = 0
            degraded_count = 0
            healthy_count = 0
            
            for check_name, check_result in checks.items():
                status = check_result.get("status", "error")
                if status == "error" or status == "unhealthy":
                    error_count += 1
                elif status == "degraded":
                    degraded_count += 1
                elif status == "healthy":
                    healthy_count += 1
            
            # Determine overall status
            if error_count > 0:
                return "unhealthy"
            elif degraded_count > 0:
                return "degraded"
            elif healthy_count > 0:
                return "healthy"
            else:
                return "unknown"
                
        except Exception:
            return "error"
    
    # =============================================================================
    # QUICK HEALTH CHECKS
    # =============================================================================
    
    def get_basic_health_status(self, db: Session) -> Dict[str, Any]:
        """
        Get basic health status for lightweight monitoring.
        
        Args:
            db: Database session
            
        Returns:
            Dictionary with basic health indicators
        """
        try:
            # Quick database connectivity test
            file_count = db.query(FileUpload).count()
            
            # Quick infrastructure test
            upload_dir_exists = self.upload_dir.exists()
            
            # Basic status determination
            if file_count >= 0 and upload_dir_exists:
                status = "healthy"
            else:
                status = "degraded"
            
            return {
                "status": status,
                "timestamp": datetime.utcnow().isoformat(),
                "database_responsive": True,
                "upload_directory_accessible": upload_dir_exists,
                "total_files": file_count
            }
            
        except Exception as e:
            return {
                "status": "error",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e),
                "database_responsive": False,
                "upload_directory_accessible": False,
                "total_files": 0
            }
    
    # =============================================================================
    # CONFIGURATION AND THRESHOLDS
    # =============================================================================
    
    def get_health_configuration(self) -> Dict[str, Any]:
        """Get current health monitoring configuration and thresholds."""
        return {
            "thresholds": {
                "min_free_space_gb": self.min_free_space_gb,
                "max_error_rate_percent": self.max_error_rate_percent,
                "max_response_time_ms": self.max_response_time_ms
            },
            "monitoring_intervals": {
                "comprehensive_check_recommended_minutes": 5,
                "basic_check_recommended_seconds": 30,
                "performance_evaluation_hours": 24
            },
            "upload_directory": str(self.upload_dir)
        }
