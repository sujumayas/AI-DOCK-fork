// 📦 Chat Services Index
// Clean exports for all modular chat services

// Main orchestrator service (backward compatible)
export { chatService, ChatService } from './chatService';

// Individual modular services (for direct access)
export { coreChatService, CoreChatService } from './core';
export { streamingChatService, StreamingChatService } from './streaming';
export { configurationService, ConfigurationService } from './configuration';
export { costService, CostService } from './cost';
export { healthService, HealthService } from './health';
export { modelsService, ModelsService } from './models';
export { modelHelpers, ModelHelpers } from './modelHelpers';

// Error utilities
export { getErrorType, createChatServiceError, logChatError } from './errors';

// Type exports for modular services
export type { SmartProcessedModelsData, UnifiedModelInfo } from './models';

// 🎯 Usage Examples:
//
// **Backward Compatible (recommended for existing code):**
// ```typescript
// import { chatService } from '@/services/chat';
// const response = await chatService.sendMessage(request);
// ```
//
// **Direct Service Access (for new code):**
// ```typescript
// import { streamingChatService, modelsService } from '@/services/chat';
// const connection = await streamingChatService.streamMessage(...);
// const models = await modelsService.getSmartModels(configId);
// ```
//
// **Individual Imports:**
// ```typescript
// import { coreChatService } from '@/services/chat/core';
// import { modelHelpers } from '@/services/chat/modelHelpers';
// ```
