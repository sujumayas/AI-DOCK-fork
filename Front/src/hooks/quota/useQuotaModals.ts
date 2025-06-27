// 🎯 Quota Modal State Management Hook
// Manages create and edit modal states and operations

import { useState, useCallback } from 'react';
import { QuotaResponse } from '../../types/quota';

// =============================================================================
// INTERFACES
// =============================================================================

interface UseQuotaModalsReturn {
  // Create Modal State
  showCreateModal: boolean;
  
  // Edit Modal State
  showEditModal: boolean;
  quotaToEdit: QuotaResponse | null;
  
  // Actions
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openEditModal: (quota: QuotaResponse) => void;
  closeEditModal: () => void;
  
  // Success Handlers
  handleQuotaCreated: (newQuota: QuotaResponse, onSuccess?: (quota: QuotaResponse) => void) => void;
  handleQuotaUpdated: (updatedQuota: QuotaResponse, onSuccess?: (quota: QuotaResponse) => void) => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export const useQuotaModals = (): UseQuotaModalsReturn => {
  // =============================================================================
  // STATE
  // =============================================================================

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [quotaToEdit, setQuotaToEdit] = useState<QuotaResponse | null>(null);

  // =============================================================================
  // CREATE MODAL ACTIONS
  // =============================================================================

  /**
   * Open the create quota modal
   */
  const openCreateModal = useCallback(() => {
    console.log('🎯 Opening quota creation modal...');
    setShowCreateModal(true);
  }, []);

  /**
   * Close the create quota modal
   */
  const closeCreateModal = useCallback(() => {
    console.log('❌ Closing quota creation modal');
    setShowCreateModal(false);
  }, []);

  // =============================================================================
  // EDIT MODAL ACTIONS
  // =============================================================================

  /**
   * Open the edit quota modal
   */
  const openEditModal = useCallback((quota: QuotaResponse) => {
    console.log('✏️ Opening quota edit modal for:', quota.name);
    setQuotaToEdit(quota);
    setShowEditModal(true);
  }, []);

  /**
   * Close the edit quota modal
   */
  const closeEditModal = useCallback(() => {
    console.log('❌ Closing quota edit modal');
    setShowEditModal(false);
    setQuotaToEdit(null);
  }, []);

  // =============================================================================
  // SUCCESS HANDLERS
  // =============================================================================

  /**
   * Handle successful quota creation
   */
  const handleQuotaCreated = useCallback((
    newQuota: QuotaResponse, 
    onSuccess?: (quota: QuotaResponse) => void
  ) => {
    console.log('✅ Quota created successfully:', newQuota.name);
    
    // Close the create modal
    setShowCreateModal(false);
    
    // Show success message
    alert(`✅ Quota "${newQuota.name}" created successfully!`);
    
    // Call optional success callback
    onSuccess?.(newQuota);
  }, []);

  /**
   * Handle successful quota update
   */
  const handleQuotaUpdated = useCallback((
    updatedQuota: QuotaResponse,
    onSuccess?: (quota: QuotaResponse) => void
  ) => {
    console.log('✅ Quota updated successfully:', updatedQuota.name);
    
    // Close the edit modal
    setShowEditModal(false);
    setQuotaToEdit(null);
    
    // Show success message
    alert(`✅ Quota "${updatedQuota.name}" updated successfully!`);
    
    // Call optional success callback
    onSuccess?.(updatedQuota);
  }, []);

  // =============================================================================
  // RETURN
  // =============================================================================

  return {
    // State
    showCreateModal,
    showEditModal,
    quotaToEdit,
    
    // Actions
    openCreateModal,
    closeCreateModal,
    openEditModal,
    closeEditModal,
    
    // Success Handlers
    handleQuotaCreated,
    handleQuotaUpdated,
  };
};