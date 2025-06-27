// 🎯 Quota Reference Data Hook
// Manages departments and LLM config data for filters and forms

import { useState, useEffect, useCallback } from 'react';
import { quotaService } from '../../services/quotaService';
import { DepartmentOption, LLMConfigOption } from '../../types/quota';

// =============================================================================
// INTERFACES
// =============================================================================

interface UseQuotaReferenceDataReturn {
  // Data
  departments: DepartmentOption[];
  llmConfigs: LLMConfigOption[];
  
  // Loading State
  loading: boolean;
  error: string | null;
  
  // Actions
  loadReferenceData: () => Promise<void>;
  getDepartmentName: (id: number) => string;
  getLLMConfigName: (id: number) => string;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export const useQuotaReferenceData = (): UseQuotaReferenceDataReturn => {
  // =============================================================================
  // STATE
  // =============================================================================

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [llmConfigs, setLLMConfigs] = useState<LLMConfigOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // =============================================================================
  // ACTIONS
  // =============================================================================

  /**
   * Load reference data for filter dropdowns
   * 
   * Learning: Loading reference data separately prevents blocking
   * the main UI if one data source is slow or fails.
   */
  const loadReferenceData = useCallback(async () => {
    try {
      console.log('📚 Loading reference data for filters...');
      setLoading(true);
      setError(null);

      // Load departments and LLM configs in parallel
      const [deptData, llmData] = await Promise.all([
        quotaService.getDepartments(),
        quotaService.getLLMConfigs(),
      ]);

      setDepartments(deptData);
      setLLMConfigs(llmData);
      setLoading(false);

      console.log('✅ Reference data loaded:', deptData.length, 'departments,', llmData.length, 'LLM configs');

    } catch (error) {
      console.error('❌ Error loading reference data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load reference data');
      setLoading(false);
      // Don't throw error - the table can still work without reference data
    }
  }, []);

  /**
   * Get department name by ID
   */
  const getDepartmentName = useCallback((id: number): string => {
    const department = departments.find(d => d.id === id);
    return department?.name || `Department ${id}`;
  }, [departments]);

  /**
   * Get LLM config name by ID
   */
  const getLLMConfigName = useCallback((id: number): string => {
    const config = llmConfigs.find(c => c.id === id);
    return config?.name || `Config ${id}`;
  }, [llmConfigs]);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Load reference data on mount
  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  // =============================================================================
  // RETURN
  // =============================================================================

  return {
    // Data
    departments,
    llmConfigs,
    
    // Loading State
    loading,
    error,
    
    // Actions
    loadReferenceData,
    getDepartmentName,
    getLLMConfigName,
  };
};