"""
File Analytics Service for AI Dock

Atomic service responsible for file statistics and usage analytics:
- File usage statistics
- Storage analytics
- User behavior tracking
- Performance metrics
- System insights

🎓 LEARNING: Analytics Service Pattern
=====================================
This service provides comprehensive analytics without affecting core operations:
- Read-only operations (no side effects)
- Aggregated data views
- Performance-optimized queries
- Caching-friendly data structures
- Follows integration guide's analytics patterns
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from collections import defaultdict

# FastAPI imports
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

# Internal imports
from ...models.file_upload import FileUpload
from ...models.user import User
from ...schemas.file_upload import FileUploadStatus


class FileAnalyticsService:
    """
    Atomic service for file analytics and statistics.
    
    Following integration guide patterns:
    - Single responsibility (analytics only)
    - Read-only operations
    - Optimized database queries
    - Comprehensive reporting
    - Performance-conscious design
    """
    
    def __init__(self):
        """Initialize analytics service."""
        pass
    
    # =============================================================================
    # MAIN STATISTICS METHODS
    # =============================================================================
    
    def get_comprehensive_statistics(self, db: Session, user: Optional[User] = None) -> Dict[str, Any]:
        """
        Get comprehensive file statistics for user or system-wide.
        
        🎓 LEARNING: Comprehensive Analytics
        ===================================
        Analytics should provide multiple views:
        - Basic counts and totals
        - Type distribution
        - Usage patterns over time
        - Performance metrics
        - Trends and insights
        
        Args:
            db: Database session
            user: If provided, get stats for specific user only
            
        Returns:
            Dictionary with comprehensive statistics
        """
        try:
            stats = {}
            
            # Basic statistics
            stats.update(self._get_basic_statistics(db, user))
            
            # File type distribution
            stats["files_by_type"] = self._get_files_by_type(db, user)
            
            # Status distribution
            stats["files_by_status"] = self._get_files_by_status(db, user)
            
            # Size analytics
            stats.update(self._get_size_analytics(db, user))
            
            # Time-based analytics
            stats.update(self._get_time_based_analytics(db, user))
            
            # Usage analytics
            stats.update(self._get_usage_analytics(db, user))
            
            # Performance metrics
            stats.update(self._get_performance_metrics(db, user))
            
            return stats
            
        except Exception as e:
            return {
                "error": f"Failed to get statistics: {str(e)}",
                "total_files": 0,
                "total_size_bytes": 0
            }
    
    # =============================================================================
    # BASIC STATISTICS
    # =============================================================================
    
    def _get_basic_statistics(self, db: Session, user: Optional[User] = None) -> Dict[str, Any]:
        """Get basic file counts and totals."""
        # Base query
        query = db.query(FileUpload)
        
        # Filter by user if specified
        if user:
            query = query.filter(FileUpload.user_id == user.id)
        
        # Active files (not deleted)
        active_files = query.filter(FileUpload.upload_status != FileUploadStatus.DELETED)
        
        # Calculate basic stats
        total_files = active_files.count()
        all_files = active_files.all()
        
        total_size = sum(f.file_size for f in all_files)
        total_text_size = sum(len(f.text_content or "") for f in all_files)
        
        # Average sizes
        avg_size = total_size / total_files if total_files > 0 else 0
        avg_text_size = total_text_size / total_files if total_files > 0 else 0
        
        return {
            "total_files": total_files,
            "total_size_bytes": total_size,
            "total_size_human": self._format_bytes(total_size),
            "total_text_size_bytes": total_text_size,
            "total_text_size_human": self._format_bytes(total_text_size),
            "avg_file_size_bytes": avg_size,
            "avg_file_size_human": self._format_bytes(avg_size),
            "avg_text_size_bytes": avg_text_size,
            "avg_text_size_human": self._format_bytes(avg_text_size)
        }
    
    # =============================================================================
    # TYPE AND STATUS ANALYTICS
    # =============================================================================
    
    def _get_files_by_type(self, db: Session, user: Optional[User] = None) -> Dict[str, int]:
        """Get file count distribution by MIME type."""
        query = db.query(FileUpload.mime_type, func.count(FileUpload.id).label('count'))
        
        if user:
            query = query.filter(FileUpload.user_id == user.id)
        
        query = query.filter(FileUpload.upload_status != FileUploadStatus.DELETED)
        query = query.group_by(FileUpload.mime_type)
        
        results = query.all()
        return {mime_type: count for mime_type, count in results}
    
    def _get_files_by_status(self, db: Session, user: Optional[User] = None) -> Dict[str, int]:
        """Get file count distribution by upload status."""
        query = db.query(FileUpload.upload_status, func.count(FileUpload.id).label('count'))
        
        if user:
            query = query.filter(FileUpload.user_id == user.id)
        
        query = query.group_by(FileUpload.upload_status)
        
        results = query.all()
        return {str(status): count for status, count in results}
    
    # =============================================================================
    # SIZE ANALYTICS
    # =============================================================================
    
    def _get_size_analytics(self, db: Session, user: Optional[User] = None) -> Dict[str, Any]:
        """Get detailed size analytics and distributions."""
        query = db.query(FileUpload)
        
        if user:
            query = query.filter(FileUpload.user_id == user.id)
        
        active_files = query.filter(FileUpload.upload_status != FileUploadStatus.DELETED).all()
        
        if not active_files:
            return {
                "size_distribution": {},
                "largest_files": [],
                "size_percentiles": {}
            }
        
        # Size distribution by ranges
        size_ranges = {
            "< 1KB": 0,
            "1KB - 10KB": 0,
            "10KB - 100KB": 0,
            "100KB - 1MB": 0,
            "1MB - 10MB": 0,
            "> 10MB": 0
        }
        
        file_sizes = []
        for file_record in active_files:
            size = file_record.file_size
            file_sizes.append(size)
            
            if size < 1024:
                size_ranges["< 1KB"] += 1
            elif size < 10 * 1024:
                size_ranges["1KB - 10KB"] += 1
            elif size < 100 * 1024:
                size_ranges["10KB - 100KB"] += 1
            elif size < 1024 * 1024:
                size_ranges["100KB - 1MB"] += 1
            elif size < 10 * 1024 * 1024:
                size_ranges["1MB - 10MB"] += 1
            else:
                size_ranges["> 10MB"] += 1
        
        # Largest files
        largest_files = sorted(active_files, key=lambda f: f.file_size, reverse=True)[:10]
        largest_files_info = [
            {
                "id": f.id,
                "filename": f.original_filename,
                "size_bytes": f.file_size,
                "size_human": f.get_file_size_human(),
                "mime_type": f.mime_type
            }
            for f in largest_files
        ]
        
        # Size percentiles
        file_sizes.sort()
        total_files = len(file_sizes)
        percentiles = {}
        
        if total_files > 0:
            for p in [25, 50, 75, 90, 95]:
                index = int(total_files * p / 100)
                if index >= total_files:
                    index = total_files - 1
                percentiles[f"p{p}"] = self._format_bytes(file_sizes[index])
        
        return {
            "size_distribution": size_ranges,
            "largest_files": largest_files_info,
            "size_percentiles": percentiles
        }
    
    # =============================================================================
    # TIME-BASED ANALYTICS
    # =============================================================================
    
    def _get_time_based_analytics(self, db: Session, user: Optional[User] = None) -> Dict[str, Any]:
        """Get time-based upload patterns and trends."""
        query = db.query(FileUpload)
        
        if user:
            query = query.filter(FileUpload.user_id == user.id)
        
        active_files = query.filter(FileUpload.upload_status != FileUploadStatus.DELETED)
        
        # Recent uploads (last 24 hours, 7 days, 30 days)
        now = datetime.utcnow()
        day_ago = now - timedelta(days=1)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        
        recent_24h = active_files.filter(FileUpload.upload_date >= day_ago).count()
        recent_7d = active_files.filter(FileUpload.upload_date >= week_ago).count()
        recent_30d = active_files.filter(FileUpload.upload_date >= month_ago).count()
        
        # Upload trend over last 30 days (daily breakdown)
        daily_uploads = defaultdict(int)
        files_last_30d = active_files.filter(FileUpload.upload_date >= month_ago).all()
        
        for file_record in files_last_30d:
            upload_date = file_record.upload_date.date()
            daily_uploads[upload_date.isoformat()] += 1
        
        # Convert to list for frontend consumption
        upload_trend = [
            {"date": date_str, "uploads": count}
            for date_str, count in sorted(daily_uploads.items())
        ]
        
        return {
            "recent_uploads": {
                "last_24h": recent_24h,
                "last_7d": recent_7d,
                "last_30d": recent_30d
            },
            "upload_trend_daily": upload_trend
        }
    
    # =============================================================================
    # USAGE ANALYTICS
    # =============================================================================
    
    def _get_usage_analytics(self, db: Session, user: Optional[User] = None) -> Dict[str, Any]:
        """Get file usage patterns and access analytics."""
        query = db.query(FileUpload)
        
        if user:
            query = query.filter(FileUpload.user_id == user.id)
        
        active_files = query.filter(FileUpload.upload_status != FileUploadStatus.DELETED).all()
        
        if not active_files:
            return {
                "most_accessed_files": [],
                "access_statistics": {},
                "unused_files": []
            }
        
        # Most accessed files
        most_accessed = sorted(active_files, key=lambda f: f.access_count, reverse=True)[:10]
        most_accessed_info = [
            {
                "id": f.id,
                "filename": f.original_filename,
                "access_count": f.access_count,
                "last_accessed": f.last_accessed.isoformat() if f.last_accessed else None,
                "mime_type": f.mime_type
            }
            for f in most_accessed
        ]
        
        # Access statistics
        total_accesses = sum(f.access_count for f in active_files)
        files_with_access = len([f for f in active_files if f.access_count > 0])
        avg_accesses = total_accesses / len(active_files) if active_files else 0
        
        # Unused files (never accessed)
        unused_files = [f for f in active_files if f.access_count == 0]
        unused_files_info = [
            {
                "id": f.id,
                "filename": f.original_filename,
                "upload_date": f.upload_date.isoformat(),
                "size_human": f.get_file_size_human()
            }
            for f in unused_files[:10]  # Limit to 10 for display
        ]
        
        return {
            "most_accessed_files": most_accessed_info,
            "access_statistics": {
                "total_accesses": total_accesses,
                "files_with_access": files_with_access,
                "files_never_accessed": len(unused_files),
                "average_accesses_per_file": avg_accesses
            },
            "unused_files": unused_files_info
        }
    
    # =============================================================================
    # PERFORMANCE METRICS
    # =============================================================================
    
    def _get_performance_metrics(self, db: Session, user: Optional[User] = None) -> Dict[str, Any]:
        """Get performance-related metrics and insights."""
        query = db.query(FileUpload)
        
        if user:
            query = query.filter(FileUpload.user_id == user.id)
        
        all_files = query.all()
        
        if not all_files:
            return {"performance_metrics": {}}
        
        # Success rate
        successful_uploads = len([f for f in all_files if f.upload_status == FileUploadStatus.COMPLETED])
        failed_uploads = len([f for f in all_files if f.upload_status == FileUploadStatus.FAILED])
        total_attempts = len(all_files)
        
        success_rate = (successful_uploads / total_attempts * 100) if total_attempts > 0 else 0
        
        # Text extraction success rate
        files_with_text = len([f for f in all_files if f.text_content])
        text_extraction_rate = (files_with_text / successful_uploads * 100) if successful_uploads > 0 else 0
        
        # Storage efficiency (text vs raw size)
        active_files = [f for f in all_files if f.upload_status == FileUploadStatus.COMPLETED]
        total_raw_size = sum(f.file_size for f in active_files)
        total_text_size = sum(len(f.text_content or "") for f in active_files)
        
        storage_efficiency = (total_text_size / total_raw_size * 100) if total_raw_size > 0 else 0
        
        return {
            "performance_metrics": {
                "upload_success_rate_percent": success_rate,
                "text_extraction_success_rate_percent": text_extraction_rate,
                "storage_efficiency_percent": storage_efficiency,
                "total_upload_attempts": total_attempts,
                "successful_uploads": successful_uploads,
                "failed_uploads": failed_uploads
            }
        }
    
    # =============================================================================
    # ADMIN ANALYTICS (System-wide)
    # =============================================================================
    
    def get_system_analytics(self, db: Session) -> Dict[str, Any]:
        """
        Get system-wide analytics for administrators.
        
        Args:
            db: Database session
            
        Returns:
            Dictionary with system-wide analytics
        """
        try:
            # Get overall system stats
            system_stats = self.get_comprehensive_statistics(db, user=None)
            
            # Top users by file count
            top_users_by_count = db.query(
                FileUpload.user_id,
                func.count(FileUpload.id).label('file_count')
            ).filter(
                FileUpload.upload_status != FileUploadStatus.DELETED
            ).group_by(
                FileUpload.user_id
            ).order_by(
                desc('file_count')
            ).limit(10).all()
            
            # Top users by storage usage
            top_users_by_size = db.query(
                FileUpload.user_id,
                func.sum(FileUpload.file_size).label('total_size')
            ).filter(
                FileUpload.upload_status != FileUploadStatus.DELETED
            ).group_by(
                FileUpload.user_id
            ).order_by(
                desc('total_size')
            ).limit(10).all()
            
            # Convert to user info
            top_users_count_info = []
            for user_id, file_count in top_users_by_count:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    top_users_count_info.append({
                        "user_id": user_id,
                        "username": user.username if hasattr(user, 'username') else user.email,
                        "file_count": file_count
                    })
            
            top_users_size_info = []
            for user_id, total_size in top_users_by_size:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    top_users_size_info.append({
                        "user_id": user_id,
                        "username": user.username if hasattr(user, 'username') else user.email,
                        "total_size_bytes": total_size,
                        "total_size_human": self._format_bytes(total_size)
                    })
            
            # Add admin-specific analytics
            system_stats.update({
                "top_users_by_file_count": top_users_count_info,
                "top_users_by_storage": top_users_size_info,
                "total_users_with_files": len(set(f.user_id for f in db.query(FileUpload).all()))
            })
            
            return system_stats
            
        except Exception as e:
            return {
                "error": f"Failed to get system analytics: {str(e)}",
                "total_files": 0
            }
    
    # =============================================================================
    # UTILITY METHODS
    # =============================================================================
    
    def _format_bytes(self, size_bytes: int) -> str:
        """Format byte size as human-readable string."""
        if size_bytes == 0:
            return "0 B"
        
        units = ['B', 'KB', 'MB', 'GB', 'TB']
        size = float(size_bytes)
        unit_index = 0
        
        while size >= 1024 and unit_index < len(units) - 1:
            size /= 1024
            unit_index += 1
        
        if size == int(size):
            return f"{int(size)} {units[unit_index]}"
        else:
            return f"{size:.1f} {units[unit_index]}"
    
    def get_analytics_summary(self, db: Session, user: Optional[User] = None) -> Dict[str, Any]:
        """
        Get condensed analytics summary for dashboards.
        
        Args:
            db: Database session
            user: Optional user to filter by
            
        Returns:
            Dictionary with key metrics summary
        """
        try:
            # Get basic stats
            basic_stats = self._get_basic_statistics(db, user)
            
            # Get recent activity
            time_stats = self._get_time_based_analytics(db, user)
            
            # Get top file types
            type_stats = self._get_files_by_type(db, user)
            top_types = sorted(type_stats.items(), key=lambda x: x[1], reverse=True)[:5]
            
            return {
                "total_files": basic_stats["total_files"],
                "total_size_human": basic_stats["total_size_human"],
                "recent_uploads_24h": time_stats["recent_uploads"]["last_24h"],
                "recent_uploads_7d": time_stats["recent_uploads"]["last_7d"],
                "top_file_types": [{"type": t, "count": c} for t, c in top_types],
                "avg_file_size_human": basic_stats["avg_file_size_human"]
            }
            
        except Exception as e:
            return {
                "error": f"Failed to get analytics summary: {str(e)}",
                "total_files": 0,
                "total_size_human": "0 B"
            }
