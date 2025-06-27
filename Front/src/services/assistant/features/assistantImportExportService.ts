// Assistant Import/Export Service
// Handles data import and export operations for assistants

import {
  Assistant,
  AssistantCreate
} from '../../../types/assistant';
import { assistantCrudService } from '../core/assistantCrudService';
import { AssistantErrorHandler } from '../core/assistantErrorHandler';

/**
 * Assistant Import/Export Service
 * 
 * 🎓 LEARNING: Data Exchange Pattern
 * =================================
 * Import/Export service provides:
 * - Data serialization and deserialization
 * - File format handling
 * - Validation of import data
 * - Backup and restore capabilities
 * - Data migration support
 */

export class AssistantImportExportService {
  
  /**
   * Export assistant configuration to JSON blob
   */
  async exportAssistant(assistantId: number): Promise<Blob> {
    try {
      console.log('📤 Exporting assistant:', assistantId);
      
      const assistant = await assistantCrudService.getById(assistantId);
      
      // Create export data
      const exportData = {
        name: assistant.name,
        description: assistant.description,
        system_prompt: assistant.system_prompt,
        model_preferences: assistant.model_preferences,
        export_version: '1.0',
        exported_at: new Date().toISOString(),
        exported_by: 'AI Dock Assistant Service'
      };
      
      // Convert to JSON blob
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      console.log('✅ Assistant exported successfully');
      return blob;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'exportAssistant',
        error,
        'Failed to export assistant',
        assistantId
      );
    }
  }

  /**
   * Import assistant configuration from file
   */
  async importAssistant(file: File): Promise<Assistant> {
    try {
      console.log('📥 Importing assistant from file:', file.name);
      
      // Validate file type
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        throw new Error('Invalid file type. Please select a JSON file.');
      }
      
      // Validate file size (limit to 1MB)
      if (file.size > 1024 * 1024) {
        throw new Error('File too large. Maximum size is 1MB.');
      }
      
      // Read file content
      const content = await file.text();
      let importData;
      
      try {
        importData = JSON.parse(content);
      } catch (parseError) {
        throw new Error('Invalid JSON format. Please check your file.');
      }
      
      // Validate import data structure
      const validation = this.validateImportData(importData);
      if (!validation.valid) {
        throw new Error(`Invalid import file: ${validation.errors.join(', ')}`);
      }
      
      // Create assistant from import data
      const createData: AssistantCreate = {
        name: importData.name,
        description: importData.description,
        system_prompt: importData.system_prompt,
        model_preferences: importData.model_preferences
      };
      
      const assistant = await assistantCrudService.create(createData);
      
      console.log('✅ Assistant imported successfully:', assistant.id);
      return assistant;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'importAssistant',
        error,
        'Failed to import assistant',
        undefined,
        { fileName: file.name }
      );
    }
  }

  /**
   * Validate import data structure
   */
  private validateImportData(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!data.name || typeof data.name !== 'string') {
      errors.push('Missing or invalid name field');
    }

    if (!data.system_prompt || typeof data.system_prompt !== 'string') {
      errors.push('Missing or invalid system_prompt field');
    }

    // Check optional fields
    if (data.description !== undefined && typeof data.description !== 'string') {
      errors.push('Invalid description field (must be string)');
    }

    if (data.model_preferences !== undefined && typeof data.model_preferences !== 'object') {
      errors.push('Invalid model_preferences field (must be object)');
    }

    // Check export version compatibility
    if (data.export_version && typeof data.export_version === 'string') {
      const version = parseFloat(data.export_version);
      if (version > 1.0) {
        errors.push(`Unsupported export version: ${data.export_version}. Maximum supported version is 1.0`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Export multiple assistants to a single JSON file
   */
  async exportMultipleAssistants(assistantIds: number[]): Promise<Blob> {
    try {
      console.log('📤 Exporting multiple assistants:', assistantIds.length);
      
      const assistants = await Promise.all(
        assistantIds.map(id => assistantCrudService.getById(id))
      );
      
      const exportData = {
        assistants: assistants.map(assistant => ({
          name: assistant.name,
          description: assistant.description,
          system_prompt: assistant.system_prompt,
          model_preferences: assistant.model_preferences
        })),
        export_version: '1.0',
        exported_at: new Date().toISOString(),
        exported_by: 'AI Dock Assistant Service',
        count: assistants.length
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      console.log('✅ Multiple assistants exported successfully');
      return blob;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'exportMultipleAssistants',
        error,
        'Failed to export multiple assistants',
        undefined,
        { assistantIds }
      );
    }
  }

  /**
   * Import multiple assistants from a single file
   */
  async importMultipleAssistants(file: File): Promise<Assistant[]> {
    try {
      console.log('📥 Importing multiple assistants from file:', file.name);
      
      // Read and parse file
      const content = await file.text();
      const importData = JSON.parse(content);
      
      // Validate structure
      if (!importData.assistants || !Array.isArray(importData.assistants)) {
        throw new Error('Invalid multi-assistant file format. Missing assistants array.');
      }
      
      // Import each assistant
      const importedAssistants: Assistant[] = [];
      const errors: string[] = [];
      
      for (let i = 0; i < importData.assistants.length; i++) {
        try {
          const assistantData = importData.assistants[i];
          const validation = this.validateImportData(assistantData);
          
          if (!validation.valid) {
            errors.push(`Assistant ${i + 1}: ${validation.errors.join(', ')}`);
            continue;
          }
          
          const createData: AssistantCreate = {
            name: assistantData.name,
            description: assistantData.description,
            system_prompt: assistantData.system_prompt,
            model_preferences: assistantData.model_preferences
          };
          
          const assistant = await assistantCrudService.create(createData);
          importedAssistants.push(assistant);
          
        } catch (error) {
          errors.push(`Assistant ${i + 1}: ${error instanceof Error ? error.message : 'Import failed'}`);
        }
      }
      
      if (errors.length > 0) {
        console.warn('Some assistants failed to import:', errors);
      }
      
      console.log('✅ Multiple assistants imported:', importedAssistants.length, 'successful,', errors.length, 'failed');
      return importedAssistants;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'importMultipleAssistants',
        error,
        'Failed to import multiple assistants',
        undefined,
        { fileName: file.name }
      );
    }
  }

  /**
   * Generate filename for export
   */
  generateExportFilename(assistant?: Assistant): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    if (assistant) {
      const safeName = assistant.name.replace(/[^a-zA-Z0-9]/g, '_');
      return `assistant_${safeName}_${timestamp}.json`;
    }
    
    return `assistants_export_${timestamp}.json`;
  }

  /**
   * Download blob as file
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export and download assistant
   */
  async exportAndDownload(assistantId: number): Promise<void> {
    try {
      const assistant = await assistantCrudService.getById(assistantId);
      const blob = await this.exportAssistant(assistantId);
      const filename = this.generateExportFilename(assistant);
      
      this.downloadBlob(blob, filename);
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'exportAndDownload',
        error,
        'Failed to export and download assistant',
        assistantId
      );
    }
  }
}

// Export singleton instance
export const assistantImportExportService = new AssistantImportExportService();
