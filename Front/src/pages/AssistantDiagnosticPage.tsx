// 🔧 Assistant Diagnostic Test Page
// Temporary page to diagnose assistant save issues

import React from 'react';
import { AssistantDiagnostic } from '../components/assistant';
import { UnifiedTraversalButtons } from '../components/ui/UnifiedTraversalButtons';

const AssistantDiagnosticPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* Unified Traversal Buttons */}
      <UnifiedTraversalButtons variant="inline" size="md" />
      
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🔧 Assistant Save Button Diagnostic
          </h1>
          <p className="text-gray-600">
            This diagnostic tool will help identify why your Save Changes button isn't working.
            Run this test to check your backend connection, authentication, and API endpoints.
          </p>
        </div>
        
        <AssistantDiagnostic />
      </div>
    </div>
  );
};

export default AssistantDiagnosticPage;
