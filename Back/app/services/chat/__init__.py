"""
Chat Services Module

This module contains all business logic services for chat functionality,
extracted from the main chat.py file for better modularity.
"""

from .file_service import *
from .assistant_service import *
from .model_service import *

__all__ = [
    # File processing functions
    "process_file_attachments",
    "format_file_for_context",
    "read_file_content",
    "read_text_content", 
    "read_pdf_content",
    
    # Assistant integration functions
    "process_assistant_integration",
    "get_chat_conversation_with_validation",
    "create_chat_conversation_for_assistant",
    "generate_conversation_title",
    
    # Model processing functions
    "get_model_display_name",
    "get_model_cost_tier",
    "get_model_capabilities",
    "is_model_recommended",
    "get_model_relevance_score",
    "deduplicate_and_filter_models",
    "extract_base_model_name",
    "select_best_model_variant",
    "create_unified_model_info",
]
