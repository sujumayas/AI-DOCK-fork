"""
Model Management Endpoints

Model discovery and management endpoints extracted from the main chat.py file.
Handles getting available models, dynamic model fetching, and unified model lists.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Authentication and database dependencies
from ...core.security import get_current_user
from ...models.user import User
from ...models.llm_config import LLMConfiguration
from ...core.database import get_async_db

# LLM service and exceptions
from ...services.llm_service import (
    llm_service,
    LLMServiceError,
    LLMProviderError
)

# Schemas
from ...schemas.chat_api import (
    DynamicModelsResponse,
    UnifiedModelsResponse,
    UnifiedModelInfo
)

# Chat services
from ...services.chat import (
    get_model_display_name,
    get_model_cost_tier,
    get_model_capabilities,
    is_model_recommended,
    get_model_relevance_score,
    deduplicate_and_filter_models,
    create_unified_model_info
)

router = APIRouter()
logger = logging.getLogger(__name__)

# =============================================================================
# MODEL ENDPOINTS
# =============================================================================

@router.get("/models/{config_id}", response_model=List[str])
async def get_available_models(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Get available models for a specific configuration (legacy endpoint)."""
    try:
        # Validate configuration
        config = await db.get(LLMConfiguration, config_id)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Configuration {config_id} not found"
            )
        
        if not config.is_available_for_user(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this configuration"
            )
        
        # Get models through service
        models = await llm_service.get_available_models(config_id)
        return models
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving available models"
        )

@router.get("/models/{config_id}/dynamic", response_model=DynamicModelsResponse)
async def get_dynamic_models(
    config_id: int,
    use_cache: bool = True,
    show_all_models: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    🆕 Get available models directly from the LLM provider's API with intelligent filtering.
    
    This endpoint fetches real-time model information from providers like OpenAI
    and applies smart filtering to show only relevant, recent models.
    
    Features:
    - Real-time model fetching from OpenAI API
    - 🎯 Intelligent filtering (removes deprecated/irrelevant models)
    - 🛡️ Admin bypass option (show_all_models=true)
    - Intelligent caching (1-hour TTL) to reduce API calls
    - Graceful fallback to configuration models if API fails
    - Smart model sorting (GPT-4o > GPT-4 Turbo > GPT-4 > GPT-3.5)
    - Support for multiple providers (OpenAI, Claude, etc.)
    
    Args:
        config_id: ID of the LLM configuration
        use_cache: Whether to use cached results (default: True)
        show_all_models: If True, bypasses filtering for admin debugging (default: False)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        DynamicModelsResponse with filtered models, metadata, and caching info
        
    Example Usage:
        - Regular users: GET /models/1/dynamic (shows ~8-12 relevant models)
        - Admin debugging: GET /models/1/dynamic?show_all_models=true (shows all ~50+ models)
    """
    try:
        # Validate configuration exists and user has access
        config = await db.get(LLMConfiguration, config_id)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Configuration {config_id} not found"
            )
        
        if not config.is_available_for_user(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this configuration"
            )
        
        logger.info(f"User {current_user.email} requesting dynamic models for config {config_id} (cache: {use_cache}, show_all: {show_all_models})")
        
        # Check if user is admin (only admins can use show_all_models)
        if show_all_models and not current_user.is_admin:
            logger.warning(f"Non-admin user {current_user.email} attempted to use show_all_models flag")
            show_all_models = False  # Silently ignore for non-admins (graceful degradation)
        
        # Get dynamic models through service with filtering control
        models_data = await llm_service.get_dynamic_models(
            config_id=config_id,
            use_cache=use_cache,
            show_all_models=show_all_models
        )
        
        return DynamicModelsResponse(**models_data)
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except LLMServiceError as e:
        logger.error(f"LLM service error getting dynamic models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Service error: {str(e)}"
        )
    except LLMProviderError as e:
        logger.error(f"Provider error getting dynamic models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Provider error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error getting dynamic models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving dynamic models from provider"
        )

# =============================================================================
# UNIFIED MODELS ENDPOINT - Single List Instead of Provider + Model
# =============================================================================

@router.get("/all-models", response_model=UnifiedModelsResponse)
async def get_all_models(
    use_cache: bool = True,
    show_all_models: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    🆕 Get all available models from all providers in a single unified list.
    
    This replaces the provider + model selection with a single model selection.
    Perfect for simplifying the chat interface while maintaining all functionality.
    
    Features:
    - 🎯 Aggregates models from all accessible LLM configurations
    - 🧠 Smart deduplication of similar models (handles multiple GPT-4 variants)
    - 🏆 Intelligent ranking and recommendations
    - 🔍 Enhanced filtering for better UX (no more "3 GPT Turbos, 4 GPT 4os" confusion)
    - 🛡️ Admin bypass option for debugging
    - ⚡ Caching for performance
    
    Args:
        use_cache: Whether to use cached results (default: True)
        show_all_models: If True, bypasses filtering (admin only, default: False)
        current_user: Current authenticated user  
        db: Database session
        
    Returns:
        UnifiedModelsResponse with all models from all providers
        
    Example Usage:
        - Regular users: GET /chat/all-models (shows ~15-20 best models)
        - Admin debugging: GET /chat/all-models?show_all_models=true (shows all models)
    """
    try:
        logger.info(f"User {current_user.email} requesting unified models list (cache: {use_cache}, show_all: {show_all_models})")
        
        # Check admin flag
        if show_all_models and not current_user.is_admin:
            logger.warning(f"Non-admin user {current_user.email} attempted to use show_all_models flag")
            show_all_models = False  # Graceful degradation
        
        # Get all available configurations with better error handling
        try:
            query = select(LLMConfiguration).where(
                LLMConfiguration.is_active == True
            ).order_by(LLMConfiguration.priority, LLMConfiguration.name)
            
            result = await db.execute(query)
            configs = result.scalars().all()
            
            # Filter configurations based on user permissions with error handling
            available_configs = []
            for config in configs:
                try:
                    if config.is_available_for_user(current_user):
                        available_configs.append(config)
                except Exception as config_error:
                    logger.warning(f"Error checking config {config.id} availability: {str(config_error)}")
                    continue
                    
        except Exception as db_error:
            logger.error(f"Database error getting configurations: {str(db_error)}")
            # Return empty response instead of crashing
            return UnifiedModelsResponse(
                models=[],
                total_models=0,
                total_configs=0,
                default_model_id=None,
                default_config_id=None,
                cached=False,
                providers=[],
                filtering_applied=False
            )
        
        if not available_configs:
            return UnifiedModelsResponse(
                models=[],
                total_models=0,
                total_configs=0,
                default_model_id=None,
                default_config_id=None,
                cached=False,
                providers=[],
                filtering_applied=False
            )
        
        logger.info(f"Found {len(available_configs)} accessible configurations for user")
        
        # Fetch models from all configurations
        all_models = []
        providers = set()
        any_cached = False
        original_total_count = 0
        
        for config in available_configs:
            try:
                logger.info(f"Fetching models for config {config.id}: {config.name}")
                
                # Get dynamic models with better error handling
                try:
                    models_data = await llm_service.get_dynamic_models(
                        config_id=config.id,
                        use_cache=use_cache,
                        show_all_models=show_all_models
                    )
                    
                    providers.add(models_data.get("provider", config.provider_name))
                    if models_data.get("cached", False):
                        any_cached = True
                    
                    config_models = models_data.get("models", [])
                    original_total_count += len(config_models)
                    default_model = models_data.get("default_model", config.default_model)
                    
                    logger.info(f"Config {config.name}: {len(config_models)} models, default: {default_model}")
                    
                    # Convert models to unified format with error handling
                    for model_id in config_models:
                        try:
                            # Create unified model info
                            unified_model = create_unified_model_info(
                                model_id=model_id,
                                provider=models_data.get("provider", config.provider_name),
                                config_id=config.id,
                                config_name=config.name,
                                is_default=(model_id == default_model)
                            )
                            
                            all_models.append(unified_model)
                            
                        except Exception as model_error:
                            logger.warning(f"Error processing model {model_id} from config {config.name}: {str(model_error)}")
                            continue  # Skip this model but continue with others
                    
                except Exception as fetch_error:
                    logger.error(f"Failed to fetch models for config {config.name}: {str(fetch_error)}")
                    
                    # Fallback to configuration-defined models
                    try:
                        fallback_models = [config.default_model] if config.default_model else []
                        logger.info(f"Using fallback model for config {config.name}: {fallback_models}")
                        
                        for model_id in fallback_models:
                            if model_id:  # Skip empty models
                                try:
                                    unified_model = create_unified_model_info(
                                        model_id=model_id,
                                        provider=config.provider_name,
                                        config_id=config.id,
                                        config_name=f"{config.name} (fallback)",
                                        is_default=True
                                    )
                                    
                                    all_models.append(unified_model)
                                    providers.add(config.provider_name)
                                    
                                except Exception:
                                    continue
                        
                    except Exception as fallback_error:
                        logger.error(f"Fallback also failed for config {config.name}: {str(fallback_error)}")
                        continue  # Skip this config entirely
                    
            except Exception as config_error:
                logger.error(f"Critical error processing config {config.name}: {str(config_error)}")
                continue  # Continue with other configurations
        
        # Smart deduplication and filtering
        if not show_all_models and len(all_models) > 0:
            all_models = deduplicate_and_filter_models(all_models)
            logger.info(f"Smart filtering: {original_total_count} -> {len(all_models)} models")
        
        # Sort models by relevance and provider priority
        all_models.sort(key=lambda m: (
            -m.relevance_score if m.relevance_score else 0,  # Higher relevance first
            0 if m.is_recommended else 1,                    # Recommended first
            0 if m.is_default else 1,                        # Defaults first
            m.display_name                                   # Alphabetical fallback
        ))
        
        # Find the best default model (highest priority config's default)
        default_model_id = None
        default_config_id = None
        
        if available_configs and all_models:
            # Use the highest priority configuration's default model
            primary_config = available_configs[0]  # Already sorted by priority
            default_model_id = primary_config.default_model
            default_config_id = primary_config.id
            
            # Verify the default model is in our unified list
            if not any(m.id == default_model_id for m in all_models):
                # Fall back to first recommended or first model
                for model in all_models:
                    if model.is_recommended or model.is_default:
                        default_model_id = model.id
                        default_config_id = model.config_id
                        break
                else:
                    # Last resort: first model
                    if all_models:
                        default_model_id = all_models[0].id
                        default_config_id = all_models[0].config_id
        
        logger.info(f"Unified models response: {len(all_models)} models, {len(available_configs)} configs, default: {default_model_id}")
        
        return UnifiedModelsResponse(
            models=all_models,
            total_models=len(all_models),
            total_configs=len(available_configs),
            default_model_id=default_model_id,
            default_config_id=default_config_id,
            cached=any_cached,
            providers=sorted(list(providers)),
            filtering_applied=not show_all_models,
            original_total_models=original_total_count if not show_all_models else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Critical error in get_all_models: {str(e)}")
        # Return structured error response instead of crashing
        return UnifiedModelsResponse(
            models=[],
            total_models=0,
            total_configs=0,
            default_model_id=None,
            default_config_id=None,
            cached=False,
            providers=[],
            filtering_applied=False
        )
