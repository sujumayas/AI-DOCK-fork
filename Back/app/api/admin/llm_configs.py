# AI Dock Admin LLM Configuration API
# These endpoints let admins manage LLM provider configurations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import logging

from ...core.database import get_db
from ...core.security import get_current_admin_user
from ...models.llm_config import LLMConfiguration, LLMProvider
from ...schemas.llm_config import (
    LLMConfigurationCreate,
    LLMConfigurationSimpleCreate,
    LLMConfigurationUpdate, 
    LLMConfigurationResponse,
    LLMConfigurationSummary,
    LLMConfigurationTest,
    LLMConfigurationTestResult,
    LLMProviderInfo,
    get_provider_info_list,
    convert_simple_to_full_create
)
from ...services.llm_service import LLMService

# Set up logging for debugging
logger = logging.getLogger(__name__)

# Create router for LLM configuration endpoints
# This groups all LLM config routes under /admin/llm-configs
router = APIRouter(prefix="/llm-configs", tags=["Admin LLM Configurations"])

# =============================================================================
# READ ENDPOINTS (Getting configuration data)
# =============================================================================

@router.get("/", response_model=List[LLMConfigurationSummary])
async def get_llm_configurations(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user),
    include_inactive: bool = False
):
    """
    Get all LLM configurations (summary view).
    
    Learning: This endpoint returns a list of all configurations.
    - Requires admin authentication (get_current_admin_user)
    - Optional parameter to include inactive configurations
    - Returns summary data (not full details) for performance
    
    Args:
        db: Database session
        current_user: Current admin user (from JWT token)
        include_inactive: Whether to include disabled configurations
        
    Returns:
        List of LLM configuration summaries
    """
    logger.info(f"Admin {current_user.username} requesting LLM configurations")
    
    # Build query - start with all configurations
    query = db.query(LLMConfiguration)
    
    # Filter out inactive ones unless explicitly requested
    if not include_inactive:
        query = query.filter(LLMConfiguration.is_active == True)
    
    # Order by priority (lower numbers first), then by name
    configurations = query.order_by(
        LLMConfiguration.priority.asc(),
        LLMConfiguration.name.asc()
    ).all()
    
    logger.info(f"Found {len(configurations)} LLM configurations")
    
    # Convert to response format (this removes sensitive data like API keys)
    return [LLMConfigurationSummary.from_orm(config) for config in configurations]

@router.get("/{config_id}", response_model=LLMConfigurationResponse)
async def get_llm_configuration(
    config_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """
    Get detailed information about a specific LLM configuration.
    
    Learning: This endpoint gets full details for one configuration.
    - Path parameter {config_id} comes from the URL
    - Returns detailed information (but still no API key!)
    - Proper error handling with HTTP 404 if not found
    
    Args:
        config_id: ID of the configuration to retrieve
        db: Database session
        current_user: Current admin user
        
    Returns:
        Detailed LLM configuration information
    """
    logger.info(f"Admin {current_user.username} requesting LLM config {config_id}")
    
    # Find the configuration by ID
    config = db.query(LLMConfiguration).filter(
        LLMConfiguration.id == config_id
    ).first()
    
    # Return 404 if not found
    if not config:
        logger.warning(f"LLM configuration {config_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"LLM configuration with ID {config_id} not found"
        )
    
    logger.info(f"Found LLM configuration: {config.name}")
    
    # Convert to response format (removes sensitive data)
    return LLMConfigurationResponse.from_orm(config)

@router.get("/providers/info", response_model=List[LLMProviderInfo])
async def get_provider_info(
    current_user = Depends(get_current_admin_user)
):
    """
    Get information about all supported LLM providers.
    
    Learning: This endpoint provides metadata for the UI.
    - Helps frontend build provider selection dropdowns
    - Returns static information about each provider
    - No database queries needed - just reference data
    
    Returns:
        List of provider information for UI dropdowns
    """
    logger.info(f"Admin {current_user.username} requesting provider info")
    
    # Get provider info from schema helper function
    provider_info = get_provider_info_list()
    
    logger.info(f"Returning info for {len(provider_info)} providers")
    return provider_info

# =============================================================================
# CREATE ENDPOINT (Adding new configurations)
# =============================================================================

@router.post("/", response_model=LLMConfigurationResponse, status_code=status.HTTP_201_CREATED)
async def create_llm_configuration(
    config_data: LLMConfigurationCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """
    Create a new LLM configuration.
    
    Learning: This endpoint creates new configurations.
    - Takes LLMConfigurationCreate schema (validates all input data)
    - Encrypts API key before storing (security!)
    - Returns 201 Created status with the new configuration
    - Proper error handling for database conflicts
    
    Args:
        config_data: New configuration data (validated by Pydantic)
        db: Database session
        current_user: Current admin user
        
    Returns:
        The newly created LLM configuration
    """
    logger.info(f"Admin {current_user.username} creating LLM configuration: {config_data.name}")
    
    try:
        # Check if name already exists
        existing = db.query(LLMConfiguration).filter(
            LLMConfiguration.name == config_data.name
        ).first()
        
        if existing:
            logger.warning(f"LLM configuration name '{config_data.name}' already exists")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Configuration name '{config_data.name}' already exists"
            )
        
        # Create new configuration object
        # Note: We convert from Pydantic model to SQLAlchemy model
        new_config = LLMConfiguration(
            name=config_data.name,
            description=config_data.description,
            provider=LLMProvider(config_data.provider.value),  # Convert enum
            api_endpoint=str(config_data.api_endpoint),
            api_version=config_data.api_version,
            default_model=config_data.default_model,
            available_models=config_data.available_models,
            model_parameters=config_data.model_parameters,
            rate_limit_rpm=config_data.rate_limit_rpm,
            rate_limit_tpm=config_data.rate_limit_tpm,
            daily_quota=config_data.daily_quota,
            monthly_budget_usd=config_data.monthly_budget_usd,
            cost_per_1k_input_tokens=config_data.cost_per_1k_input_tokens,
            cost_per_1k_output_tokens=config_data.cost_per_1k_output_tokens,
            cost_per_request=config_data.cost_per_request,
            is_active=config_data.is_active,
            is_public=config_data.is_public,
            priority=config_data.priority,
            custom_headers=config_data.custom_headers,
            provider_settings=config_data.provider_settings
        )
        
        # Encrypt and store API key (security is important!)
        new_config.set_encrypted_api_key(config_data.api_key)
        
        # Save to database
        db.add(new_config)
        db.commit()
        db.refresh(new_config)  # Get the ID and timestamps
        
        logger.info(f"Created LLM configuration {new_config.id}: {new_config.name}")
        
        # Return the new configuration (without API key)
        return LLMConfigurationResponse.from_orm(new_config)
        
    except HTTPException:
        # Re-raise HTTP exceptions (like name conflicts)
        raise
    except Exception as e:
        # Handle unexpected database errors
        logger.error(f"Failed to create LLM configuration: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create LLM configuration"
        )

@router.post("/simple", response_model=LLMConfigurationResponse, status_code=status.HTTP_201_CREATED)
async def create_llm_configuration_simple(
    simple_config_data: LLMConfigurationSimpleCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """
    Create a new LLM configuration using simplified input (NEW!).
    
    This is the user-friendly endpoint that only requires 4 fields:
    1. Provider (openai, anthropic, etc.)
    2. Configuration name 
    3. API key
    4. Optional description
    
    Everything else gets smart defaults based on the provider!
    
    Learning: This demonstrates progressive disclosure - we hide complexity
    from the user while still using the full system underneath.
    
    Args:
        simple_config_data: Simplified configuration (just the essentials)
        db: Database session
        current_user: Current admin user
        
    Returns:
        The newly created LLM configuration with all defaults applied
    """
    logger.info(f"Admin {current_user.username} creating LLM configuration (simplified): {simple_config_data.name}")
    
    try:
        # Check if name already exists
        existing = db.query(LLMConfiguration).filter(
            LLMConfiguration.name == simple_config_data.name
        ).first()
        
        if existing:
            logger.warning(f"LLM configuration name '{simple_config_data.name}' already exists")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Configuration name '{simple_config_data.name}' already exists"
            )
        
        # Convert simplified data to full configuration using smart defaults
        logger.info(f"Applying smart defaults for provider: {simple_config_data.provider.value}")
        full_config_data = convert_simple_to_full_create(simple_config_data)
        
        # Create new configuration object (same logic as before)
        new_config = LLMConfiguration(
            name=full_config_data.name,
            description=full_config_data.description,
            provider=LLMProvider(full_config_data.provider.value),
            api_endpoint=str(full_config_data.api_endpoint),
            api_version=full_config_data.api_version,
            default_model=full_config_data.default_model,
            available_models=full_config_data.available_models,
            model_parameters=full_config_data.model_parameters,
            rate_limit_rpm=full_config_data.rate_limit_rpm,
            rate_limit_tpm=full_config_data.rate_limit_tpm,
            daily_quota=full_config_data.daily_quota,
            monthly_budget_usd=full_config_data.monthly_budget_usd,
            cost_per_1k_input_tokens=full_config_data.cost_per_1k_input_tokens,
            cost_per_1k_output_tokens=full_config_data.cost_per_1k_output_tokens,
            cost_per_request=full_config_data.cost_per_request,
            is_active=full_config_data.is_active,
            is_public=full_config_data.is_public,
            priority=full_config_data.priority,
            custom_headers=full_config_data.custom_headers,
            provider_settings=full_config_data.provider_settings
        )
        
        # Encrypt and store API key
        new_config.set_encrypted_api_key(simple_config_data.api_key)
        
        # Save to database
        db.add(new_config)
        db.commit()
        db.refresh(new_config)
        
        logger.info(f"Created LLM configuration {new_config.id}: {new_config.name} with smart defaults for {simple_config_data.provider.value}")
        logger.info(f"Applied defaults: endpoint={new_config.api_endpoint}, model={new_config.default_model}, priority={new_config.priority}")
        
        # Return the new configuration
        return LLMConfigurationResponse.from_orm(new_config)
        
    except HTTPException:
        # Re-raise HTTP exceptions (like name conflicts)
        raise
    except Exception as e:
        # Handle unexpected database errors
        logger.error(f"Failed to create simplified LLM configuration: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create LLM configuration"
        )

# =============================================================================
# UPDATE ENDPOINT (Modifying existing configurations)
# =============================================================================

@router.put("/{config_id}", response_model=LLMConfigurationResponse)
async def update_llm_configuration(
    config_id: int,
    config_data: LLMConfigurationUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """
    Update an existing LLM configuration.
    
    Learning: This endpoint updates configurations with partial data.
    - Only updates fields that are provided (partial updates)
    - Validates that configuration exists before updating
    - Handles API key encryption securely
    - Proper error handling and logging
    
    Args:
        config_id: ID of configuration to update
        config_data: Updated configuration data (only changed fields)
        db: Database session
        current_user: Current admin user
        
    Returns:
        The updated LLM configuration
    """
    logger.info(f"Admin {current_user.username} updating LLM config {config_id}")
    
    try:
        # Find existing configuration
        config = db.query(LLMConfiguration).filter(
            LLMConfiguration.id == config_id
        ).first()
        
        if not config:
            logger.warning(f"LLM configuration {config_id} not found for update")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"LLM configuration with ID {config_id} not found"
            )
        
        # Check for name conflicts (if name is being changed)
        if config_data.name and config_data.name != config.name:
            existing = db.query(LLMConfiguration).filter(
                LLMConfiguration.name == config_data.name,
                LLMConfiguration.id != config_id
            ).first()
            
            if existing:
                logger.warning(f"Name conflict: '{config_data.name}' already exists")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Configuration name '{config_data.name}' already exists"
                )
        
        # Update fields that were provided (partial update pattern)
        update_data = config_data.dict(exclude_unset=True)  # Only include set fields
        
        for field, value in update_data.items():
            if field == "api_key":
                # Handle API key specially (encrypt it)
                if value:
                    config.set_encrypted_api_key(value)
            else:
                # Update regular fields
                setattr(config, field, value)
        
        # Save changes
        db.commit()
        db.refresh(config)
        
        logger.info(f"Updated LLM configuration {config_id}: {config.name}")
        
        # Return updated configuration
        return LLMConfigurationResponse.from_orm(config)
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Failed to update LLM configuration {config_id}: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update LLM configuration"
        )

# =============================================================================
# DELETE ENDPOINT (Removing configurations)
# =============================================================================

@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_llm_configuration(
    config_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """
    Delete an LLM configuration.
    
    Learning: This endpoint removes configurations permanently.
    - Returns 204 No Content on success (standard for deletes)
    - Proper validation that configuration exists
    - Could add safety checks (like "don't delete if in use")
    
    Args:
        config_id: ID of configuration to delete
        db: Database session
        current_user: Current admin user
    """
    logger.info(f"Admin {current_user.username} deleting LLM config {config_id}")
    
    try:
        # Find configuration to delete
        config = db.query(LLMConfiguration).filter(
            LLMConfiguration.id == config_id
        ).first()
        
        if not config:
            logger.warning(f"LLM configuration {config_id} not found for deletion")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"LLM configuration with ID {config_id} not found"
            )
        
        # TODO: Add safety checks here
        # - Check if configuration is currently being used
        # - Warn if it's the only active configuration
        # - Maybe require confirmation for critical configs
        
        config_name = config.name
        
        # Delete the configuration
        db.delete(config)
        db.commit()
        
        logger.info(f"Deleted LLM configuration {config_id}: {config_name}")
        
        # Return 204 No Content (successful deletion)
        return None
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Failed to delete LLM configuration {config_id}: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete LLM configuration"
        )

# =============================================================================
# SPECIAL ACTION ENDPOINTS
# =============================================================================

@router.post("/{config_id}/test", response_model=LLMConfigurationTestResult)
async def test_llm_configuration(
    config_id: int,
    test_data: LLMConfigurationTest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """
    Test connectivity to an LLM configuration.
    
    Learning: This endpoint tests if a configuration actually works.
    - Makes a real API call to the LLM provider
    - Returns detailed test results (success, timing, errors)
    - Updates the configuration's test tracking fields
    - Great for debugging configuration issues
    
    Args:
        config_id: ID of configuration to test
        test_data: Test parameters (message, timeout)
        db: Database session
        current_user: Current admin user
        
    Returns:
        Test results with success status and details
    """
    logger.info(f"Admin {current_user.username} testing LLM config {config_id}")
    
    try:
        # Find configuration to test
        config = db.query(LLMConfiguration).filter(
            LLMConfiguration.id == config_id
        ).first()
        
        if not config:
            logger.warning(f"LLM configuration {config_id} not found for testing")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"LLM configuration with ID {config_id} not found"
            )
        
        logger.info(f"Testing configuration: {config.name} ({config.provider.value})")
        
        # Use LLMService to test the configuration
        llm_service = LLMService()
        
        try:
            # Test with a simple message
            test_result = await llm_service.test_configuration(
                config=config,
                test_message=test_data.test_message,
                timeout_seconds=test_data.timeout_seconds
            )
            
            logger.info(f"Test result for config {config_id}: {test_result['success']}")
            
            # Update the configuration's test tracking
            config.last_tested_at = test_result['tested_at']
            config.last_test_result = str(test_result)
            db.commit()
            
            # Return structured test result
            return LLMConfigurationTestResult(
                success=test_result['success'],
                message=test_result['message'],
                response_time_ms=test_result.get('response_time_ms'),
                tested_at=test_result['tested_at'],
                error_details=test_result.get('error_details')
            )
            
        except Exception as test_error:
            # Handle test failures gracefully
            logger.error(f"LLM configuration test failed: {str(test_error)}")
            
            # Return failure result
            return LLMConfigurationTestResult(
                success=False,
                message=f"Test failed: {str(test_error)}",
                response_time_ms=None,
                tested_at=datetime.utcnow(),
                error_details={"error": str(test_error), "type": type(test_error).__name__}
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Failed to test LLM configuration {config_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to test LLM configuration"
        )

@router.patch("/{config_id}/toggle", response_model=LLMConfigurationResponse)
async def toggle_llm_configuration(
    config_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """
    Toggle the active status of an LLM configuration.
    
    Learning: This is a convenience endpoint for quick enable/disable.
    - PATCH method for partial updates
    - Toggles the is_active field
    - Useful for quick actions in the UI
    
    Args:
        config_id: ID of configuration to toggle
        db: Database session
        current_user: Current admin user
        
    Returns:
        The updated configuration with new status
    """
    logger.info(f"Admin {current_user.username} toggling LLM config {config_id}")
    
    try:
        # Find configuration
        config = db.query(LLMConfiguration).filter(
            LLMConfiguration.id == config_id
        ).first()
        
        if not config:
            logger.warning(f"LLM configuration {config_id} not found for toggle")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"LLM configuration with ID {config_id} not found"
            )
        
        # Toggle active status
        old_status = config.is_active
        config.is_active = not config.is_active
        
        # Save changes
        db.commit()
        db.refresh(config)
        
        logger.info(f"Toggled config {config_id} from {old_status} to {config.is_active}")
        
        # Return updated configuration
        return LLMConfigurationResponse.from_orm(config)
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Failed to toggle LLM configuration {config_id}: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to toggle LLM configuration"
        )

# =============================================================================
# HELPER ENDPOINTS
# =============================================================================

@router.get("/{config_id}/usage-stats")
async def get_configuration_usage_stats(
    config_id: int,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """
    Get usage statistics for a specific LLM configuration.
    
    Learning: This would integrate with usage tracking system.
    - Placeholder for future usage analytics
    - Would show how often this config is used
    - Cost tracking, popular models, etc.
    
    NOTE: This is a placeholder - will be implemented when usage tracking is added
    """
    logger.info(f"Admin {current_user.username} requesting usage stats for config {config_id}")
    
    # Find configuration
    config = db.query(LLMConfiguration).filter(
        LLMConfiguration.id == config_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"LLM configuration with ID {config_id} not found"
        )
    
    # TODO: Implement actual usage statistics
    # This would query usage_logs table when it's implemented
    
    # For now, return placeholder data
    return {
        "config_id": config_id,
        "config_name": config.name,
        "period_days": days,
        "total_requests": 0,
        "total_tokens": 0,
        "total_cost_usd": 0.0,
        "average_response_time_ms": 0,
        "success_rate": 1.0,
        "note": "Usage tracking will be implemented in AID-005"
    }
