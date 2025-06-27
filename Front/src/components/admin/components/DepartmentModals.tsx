// 🔧 Refactored Department Modals Component
// Clean container component using modular atomic components

import React from 'react';
import { 
  DepartmentCreate, 
  DepartmentUpdate,
  Department,
  DepartmentWithStats
} from '../../../services/departmentService';

import {
  DepartmentDetailsModal,
  DepartmentFormModal,
  DeleteConfirmationModal,
  BulkDeleteModal
} from './department';

interface DepartmentModalsProps {
  state: {
    showCreateModal: boolean;
    showEditModal: boolean;
    showDeleteModal: boolean;
    showBulkDeleteModal: boolean;
    showDetailsModal: boolean;
    editingDepartment: Department | null;
    deletingDepartment: Department | null;
    viewingDepartment: Department | null;
    selectedDepartments: number[];
    departments: DepartmentWithStats[];
  };
  onCloseModals: () => void;
  onCreateDepartment: (data: DepartmentCreate) => Promise<void>;
  onUpdateDepartment: (id: number, data: DepartmentUpdate) => Promise<void>;
  onDeleteDepartment: (id: number) => Promise<void>;
  onBulkDelete: () => Promise<void>;
}

const DepartmentModals: React.FC<DepartmentModalsProps> = ({
  state,
  onCloseModals,
  onCreateDepartment,
  onUpdateDepartment,
  onDeleteDepartment,
  onBulkDelete
}) => {
  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================
  
  const handleCreateSubmit = async (data: DepartmentCreate) => {
    await onCreateDepartment(data);
  };

  const handleEditSubmit = async (data: DepartmentUpdate) => {
    if (!state.editingDepartment) return;
    await onUpdateDepartment(state.editingDepartment.id, data);
  };

  const handleDeleteConfirm = async () => {
    if (!state.deletingDepartment) return;
    await onDeleteDepartment(state.deletingDepartment.id);
  };

  const handleBulkDeleteConfirm = async () => {
    await onBulkDelete();
  };

  // =============================================================================
  // RENDER MODALS
  // =============================================================================

  return (
    <>
      {/* Department Details Modal */}
      <DepartmentDetailsModal
        isOpen={state.showDetailsModal}
        onClose={onCloseModals}
        department={state.viewingDepartment}
      />

      {/* Create Department Modal */}
      <DepartmentFormModal
        isOpen={state.showCreateModal}
        onClose={onCloseModals}
        onSubmit={handleCreateSubmit}
        title="Create Department"
        submitButtonText="Create"
      />

      {/* Edit Department Modal */}
      <DepartmentFormModal
        isOpen={state.showEditModal}
        onClose={onCloseModals}
        onSubmit={handleEditSubmit}
        editingDepartment={state.editingDepartment}
        title={`Edit Department: ${state.editingDepartment?.name || ''}`}
        submitButtonText="Save Changes"
      />

      {/* Delete Department Modal */}
      <DeleteConfirmationModal
        isOpen={state.showDeleteModal}
        onClose={onCloseModals}
        onConfirm={handleDeleteConfirm}
        department={state.deletingDepartment}
      />

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={state.showBulkDeleteModal}
        onClose={onCloseModals}
        onConfirm={handleBulkDeleteConfirm}
        selectedCount={state.selectedDepartments.length}
      />
    </>
  );
};

export default DepartmentModals;
