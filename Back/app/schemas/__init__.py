"""
Pydantic schemas for data validation.

This package contains all the data models that define:
- What data our API endpoints expect (requests)
- What data our API endpoints return (responses)
- Validation rules for all data

Think of schemas as "contracts" between frontend and backend.
"""

# Import all schemas for easy access
from .auth import *
from .admin import *
from .llm_config import (
    LLMProviderSchema,
    LLMConfigurationCreate,
    LLMConfigurationUpdate,
    LLMConfigurationResponse,
    LLMConfigurationSummary,
    LLMConfigurationTest,
    LLMConfigurationTestResult,
    LLMProviderInfo,
    get_provider_info_list
)
from .quota import (
    QuotaCreateRequest,
    QuotaUpdateRequest,
    QuotaFilterRequest,
    QuotaResponse,
    QuotaListResponse,
    DepartmentQuotaStatusResponse,
    QuotaResetResponse,
    BulkQuotaOperationResponse,
    QuotaErrorResponse,
    ValidationErrorResponse,
    convert_quota_to_response
)
from .department import (
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentResponse,
    DepartmentWithStats,
    DepartmentListResponse,
    DepartmentSearchFilters,
    DepartmentBudgetUpdate,
    DepartmentBulkAction,
    DepartmentDropdownOption,
    DepartmentHierarchy,
    DepartmentOperationResponse,
    DepartmentInitializationResponse
)
from .conversation import (
    ConversationMessageCreate,
    ConversationMessageResponse,
    ConversationCreate,
    ConversationUpdate,
    ConversationSummary,
    ConversationDetail,
    ConversationSaveFromMessages,
    ConversationListResponse,
    ConversationStatsResponse,
    ConversationOperationResponse
)
from .file_upload import (
    FileUploadStatus,
    AllowedFileType,
    FileUploadValidation,
    FileUploadResponse,
    FileMetadata,
    FileListResponse,
    FileSearchRequest,
    FileDeleteRequest,
    FileDeleteResponse,
    FileStatistics,
    FileUploadError,
    UploadLimits,
    FileHealthCheck
)
from .chat import (
    FileProcessingStatus,
    ContentType,
    FileAttachment,
    ProcessedFileContent,
    ChatMessageWithFiles,
    ChatMessageResponse,
    ChatSendRequest,
    ChatSendResponse,
    FileContentPreparation,
    ChatConversationSummary,
    ChatError,
    ChatSystemStatus
)
from .assistant import (
    AssistantStatus,
    ModelProvider,
    AssistantCreate,
    AssistantUpdate,
    AssistantResponse,
    AssistantSummary,
    AssistantConversationCreate,
    AssistantConversationResponse,
    AssistantListRequest,
    AssistantListResponse,
    AssistantOperationResponse,
    AssistantStatsResponse,
    AssistantErrorResponse,
    AssistantPermissionError,
    AssistantBulkAction,
    AssistantBulkResponse,
    AssistantExport,
    AssistantImport,
    create_assistant_response_from_model,
    validate_assistant_ownership
)
from .role import (
    RoleDropdownOption,
    RoleResponse,
    RoleCreateRequest,
    RoleUpdateRequest,
    RoleListResponse
)

__all__ = [
    # Auth schemas
    "UserLogin",
    "UserResponse", 
    "Token",
    "TokenResponse",
    
    # Admin schemas
    "UserCreateRequest",
    "UserUpdateRequest",
    "UserStatsResponse",
    "RoleResponse",
    "DepartmentResponse",
    
    # LLM Configuration schemas
    "LLMProviderSchema",
    "LLMConfigurationCreate",
    "LLMConfigurationUpdate",
    "LLMConfigurationResponse",
    "LLMConfigurationSummary",
    "LLMConfigurationTest",
    "LLMConfigurationTestResult",
    "LLMProviderInfo",
    "get_provider_info_list",
    
    # Quota schemas
    "QuotaCreateRequest",
    "QuotaUpdateRequest",
    "QuotaFilterRequest",
    "QuotaResponse",
    "QuotaListResponse",
    "DepartmentQuotaStatusResponse",
    "QuotaResetResponse",
    "BulkQuotaOperationResponse",
    "QuotaErrorResponse",
    "ValidationErrorResponse",
    "convert_quota_to_response",
    
    # Department schemas
    "DepartmentCreate",
    "DepartmentUpdate",
    "DepartmentResponse",
    "DepartmentWithStats",
    "DepartmentListResponse",
    "DepartmentSearchFilters",
    "DepartmentBudgetUpdate",
    "DepartmentBulkAction",
    "DepartmentDropdownOption",
    "DepartmentHierarchy",
    "DepartmentOperationResponse",
    "DepartmentInitializationResponse",
    
    # Conversation schemas
    "ConversationMessageCreate",
    "ConversationMessageResponse",
    "ConversationCreate",
    "ConversationUpdate",
    "ConversationSummary",
    "ConversationDetail",
    "ConversationSaveFromMessages",
    "ConversationListResponse",
    "ConversationStatsResponse",
    "ConversationOperationResponse",
    
    # File upload schemas
    "FileUploadStatus",
    "AllowedFileType",
    "FileUploadValidation",
    "FileUploadResponse",
    "FileMetadata",
    "FileListResponse",
    "FileSearchRequest",
    "FileDeleteRequest",
    "FileDeleteResponse",
    "FileStatistics",
    "FileUploadError",
    "UploadLimits",
    "FileHealthCheck",
    
    # Chat schemas with file support
    "FileProcessingStatus",
    "ContentType",
    "FileAttachment",
    "ProcessedFileContent",
    "ChatMessageWithFiles",
    "ChatMessageResponse",
    "ChatSendRequest",
    "ChatSendResponse",
    "FileContentPreparation",
    "ChatConversationSummary",
    "ChatError",
    "ChatSystemStatus",
    
    # Assistant schemas
    "AssistantStatus",
    "ModelProvider",
    "AssistantCreate",
    "AssistantUpdate",
    "AssistantResponse",
    "AssistantSummary",
    "AssistantConversationCreate",
    "AssistantConversationResponse",
    "AssistantListRequest",
    "AssistantListResponse",
    "AssistantOperationResponse",
    "AssistantStatsResponse",
    "AssistantErrorResponse",
    "AssistantPermissionError",
    "AssistantBulkAction",
    "AssistantBulkResponse",
    "AssistantExport",
    "AssistantImport",
    "create_assistant_response_from_model",
    "validate_assistant_ownership",
    
    # Role schemas
    "RoleDropdownOption",
    "RoleResponse",
    "RoleCreateRequest",
    "RoleUpdateRequest",
    "RoleListResponse",
]
