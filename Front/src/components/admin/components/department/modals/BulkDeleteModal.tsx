// 🗂️ Bulk Delete Modal Component
// Confirmation dialog for bulk department deletion

import React, { useState } from 'react';

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  selectedCount: number;
}

export const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedCount
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleteError(null);
    setIsDeleting(true);
    
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete departments.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setDeleteError(null);
    onClose();
  };

  if (!isOpen || selectedCount === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Bulk Delete ({selectedCount} departments)
          </h3>
          
          <p className="text-gray-600 mb-4">
            Are you sure you want to delete {selectedCount} department{selectedCount > 1 ? 's' : ''}? 
            This action cannot be undone.
          </p>
          
          {deleteError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600 mb-4">
              {deleteError}
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-60"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : `Delete ${selectedCount} Department${selectedCount > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
