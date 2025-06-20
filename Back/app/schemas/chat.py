"""
Chat schemas with file attachment support for AI Dock application.

These Pydantic models extend the conversation system to support file attachments
in chat messages, enabling users to upload files that the AI can read and respond to.

🎓 LEARNING: Schema Extension and Composition
============================================
This module demonstrates advanced Pydantic patterns:
1. Schema Inheritance - Building on existing conversation schemas
2. Optional Fields - Adding features without breaking existing functionality  
3. Union Types - Supporting messages with or without files
4. Data Transformation - Converting file uploads into AI-readable content

Why separate chat schemas from conversation schemas?
- Conversation schemas handle basic message storage
- Chat schemas handle real-time messaging with files
- Separation of concerns keeps code maintainable
- Different API endpoints can use appropriate schemas
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum

# Import existing schemas to build upon
from .conversation import ConversationMessageBase, ConversationMessageResponse
from .file_upload import FileUploadResponse, AllowedFileType


# =============================================================================
# FILE PROCESSING ENUMS
# =============================================================================

class FileProcessingStatus(str, Enum):
    """
    Status of file content processing for AI consumption.
    
    🎓 LEARNING: File Processing Pipeline
    ===================================
    Files go through stages before AI can use them:
    1. UPLOADED - File received, not yet processed
    2. PROCESSING - Extracting and validating content
    3. READY - Content extracted, ready for AI
    4. FAILED - Processing failed (corrupt, too large, etc.)
    5. TRUNCATED - Content was too long, truncated for AI
    """
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"
    TRUNCATED = "truncated"


class ContentType(str, Enum):
    """
    Types of content that can be extracted from files.
    
    🎓 LEARNING: Content Classification
    =================================
    Different file types provide different content:
    - PLAIN_TEXT: Simple text files (.txt, .md)
    - STRUCTURED_DATA: CSV, JSON with tabular data
    - CODE: Programming language files
    - MARKUP: HTML, XML with structure
    """
    PLAIN_TEXT = "plain_text"
    STRUCTURED_DATA = "structured_data"
    CODE = "code"
    MARKUP = "markup"


# =============================================================================
# FILE ATTACHMENT SCHEMAS
# =============================================================================

class FileAttachment(BaseModel):
    """
    Represents a file attached to a chat message.
    
    🎓 LEARNING: Lightweight Reference Pattern
    =========================================
    Instead of embedding full file data in messages:
    - Store file reference (ID + key metadata)
    - Keep message schemas lightweight
    - Enable efficient message loading
    - File details fetched separately if needed
    """
    file_id: int = Field(..., description="Reference to uploaded file")
    filename: str = Field(..., description="Original filename for display")
    file_size: int = Field(..., description="File size in bytes") 
    file_size_human: str = Field(..., description="Human-readable file size")
    mime_type: str = Field(..., description="MIME type of the file")
    processing_status: FileProcessingStatus = Field(..., description="File processing status")
    content_preview: Optional[str] = Field(None, description="First 200 chars of content")
    error_message: Optional[str] = Field(None, description="Error if processing failed")
    uploaded_at: datetime = Field(..., description="When file was uploaded")
    
    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        schema_extra = {
            "example": {
                "file_id": 123,
                "filename": "project_requirements.txt",
                "file_size": 2048,
                "file_size_human": "2.0 KB",
                "mime_type": "text/plain",
                "processing_status": "ready",
                "content_preview": "Project Requirements\n\n1. User authentication\n2. File upload system\n3. Chat interface with AI...",
                "error_message": None,
                "uploaded_at": "2025-06-18T10:30:00Z"
            }
        }


class ProcessedFileContent(BaseModel):
    """
    Processed file content ready for AI consumption.
    
    🎓 LEARNING: AI-Optimized Data Structure
    ======================================
    Raw files need processing before AI can use them:
    - Content extraction and validation
    - Format standardization (all text becomes plain text)
    - Size management (truncation if too long)
    - Context building (filename, type info for AI)
    """
    file_id: int = Field(..., description="Reference to original file")
    filename: str = Field(..., description="Original filename")
    content_type: ContentType = Field(..., description="Type of extracted content")
    processed_content: str = Field(..., description="Content formatted for AI consumption")
    content_length: int = Field(..., description="Length of processed content")
    is_truncated: bool = Field(default=False, description="Whether content was truncated")
    truncation_info: Optional[str] = Field(None, description="Info about truncation if applied")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional content metadata")
    processed_at: datetime = Field(..., description="When content was processed")
    
    @validator('processed_content')
    def validate_content_length(cls, v):
        """Ensure content isn't too long for LLM context."""
        max_length = 50000  # 50KB limit for LLM processing
        if len(v) > max_length:
            raise ValueError(f'Processed content too long: {len(v)} chars (max {max_length})')
        return v
    
    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        schema_extra = {
            "example": {
                "file_id": 123,
                "filename": "data.csv",
                "content_type": "structured_data",
                "processed_content": "CSV File: data.csv\nColumns: name, age, department\nRows: 150\nSample data:\nJohn Doe, 30, Engineering\nJane Smith, 25, Marketing\n...",
                "content_length": 1250,
                "is_truncated": False,
                "truncation_info": None,
                "metadata": {
                    "rows": 150,
                    "columns": ["name", "age", "department"],
                    "encoding": "utf-8"
                },
                "processed_at": "2025-06-18T10:30:15Z"
            }
        }


# =============================================================================
# CHAT MESSAGE SCHEMAS WITH FILE SUPPORT
# =============================================================================

class ChatMessageWithFiles(ConversationMessageBase):
    """
    Chat message schema that supports file attachments.
    
    🎓 LEARNING: Schema Inheritance
    =============================
    By inheriting from ConversationMessageBase:
    - Get all existing message fields (role, content, etc.)
    - Add new file-specific fields
    - Maintain compatibility with existing code
    - Reuse validation logic
    """
    file_attachments: Optional[List[FileAttachment]] = Field(
        default=None,
        description="Files attached to this message"
    )
    has_files: bool = Field(
        default=False,
        description="Quick check if message has file attachments"
    )
    total_files: int = Field(
        default=0,
        description="Number of attached files"
    )
    
    @validator('has_files', always=True)
    def set_has_files(cls, v, values):
        """Automatically set has_files based on file_attachments."""
        file_attachments = values.get('file_attachments')
        return file_attachments is not None and len(file_attachments) > 0
    
    @validator('total_files', always=True)
    def set_total_files(cls, v, values):
        """Automatically set total_files count."""
        file_attachments = values.get('file_attachments')
        return len(file_attachments) if file_attachments else 0
    
    class Config:
        schema_extra = {
            "example": {
                "role": "user",
                "content": "Please analyze this CSV data and tell me what insights you can find.",
                "file_attachments": [
                    {
                        "file_id": 123,
                        "filename": "sales_data.csv",
                        "file_size": 15360,
                        "file_size_human": "15.0 KB",
                        "mime_type": "text/csv",
                        "processing_status": "ready",
                        "content_preview": "Date,Product,Sales,Region\n2025-01-01,Widget A,1000,North\n2025-01-01,Widget B,750,South...",
                        "uploaded_at": "2025-06-18T10:25:00Z"
                    }
                ],
                "has_files": True,
                "total_files": 1
            }
        }


class ChatMessageResponse(ConversationMessageResponse):
    """
    Chat message response schema with file attachment support.
    
    🎓 LEARNING: Response Schema Extension
    ====================================
    Response schemas often need more data than request schemas:
    - Include computed fields (has_files, total_files)
    - Add relationship data (file processing status)
    - Provide metadata for UI (file sizes, previews)
    """
    file_attachments: Optional[List[FileAttachment]] = Field(
        default=None,
        description="Files attached to this message"
    )
    has_files: bool = Field(
        default=False,
        description="Whether message has file attachments"
    )
    total_files: int = Field(
        default=0,
        description="Number of attached files"
    )
    
    class Config:
        from_attributes = True
        populate_by_name = True


# =============================================================================
# CHAT REQUEST/RESPONSE SCHEMAS
# =============================================================================

class ChatSendRequest(BaseModel):
    """
    Request schema for sending chat messages with optional file attachments.
    
    🎓 LEARNING: Flexible API Design
    ==============================
    This schema supports multiple use cases:
    - Regular text messages (no files)
    - Messages with file attachments
    - File-only messages (minimal text)
    - Multiple files per message
    """
    message: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="User's message text"
    )
    file_ids: Optional[List[int]] = Field(
        default=None,
        description="List of uploaded file IDs to attach"
    )
    conversation_id: Optional[int] = Field(
        None,
        description="Existing conversation ID (creates new if not provided)"
    )
    model_preference: Optional[str] = Field(
        None,
        description="Preferred LLM model for this message"
    )
    stream_response: bool = Field(
        default=True,
        description="Whether to stream the AI response"
    )
    include_file_content: bool = Field(
        default=True,
        description="Whether to include file content in AI context"
    )
    
    @validator('file_ids')
    def validate_file_ids(cls, v):
        """Validate file IDs list."""
        if v is not None:
            if len(v) > 10:  # Limit files per message
                raise ValueError('Maximum 10 files per message')
            if len(set(v)) != len(v):
                raise ValueError('Duplicate file IDs not allowed')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "message": "Please analyze this sales data and identify trends.",
                "file_ids": [123, 124],
                "conversation_id": 456,
                "model_preference": "gpt-4",
                "stream_response": True,
                "include_file_content": True
            }
        }


class ChatSendResponse(BaseModel):
    """
    Response schema for chat message sending.
    
    🎓 LEARNING: Comprehensive Response Data
    ======================================
    Return enough info for frontend to:
    - Update conversation UI immediately
    - Show file processing status
    - Handle errors gracefully
    - Enable streaming if requested
    """
    success: bool = Field(..., description="Whether message was sent successfully")
    conversation_id: int = Field(..., description="Conversation ID (new or existing)")
    message_id: int = Field(..., description="ID of the sent message")
    user_message: ChatMessageResponse = Field(..., description="The user's message as stored")
    ai_response_id: Optional[int] = Field(None, description="AI response message ID if not streaming")
    ai_response: Optional[ChatMessageResponse] = Field(None, description="AI response if not streaming")
    is_streaming: bool = Field(..., description="Whether AI response is being streamed")
    stream_url: Optional[str] = Field(None, description="WebSocket URL for streaming response")
    file_processing_status: Optional[Dict[int, str]] = Field(
        None, 
        description="Status of file processing by file_id"
    )
    processing_errors: Optional[List[str]] = Field(
        None,
        description="Any file processing errors"
    )
    quota_usage: Optional[Dict[str, Any]] = Field(
        None,
        description="User's quota usage after this message"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "conversation_id": 456,
                "message_id": 789,
                "user_message": {
                    "id": 789,
                    "conversation_id": 456,
                    "role": "user",
                    "content": "Please analyze this sales data.",
                    "file_attachments": [
                        {
                            "file_id": 123,
                            "filename": "sales_data.csv",
                            "processing_status": "ready"
                        }
                    ],
                    "has_files": True,
                    "total_files": 1,
                    "created_at": "2025-06-18T10:30:00Z"
                },
                "is_streaming": True,
                "stream_url": "/api/chat/stream/456",
                "file_processing_status": {
                    "123": "ready"
                },
                "processing_errors": None
            }
        }


# =============================================================================
# FILE CONTENT PREPARATION SCHEMAS
# =============================================================================

class FileContentPreparation(BaseModel):
    """
    Schema for preparing file content for LLM consumption.
    
    🎓 LEARNING: AI Context Building
    ==============================
    Before sending to AI, we need to:
    - Format content clearly for AI understanding
    - Add context about file type and structure
    - Truncate if too long but preserve important info
    - Create meaningful prompts for AI analysis
    """
    processed_files: List[ProcessedFileContent] = Field(
        ...,
        description="List of processed file contents"
    )
    combined_context: str = Field(
        ...,
        description="All file contents formatted for AI consumption"
    )
    context_length: int = Field(
        ...,
        description="Total character count of AI context"
    )
    files_included: int = Field(
        ...,
        description="Number of files included in context"
    )
    files_truncated: int = Field(
        default=0,
        description="Number of files that were truncated"
    )
    warnings: Optional[List[str]] = Field(
        default=None,
        description="Any warnings about file processing"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "processed_files": [
                    {
                        "file_id": 123,
                        "filename": "data.csv", 
                        "content_type": "structured_data",
                        "processed_content": "CSV with sales data...",
                        "content_length": 1500,
                        "is_truncated": False
                    }
                ],
                "combined_context": "User has attached 1 file:\n\nFile: data.csv (CSV)\n---\nCSV with sales data...\n---\n\nPlease analyze this data and respond to the user's question.",
                "context_length": 1750,
                "files_included": 1,
                "files_truncated": 0,
                "warnings": None
            }
        }


# =============================================================================
# CONVERSATION LISTING WITH FILE INFO
# =============================================================================

class ChatConversationSummary(BaseModel):
    """
    Conversation summary with file attachment information.
    
    🎓 LEARNING: Enhanced List Views
    ==============================
    When showing conversation lists, include file info:
    - Users can see which conversations have files
    - Better organization and search
    - Preview capabilities
    """
    id: int = Field(..., description="Conversation ID")
    title: str = Field(..., description="Conversation title")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    message_count: int = Field(..., description="Total number of messages")
    last_message_at: Optional[datetime] = Field(None, description="Last message timestamp")
    model_used: Optional[str] = Field(None, description="Primary model used")
    has_files: bool = Field(default=False, description="Whether conversation contains file attachments")
    total_files: int = Field(default=0, description="Total number of files in conversation")
    file_types: Optional[List[str]] = Field(None, description="Types of files in conversation")
    last_message_preview: Optional[str] = Field(None, description="Preview of last message")
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        schema_extra = {
            "example": {
                "id": 456,
                "title": "Sales Data Analysis",
                "created_at": "2025-06-18T10:00:00Z",
                "updated_at": "2025-06-18T10:30:00Z",
                "message_count": 4,
                "last_message_at": "2025-06-18T10:30:00Z",
                "model_used": "gpt-4",
                "has_files": True,
                "total_files": 2,
                "file_types": ["text/csv", "text/plain"],
                "last_message_preview": "Based on the sales data analysis..."
            }
        }


# =============================================================================
# ERROR SCHEMAS
# =============================================================================

class ChatError(BaseModel):
    """
    Error response schema for chat operations.
    
    🎓 LEARNING: Detailed Error Handling
    ===================================
    Chat errors can be complex because they involve:
    - Message validation errors
    - File processing errors  
    - LLM service errors
    - Quota/permission errors
    
    Provide enough detail for proper error handling.
    """
    error_type: str = Field(..., description="Type of error")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    failed_files: Optional[List[Dict[str, str]]] = Field(
        None,
        description="Files that failed to process"
    )
    conversation_id: Optional[int] = Field(None, description="Related conversation ID")
    retry_possible: bool = Field(default=False, description="Whether operation can be retried")
    suggestions: Optional[List[str]] = Field(
        None,
        description="Suggestions for resolving the error"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "error_type": "file_processing_failed",
                "message": "One or more files could not be processed for AI consumption",
                "details": {
                    "total_files": 2,
                    "failed_files": 1,
                    "processing_time_ms": 1500
                },
                "failed_files": [
                    {
                        "file_id": "124",
                        "filename": "corrupted.txt",
                        "error": "Invalid UTF-8 encoding"
                    }
                ],
                "conversation_id": 456,
                "retry_possible": True,
                "suggestions": [
                    "Check file encoding and ensure it's UTF-8",
                    "Try uploading the file again",
                    "Contact support if the problem persists"
                ]
            }
        }


# =============================================================================
# UTILITY SCHEMAS
# =============================================================================

class ChatSystemStatus(BaseModel):
    """
    System status for chat functionality.
    """
    chat_available: bool = Field(..., description="Whether chat is available")
    file_upload_available: bool = Field(..., description="Whether file upload is available")
    file_processing_available: bool = Field(..., description="Whether file processing is available")
    supported_file_types: List[str] = Field(..., description="Currently supported file types")
    max_files_per_message: int = Field(..., description="Maximum files per message")
    max_file_size_bytes: int = Field(..., description="Maximum file size in bytes")
    max_content_length: int = Field(..., description="Maximum content length for LLM")
    active_conversations: Optional[int] = Field(None, description="Number of active conversations")
    
    class Config:
        schema_extra = {
            "example": {
                "chat_available": True,
                "file_upload_available": True,
                "file_processing_available": True,
                "supported_file_types": ["text/plain", "text/csv", "application/json", "text/markdown"],
                "max_files_per_message": 10,
                "max_file_size_bytes": 10485760,
                "max_content_length": 50000,
                "active_conversations": 45
            }
        }
