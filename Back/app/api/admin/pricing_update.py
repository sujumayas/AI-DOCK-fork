# AI Dock Admin Pricing Update API
# Endpoints for updating LLM configuration pricing with real-time LiteLLM data

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Dict, Any
import logging

from ...core.security import get_current_user
from ...models.user import User
from ...services.litellm_pricing_service import get_pricing_service

router = APIRouter()
logger = logging.getLogger(__name__)

def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Ensure the current user is an admin.
    
    Args:
        current_user: Current authenticated user from JWT token
        
    Returns:
        User object if they are an admin
        
    Raises:
        HTTPException: 403 if user is not an admin
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active"
        )
    
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    return current_user

@router.post("/pricing/refresh/{config_id}")
async def refresh_config_pricing(
    config_id: int,
    force_refresh: bool = Query(False, description="Force refresh from LiteLLM API"),
    current_user: User = Depends(get_admin_user)
) -> Dict[str, Any]:
    """
    Refresh pricing for a specific LLM configuration using LiteLLM.
    
    Args:
        config_id: LLM configuration ID to update
        force_refresh: Force refresh from LiteLLM API (bypass cache)
        current_user: Admin user making the request
        
    Returns:
        Dictionary with update results
        
    Raises:
        HTTPException: If configuration not found or update fails
    """
    try:
        logger.info(f"🔄 Admin {current_user.email} refreshing pricing for config {config_id}")
        
        pricing_service = get_pricing_service()
        result = await pricing_service.update_llm_config_pricing(config_id, force_refresh)
        
        if result["success"]:
            logger.info(f"✅ Successfully updated pricing for config {config_id}")
            return {
                "success": True,
                "message": f"Pricing updated successfully for configuration {config_id}",
                "data": result
            }
        else:
            logger.error(f"❌ Failed to update pricing for config {config_id}: {result.get('error')}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to update pricing: {result.get('error', 'Unknown error')}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error updating pricing for config {config_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error updating pricing: {str(e)}"
        )

@router.post("/pricing/refresh-all")
async def refresh_all_config_pricing(
    force_refresh: bool = Query(False, description="Force refresh from LiteLLM API"),
    current_user: User = Depends(get_admin_user)
) -> Dict[str, Any]:
    """
    Refresh pricing for all active LLM configurations using LiteLLM.
    
    Args:
        force_refresh: Force refresh from LiteLLM API (bypass cache)
        current_user: Admin user making the request
        
    Returns:
        Dictionary with update results for all configurations
    """
    try:
        logger.info(f"🔄 Admin {current_user.email} refreshing pricing for all configurations")
        
        pricing_service = get_pricing_service()
        results = await pricing_service.update_all_configs_pricing(force_refresh)
        
        successful_updates = sum(1 for r in results if r.get("success", False))
        total_configs = len(results)
        
        logger.info(f"✅ Updated pricing for {successful_updates}/{total_configs} configurations")
        
        return {
            "success": True,
            "message": f"Updated pricing for {successful_updates}/{total_configs} configurations",
            "data": {
                "total_configs": total_configs,
                "successful_updates": successful_updates,
                "failed_updates": total_configs - successful_updates,
                "results": results
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Unexpected error updating all pricing: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error updating pricing: {str(e)}"
        )

@router.get("/pricing/preview/{config_id}")
async def preview_pricing_update(
    config_id: int,
    current_user: User = Depends(get_admin_user)
) -> Dict[str, Any]:
    """
    Preview pricing changes for a specific LLM configuration without updating.
    
    Args:
        config_id: LLM configuration ID to preview
        current_user: Admin user making the request
        
    Returns:
        Dictionary with current and new pricing comparison
    """
    try:
        from ...core.database import AsyncSessionLocal
        from ...models.llm_config import LLMConfiguration
        
        async with AsyncSessionLocal() as session:
            # Get current configuration
            config = await session.get(LLMConfiguration, config_id)
            if not config:
                raise HTTPException(status_code=404, detail="Configuration not found")
            
            provider = config.provider.value if hasattr(config.provider, 'value') else str(config.provider)
            model = config.default_model
            
            # Get current pricing from config
            current_pricing = {
                "input_cost_per_1k": float(config.cost_per_1k_input_tokens or 0),
                "output_cost_per_1k": float(config.cost_per_1k_output_tokens or 0),
                "request_cost": float(config.cost_per_request or 0)
            }
            
            # Get new pricing from LiteLLM
            pricing_service = get_pricing_service()
            new_pricing = await pricing_service.get_model_pricing(provider, model, force_refresh=True)
            
            # Calculate differences
            input_diff = new_pricing["input_cost_per_1k"] - current_pricing["input_cost_per_1k"]
            output_diff = new_pricing["output_cost_per_1k"] - current_pricing["output_cost_per_1k"]
            request_diff = (new_pricing["request_cost"] or 0) - current_pricing["request_cost"]
            
            return {
                "success": True,
                "config_id": config_id,
                "provider": provider,
                "model": model,
                "current_pricing": current_pricing,
                "new_pricing": new_pricing,
                "differences": {
                    "input_cost_per_1k": input_diff,
                    "output_cost_per_1k": output_diff,
                    "request_cost": request_diff
                },
                "recommendation": "update" if abs(input_diff) > 0.0001 or abs(output_diff) > 0.0001 else "current_pricing_accurate"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error previewing pricing for config {config_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error previewing pricing: {str(e)}"
        )

@router.get("/pricing/cache-stats")
async def get_pricing_cache_stats(
    current_user: User = Depends(get_admin_user)
) -> Dict[str, Any]:
    """
    Get LiteLLM pricing service cache statistics.
    
    Args:
        current_user: Admin user making the request
        
    Returns:
        Dictionary with cache statistics
    """
    try:
        pricing_service = get_pricing_service()
        stats = pricing_service.get_cache_stats()
        
        return {
            "success": True,
            "message": "Cache statistics retrieved successfully",
            "data": stats
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting cache stats: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error getting cache stats: {str(e)}"
        )

@router.post("/pricing/clear-cache")
async def clear_pricing_cache(
    current_user: User = Depends(get_admin_user)
) -> Dict[str, Any]:
    """
    Clear the LiteLLM pricing service cache.
    
    Args:
        current_user: Admin user making the request
        
    Returns:
        Dictionary with operation result
    """
    try:
        pricing_service = get_pricing_service()
        
        # Clear the cache by resetting the internal dictionaries
        pricing_service.cache.clear()
        pricing_service.last_cache_update.clear()
        
        logger.info(f"🗑️ Admin {current_user.email} cleared pricing cache")
        
        return {
            "success": True,
            "message": "Pricing cache cleared successfully"
        }
        
    except Exception as e:
        logger.error(f"❌ Error clearing cache: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error clearing cache: {str(e)}"
        )
