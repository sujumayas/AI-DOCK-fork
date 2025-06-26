# AI Dock LLM Configuration Validator
# Atomic component for validating and extracting LLM configurations

from typing import Dict, Any
import logging
from sqlalchemy.orm import Session

from ....models.llm_config import LLMConfiguration
from ..exceptions import LLMServiceError


class ConfigValidator:
    """
    Atomic component responsible for LLM configuration validation and data extraction.
    
    Single Responsibility:
    - Validate configuration exists and is active
    - Extract configuration data for session-free usage
    - Provide clean config data structures
    """
    
    def __init__(self):
        """Initialize the configuration validator."""
        self.logger = logging.getLogger(__name__)
    
    async def get_and_validate_config(self, config_id: int, db_session: Session) -> Dict[str, Any]:
        """
        Get and validate LLM configuration, extracting data for session-free use.
        
        Args:
            config_id: ID of the LLM configuration to validate
            db_session: Database session for configuration lookup
            
        Returns:
            Dict containing configuration data extracted from the database model
            
        Raises:
            LLMServiceError: If configuration not found or not active
        """
        self.logger.debug(f"Validating LLM configuration {config_id}")
        
        # Query configuration from database
        config = db_session.query(LLMConfiguration).filter(LLMConfiguration.id == config_id).first()
        
        if not config:
            self.logger.error(f"LLM configuration {config_id} not found")
            raise LLMServiceError(f"LLM configuration {config_id} not found")
        
        if not config.is_active:
            self.logger.error(f"LLM configuration '{config.name}' is not active")
            raise LLMServiceError(f"LLM configuration '{config.name}' is not active")
        
        # Extract config data to avoid session issues in downstream components
        config_data = self._extract_config_data(config)
        
        self.logger.debug(f"Successfully validated config '{config_data['name']}'")
        return config_data
    
    def _extract_config_data(self, config: LLMConfiguration) -> Dict[str, Any]:
        """
        Extract configuration data from SQLAlchemy model into a plain dictionary.
        
        This allows downstream components to use the configuration data without
        maintaining database session dependencies.
        
        Args:
            config: SQLAlchemy LLMConfiguration model instance
            
        Returns:
            Dictionary containing all necessary configuration data
        """
        return {
            'id': config.id,
            'name': config.name,
            'provider': config.provider,
            'api_endpoint': config.api_endpoint,
            'api_key_encrypted': config.api_key_encrypted,
            'default_model': config.default_model,
            'model_parameters': config.model_parameters,
            'cost_per_1k_input_tokens': config.cost_per_1k_input_tokens,
            'cost_per_1k_output_tokens': config.cost_per_1k_output_tokens,
            'cost_per_request': config.cost_per_request,
            'custom_headers': config.custom_headers,
            'is_active': config.is_active,
            'updated_at': config.updated_at
        }
    
    def validate_config_data(self, config_data: Dict[str, Any]) -> bool:
        """
        Validate that configuration data contains all required fields.
        
        Args:
            config_data: Configuration data dictionary
            
        Returns:
            True if valid, False otherwise
        """
        required_fields = ['id', 'name', 'provider', 'default_model', 'is_active']
        
        for field in required_fields:
            if field not in config_data:
                self.logger.error(f"Missing required configuration field: {field}")
                return False
        
        if not config_data['is_active']:
            self.logger.error(f"Configuration '{config_data['name']}' is not active")
            return False
        
        return True


# Factory function for dependency injection
def get_config_validator() -> ConfigValidator:
    """
    Get configuration validator instance.
    
    Returns:
        ConfigValidator instance
    """
    return ConfigValidator()
