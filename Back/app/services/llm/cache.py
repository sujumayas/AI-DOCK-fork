# AI Dock LLM Model Caching System
# Robust caching for model names to avoid hitting provider APIs frequently

import json
import time
import asyncio
import logging
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

# =============================================================================
# CACHE DATA STRUCTURES
# =============================================================================

@dataclass
class CachedModelData:
    """Data structure for cached model information."""
    models: List[str]
    provider: str
    config_id: int
    config_name: str
    default_model: str
    cached_at: datetime
    expires_at: datetime
    cache_key: str
    total_api_models: Optional[int] = None
    filtering_applied: bool = False
    original_total_models: Optional[int] = None
    
    def is_expired(self) -> bool:
        """Check if cache entry has expired."""
        return datetime.utcnow() > self.expires_at
    
    def time_until_expiry(self) -> timedelta:
        """Get time until cache expiry."""
        return self.expires_at - datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "models": self.models,
            "provider": self.provider,
            "config_id": self.config_id,
            "config_name": self.config_name,
            "default_model": self.default_model,
            "cached": True,
            "cached_at": self.cached_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "filtering_applied": self.filtering_applied,
            "total_api_models": self.total_api_models,
            "original_total_models": self.original_total_models
        }

# =============================================================================
# ABSTRACT CACHE INTERFACE
# =============================================================================

class ModelCacheInterface(ABC):
    """Abstract interface for model caching implementations."""
    
    @abstractmethod
    async def get(self, cache_key: str) -> Optional[CachedModelData]:
        """Get cached model data by key."""
        pass
    
    @abstractmethod
    async def set(self, cache_key: str, data: CachedModelData, ttl_seconds: int) -> bool:
        """Set cached model data with TTL."""
        pass
    
    @abstractmethod
    async def delete(self, cache_key: str) -> bool:
        """Delete cached data by key."""
        pass
    
    @abstractmethod
    async def clear_all(self) -> int:
        """Clear all cached data. Returns number of items cleared."""
        pass
    
    @abstractmethod
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        pass

# =============================================================================
# IN-MEMORY CACHE IMPLEMENTATION
# =============================================================================

class InMemoryModelCache(ModelCacheInterface):
    """
    In-memory cache implementation for model data.
    
    Features:
    - Thread-safe operations with asyncio locks
    - Automatic expiry cleanup
    - Memory-efficient storage
    - Statistics tracking
    """
    
    def __init__(self, cleanup_interval_seconds: int = 300):
        """
        Initialize in-memory cache.
        
        Args:
            cleanup_interval_seconds: How often to clean up expired entries
        """
        self._cache: Dict[str, CachedModelData] = {}
        self._lock = asyncio.Lock()
        self._stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "deletes": 0,
            "expired_cleanups": 0
        }
        self._cleanup_interval = cleanup_interval_seconds
        self._cleanup_task = None
        self._start_cleanup_task()
    
    def _start_cleanup_task(self):
        """Start background task for cleaning up expired entries."""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_expired_entries())
    
    async def _cleanup_expired_entries(self):
        """Background task to clean up expired cache entries."""
        while True:
            try:
                await asyncio.sleep(self._cleanup_interval)
                
                async with self._lock:
                    expired_keys = [
                        key for key, data in self._cache.items()
                        if data.is_expired()
                    ]
                    
                    for key in expired_keys:
                        del self._cache[key]
                        self._stats["expired_cleanups"] += 1
                    
                    if expired_keys:
                        logger.info(f"Cleaned up {len(expired_keys)} expired cache entries")
                        
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cache cleanup task: {e}")
    
    async def get(self, cache_key: str) -> Optional[CachedModelData]:
        """Get cached model data by key."""
        async with self._lock:
            data = self._cache.get(cache_key)
            
            if data is None:
                self._stats["misses"] += 1
                return None
            
            if data.is_expired():
                del self._cache[cache_key]
                self._stats["misses"] += 1
                self._stats["expired_cleanups"] += 1
                return None
            
            self._stats["hits"] += 1
            return data
    
    async def set(self, cache_key: str, data: CachedModelData, ttl_seconds: int) -> bool:
        """Set cached model data with TTL."""
        async with self._lock:
            # Update expiry time
            data.expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)
            data.cache_key = cache_key
            
            self._cache[cache_key] = data
            self._stats["sets"] += 1
            
            logger.debug(f"Cached {len(data.models)} models for key '{cache_key}' (expires in {ttl_seconds}s)")
            return True
    
    async def delete(self, cache_key: str) -> bool:
        """Delete cached data by key."""
        async with self._lock:
            if cache_key in self._cache:
                del self._cache[cache_key]
                self._stats["deletes"] += 1
                return True
            return False
    
    async def clear_all(self) -> int:
        """Clear all cached data."""
        async with self._lock:
            count = len(self._cache)
            self._cache.clear()
            logger.info(f"Cleared all {count} cache entries")
            return count
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        async with self._lock:
            total_requests = self._stats["hits"] + self._stats["misses"]
            hit_rate = (self._stats["hits"] / total_requests) if total_requests > 0 else 0
            
            return {
                "cache_type": "in_memory",
                "entries": len(self._cache),
                "hits": self._stats["hits"],
                "misses": self._stats["misses"],
                "hit_rate": f"{hit_rate:.2%}",
                "sets": self._stats["sets"],
                "deletes": self._stats["deletes"],
                "expired_cleanups": self._stats["expired_cleanups"],
                "memory_usage_mb": sum(
                    len(json.dumps(data.to_dict()).encode('utf-8'))
                    for data in self._cache.values()
                ) / (1024 * 1024)
            }

# =============================================================================
# REDIS CACHE IMPLEMENTATION (OPTIONAL)
# =============================================================================

class RedisModelCache(ModelCacheInterface):
    """
    Redis-based cache implementation for model data.
    
    Features:
    - Persistent storage across restarts
    - Distributed caching for multiple instances
    - Automatic TTL management
    - JSON serialization/deserialization
    """
    
    def __init__(self, redis_client, key_prefix: str = "llm_models:"):
        """
        Initialize Redis cache.
        
        Args:
            redis_client: Redis client instance
            key_prefix: Prefix for all cache keys
        """
        self.redis = redis_client
        self.key_prefix = key_prefix
        self._stats_key = f"{key_prefix}stats"
    
    def _make_key(self, cache_key: str) -> str:
        """Create full Redis key with prefix."""
        return f"{self.key_prefix}{cache_key}"
    
    async def get(self, cache_key: str) -> Optional[CachedModelData]:
        """Get cached model data by key."""
        try:
            redis_key = self._make_key(cache_key)
            data_json = await self.redis.get(redis_key)
            
            if data_json is None:
                await self._increment_stat("misses")
                return None
            
            # Deserialize from JSON
            data_dict = json.loads(data_json)
            
            # Convert datetime strings back to datetime objects
            data_dict["cached_at"] = datetime.fromisoformat(data_dict["cached_at"])
            data_dict["expires_at"] = datetime.fromisoformat(data_dict["expires_at"])
            
            cached_data = CachedModelData(**data_dict)
            
            # Check if expired (Redis TTL might not have triggered yet)
            if cached_data.is_expired():
                await self.delete(cache_key)
                await self._increment_stat("misses")
                return None
            
            await self._increment_stat("hits")
            return cached_data
            
        except Exception as e:
            logger.error(f"Error getting from Redis cache: {e}")
            await self._increment_stat("misses")
            return None
    
    async def set(self, cache_key: str, data: CachedModelData, ttl_seconds: int) -> bool:
        """Set cached model data with TTL."""
        try:
            redis_key = self._make_key(cache_key)
            
            # Update expiry time
            data.expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)
            data.cache_key = cache_key
            
            # Serialize to JSON
            data_dict = asdict(data)
            data_dict["cached_at"] = data.cached_at.isoformat()
            data_dict["expires_at"] = data.expires_at.isoformat()
            
            data_json = json.dumps(data_dict)
            
            # Set with TTL
            await self.redis.setex(redis_key, ttl_seconds, data_json)
            await self._increment_stat("sets")
            
            logger.debug(f"Cached {len(data.models)} models in Redis for key '{cache_key}' (TTL: {ttl_seconds}s)")
            return True
            
        except Exception as e:
            logger.error(f"Error setting Redis cache: {e}")
            return False
    
    async def delete(self, cache_key: str) -> bool:
        """Delete cached data by key."""
        try:
            redis_key = self._make_key(cache_key)
            result = await self.redis.delete(redis_key)
            
            if result > 0:
                await self._increment_stat("deletes")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Error deleting from Redis cache: {e}")
            return False
    
    async def clear_all(self) -> int:
        """Clear all cached data."""
        try:
            pattern = f"{self.key_prefix}*"
            keys = await self.redis.keys(pattern)
            
            if keys:
                # Exclude stats key from deletion
                model_keys = [key for key in keys if not key.endswith(b"stats")]
                if model_keys:
                    count = await self.redis.delete(*model_keys)
                    logger.info(f"Cleared {count} Redis cache entries")
                    return count
            
            return 0
            
        except Exception as e:
            logger.error(f"Error clearing Redis cache: {e}")
            return 0
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        try:
            stats_data = await self.redis.hgetall(self._stats_key)
            
            if not stats_data:
                return {
                    "cache_type": "redis",
                    "hits": 0,
                    "misses": 0,
                    "sets": 0,
                    "deletes": 0,
                    "hit_rate": "0.00%"
                }
            
            # Convert bytes to integers
            hits = int(stats_data.get(b"hits", 0))
            misses = int(stats_data.get(b"misses", 0))
            sets = int(stats_data.get(b"sets", 0))
            deletes = int(stats_data.get(b"deletes", 0))
            
            total_requests = hits + misses
            hit_rate = (hits / total_requests) if total_requests > 0 else 0
            
            return {
                "cache_type": "redis",
                "hits": hits,
                "misses": misses,
                "hit_rate": f"{hit_rate:.2%}",
                "sets": sets,
                "deletes": deletes
            }
            
        except Exception as e:
            logger.error(f"Error getting Redis stats: {e}")
            return {"cache_type": "redis", "error": str(e)}
    
    async def _increment_stat(self, stat_name: str):
        """Increment a statistic counter."""
        try:
            await self.redis.hincrby(self._stats_key, stat_name, 1)
        except Exception as e:
            logger.debug(f"Error incrementing stat {stat_name}: {e}")

# =============================================================================
# CACHE MANAGER AND FACTORY
# =============================================================================

class ModelCacheManager:
    """
    Main cache manager that provides a unified interface.
    
    Automatically handles cache key generation, TTL management,
    and fallback between different cache implementations.
    """
    
    def __init__(
        self,
        cache_impl: ModelCacheInterface,
        default_ttl_seconds: int = 3600,  # 1 hour default
        key_prefix: str = "models"
    ):
        """
        Initialize cache manager.
        
        Args:
            cache_impl: Cache implementation to use
            default_ttl_seconds: Default TTL for cached entries
            key_prefix: Prefix for cache keys
        """
        self.cache = cache_impl
        self.default_ttl = default_ttl_seconds
        self.key_prefix = key_prefix
        
        logger.info(f"Initialized ModelCacheManager with {type(cache_impl).__name__} (TTL: {default_ttl_seconds}s)")
    
    def _generate_cache_key(
        self,
        config_id: int,
        show_all_models: bool = False,
        extra_params: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate cache key for model data.
        
        Args:
            config_id: LLM configuration ID
            show_all_models: Whether all models are requested
            extra_params: Additional parameters that affect caching
            
        Returns:
            Cache key string
        """
        key_parts = [
            self.key_prefix,
            f"config_{config_id}",
            f"all_{show_all_models}"
        ]
        
        if extra_params:
            # Sort params for consistent key generation
            sorted_params = sorted(extra_params.items())
            params_str = "_".join(f"{k}_{v}" for k, v in sorted_params)
            key_parts.append(params_str)
        
        return ":".join(key_parts)
    
    async def get_models(
        self,
        config_id: int,
        show_all_models: bool = False,
        extra_params: Optional[Dict[str, Any]] = None
    ) -> Optional[CachedModelData]:
        """
        Get cached model data.
        
        Args:
            config_id: LLM configuration ID
            show_all_models: Whether all models are requested
            extra_params: Additional cache parameters
            
        Returns:
            Cached model data or None if not found/expired
        """
        cache_key = self._generate_cache_key(config_id, show_all_models, extra_params)
        
        cached_data = await self.cache.get(cache_key)
        
        if cached_data:
            logger.debug(f"Cache HIT for key '{cache_key}' (expires in {cached_data.time_until_expiry()})")
        else:
            logger.debug(f"Cache MISS for key '{cache_key}'")
        
        return cached_data
    
    async def set_models(
        self,
        config_id: int,
        models: List[str],
        provider: str,
        config_name: str,
        default_model: str,
        show_all_models: bool = False,
        ttl_seconds: Optional[int] = None,
        extra_params: Optional[Dict[str, Any]] = None,
        **metadata
    ) -> bool:
        """
        Cache model data.
        
        Args:
            config_id: LLM configuration ID
            models: List of model names
            provider: Provider name
            config_name: Configuration name
            default_model: Default model name
            show_all_models: Whether all models are being cached
            ttl_seconds: TTL override (uses default if None)
            extra_params: Additional cache parameters
            **metadata: Additional metadata to store
            
        Returns:
            True if successfully cached, False otherwise
        """
        cache_key = self._generate_cache_key(config_id, show_all_models, extra_params)
        ttl = ttl_seconds or self.default_ttl
        
        cached_data = CachedModelData(
            models=models,
            provider=provider,
            config_id=config_id,
            config_name=config_name,
            default_model=default_model,
            cached_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(seconds=ttl),
            cache_key=cache_key,
            filtering_applied=not show_all_models,
            **metadata
        )
        
        success = await self.cache.set(cache_key, cached_data, ttl)
        
        if success:
            logger.info(f"Cached {len(models)} models for config {config_id} (key: '{cache_key}', TTL: {ttl}s)")
        else:
            logger.error(f"Failed to cache models for config {config_id}")
        
        return success
    
    async def invalidate_config(self, config_id: int) -> int:
        """
        Invalidate all cached data for a specific configuration.
        
        Args:
            config_id: Configuration ID to invalidate
            
        Returns:
            Number of cache entries invalidated
        """
        # For simple implementations, we might need to clear all and let them repopulate
        # For more advanced implementations, we could track keys by config_id
        logger.info(f"Invalidating cache for config {config_id}")
        
        # This is a simple approach - clear specific keys we know about
        keys_to_delete = [
            self._generate_cache_key(config_id, False),
            self._generate_cache_key(config_id, True)
        ]
        
        deleted_count = 0
        for key in keys_to_delete:
            if await self.cache.delete(key):
                deleted_count += 1
        
        return deleted_count
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics."""
        base_stats = await self.cache.get_stats()
        
        return {
            **base_stats,
            "default_ttl_seconds": self.default_ttl,
            "key_prefix": self.key_prefix
        }

# =============================================================================
# CACHE FACTORY AND SINGLETON
# =============================================================================

# Global cache manager instance
_cache_manager: Optional[ModelCacheManager] = None

def get_model_cache_manager() -> ModelCacheManager:
    """
    Get or create the global model cache manager.
    
    Returns:
        Global ModelCacheManager instance
    """
    global _cache_manager
    
    if _cache_manager is None:
        # Default to in-memory cache
        # In production, you might want to use Redis
        cache_impl = InMemoryModelCache(cleanup_interval_seconds=300)
        
        # Check if Redis is available and configured
        try:
            from app.core.config import get_settings
            settings = get_settings()
            
            # If Redis URL is configured, use Redis cache
            if hasattr(settings, 'REDIS_URL') and settings.REDIS_URL:
                import redis.asyncio as redis
                redis_client = redis.from_url(settings.REDIS_URL, decode_responses=False)
                cache_impl = RedisModelCache(redis_client)
                logger.info("Using Redis cache for model data")
            else:
                logger.info("Using in-memory cache for model data")
                
        except ImportError:
            logger.info("Redis not available, using in-memory cache")
        except Exception as e:
            logger.warning(f"Failed to initialize Redis cache, falling back to in-memory: {e}")
        
        _cache_manager = ModelCacheManager(
            cache_impl=cache_impl,
            default_ttl_seconds=3600  # 1 hour default
        )
    
    return _cache_manager

def reset_cache_manager():
    """Reset the global cache manager (useful for testing)."""
    global _cache_manager
    _cache_manager = None

# Export main classes and functions
__all__ = [
    'CachedModelData',
    'ModelCacheInterface',
    'InMemoryModelCache',
    'RedisModelCache',
    'ModelCacheManager',
    'get_model_cache_manager',
    'reset_cache_manager'
] 