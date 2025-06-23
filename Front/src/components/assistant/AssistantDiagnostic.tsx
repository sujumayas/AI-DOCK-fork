// 🔧 Assistant Diagnostic Component
// This component helps debug assistant save issues

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface DiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'warning' | 'loading';
  message: string;
  details?: string;
}

export const AssistantDiagnostic: React.FC = () => {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);

    const tests: DiagnosticResult[] = [];

    // Test 1: Backend Health Check
    tests.push({ test: 'Backend Health', status: 'loading', message: 'Checking backend connection...' });
    setResults([...tests]);

    try {
      const response = await fetch('http://localhost:8000/health');
      if (response.ok) {
        const data = await response.json();
        tests[tests.length - 1] = {
          test: 'Backend Health',
          status: 'success',
          message: 'Backend is running',
          details: `Version: ${data.version}, Environment: ${data.environment}`
        };
      } else {
        tests[tests.length - 1] = {
          test: 'Backend Health',
          status: 'error',
          message: `Backend responded with ${response.status}`,
          details: 'Check server logs for errors'
        };
      }
    } catch (error) {
      tests[tests.length - 1] = {
        test: 'Backend Health',
        status: 'error',
        message: 'Cannot connect to backend',
        details: 'Make sure backend server is running on port 8000'
      };
    }

    setResults([...tests]);

    // Test 2: Assistant API Health
    tests.push({ test: 'Assistant API', status: 'loading', message: 'Checking assistant endpoints...' });
    setResults([...tests]);

    try {
      const response = await fetch('http://localhost:8000/assistants/health');
      if (response.ok) {
        tests[tests.length - 1] = {
          test: 'Assistant API',
          status: 'success',
          message: 'Assistant endpoints are available',
          details: 'All CRUD operations should work'
        };
      } else {
        tests[tests.length - 1] = {
          test: 'Assistant API',
          status: 'error',
          message: `Assistant API error: ${response.status}`,
          details: 'Assistant endpoints may not be registered'
        };
      }
    } catch (error) {
      tests[tests.length - 1] = {
        test: 'Assistant API',
        status: 'error',
        message: 'Assistant API not accessible',
        details: 'Backend may be running but assistant routes not working'
      };
    }

    setResults([...tests]);

    // Test 3: Authentication Check
    tests.push({ test: 'Authentication', status: 'loading', message: 'Checking authentication status...' });
    setResults([...tests]);

    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Try to get current user
        const response = await fetch('http://localhost:8000/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const user = await response.json();
          tests[tests.length - 1] = {
            test: 'Authentication',
            status: 'success',
            message: 'User is authenticated',
            details: `Logged in as: ${user.email}`
          };
        } else if (response.status === 401) {
          tests[tests.length - 1] = {
            test: 'Authentication',
            status: 'warning',
            message: 'Token expired or invalid',
            details: 'Try logging out and logging back in'
          };
        } else {
          tests[tests.length - 1] = {
            test: 'Authentication',
            status: 'error',
            message: `Auth error: ${response.status}`,
            details: 'Authentication system may have issues'
          };
        }
      } else {
        tests[tests.length - 1] = {
          test: 'Authentication',
          status: 'warning',
          message: 'No authentication token found',
          details: 'User needs to log in'
        };
      }
    } catch (error) {
      tests[tests.length - 1] = {
        test: 'Authentication',
        status: 'error',
        message: 'Authentication check failed',
        details: 'Cannot verify login status'
      };
    }

    setResults([...tests]);

    // Test 4: Test Assistant Update Endpoint
    tests.push({ test: 'Update Endpoint', status: 'loading', message: 'Testing update endpoint...' });
    setResults([...tests]);

    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Try to get user's assistants first
        const listResponse = await fetch('http://localhost:8000/assistants/', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (listResponse.ok) {
          const data = await listResponse.json();
          if (data.assistants && data.assistants.length > 0) {
            tests[tests.length - 1] = {
              test: 'Update Endpoint',
              status: 'success',
              message: 'Update endpoint should work',
              details: `Found ${data.assistants.length} assistants to test with`
            };
          } else {
            tests[tests.length - 1] = {
              test: 'Update Endpoint',
              status: 'warning',
              message: 'No assistants found to test update',
              details: 'Create an assistant first to test save functionality'
            };
          }
        } else {
          tests[tests.length - 1] = {
            test: 'Update Endpoint',
            status: 'error',
            message: `Cannot list assistants: ${listResponse.status}`,
            details: 'Assistant list endpoint not working'
          };
        }
      } else {
        tests[tests.length - 1] = {
          test: 'Update Endpoint',
          status: 'warning',
          message: 'Cannot test - not authenticated',
          details: 'Login required to test update functionality'
        };
      }
    } catch (error) {
      tests[tests.length - 1] = {
        test: 'Update Endpoint',
        status: 'error',
        message: 'Update endpoint test failed',
        details: 'Network error or endpoint not available'
      };
    }

    setResults([...tests]);
    setIsRunning(false);
  };

  useEffect(() => {
    // Run diagnostics automatically when component mounts
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'loading':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'loading':
        return 'border-blue-200 bg-blue-50';
    }
  };

  const allSuccess = results.length > 0 && results.every(r => r.status === 'success');
  const hasErrors = results.some(r => r.status === 'error');

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Assistant Save Button Diagnostic
        </h2>
        <p className="text-gray-600">
          This tool helps diagnose why the Save Changes button might not be working.
        </p>
      </div>

      {/* Overall Status */}
      <div className={`mb-6 p-4 border rounded-lg ${
        allSuccess 
          ? 'border-green-200 bg-green-50' 
          : hasErrors 
          ? 'border-red-200 bg-red-50'
          : 'border-yellow-200 bg-yellow-50'
      }`}>
        <div className="flex items-center space-x-2">
          {allSuccess ? (
            <>
              <Wifi className="h-5 w-5 text-green-500" />
              <span className="font-medium text-green-800">All systems operational</span>
            </>
          ) : hasErrors ? (
            <>
              <WifiOff className="h-5 w-5 text-red-500" />
              <span className="font-medium text-red-800">Issues detected</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <span className="font-medium text-yellow-800">Warnings present</span>
            </>
          )}
        </div>
        
        {allSuccess && (
          <p className="text-sm text-green-700 mt-1">
            Your Save Changes button should work! If it's still disabled, check that you've made changes to the form.
          </p>
        )}
        
        {hasErrors && (
          <p className="text-sm text-red-700 mt-1">
            Critical issues found. The Save Changes button won't work until these are resolved.
          </p>
        )}
      </div>

      {/* Test Results */}
      <div className="space-y-4">
        {results.map((result, index) => (
          <div
            key={index}
            className={`p-4 border rounded-lg ${getStatusColor(result.status)}`}
          >
            <div className="flex items-start space-x-3">
              {getStatusIcon(result.status)}
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{result.test}</h3>
                <p className="text-sm text-gray-700 mt-1">{result.message}</p>
                {result.details && (
                  <p className="text-xs text-gray-600 mt-2">{result.details}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-6 flex space-x-3">
        <button
          onClick={runDiagnostics}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
          <span>{isRunning ? 'Running...' : 'Run Diagnostics'}</span>
        </button>

        {hasErrors && (
          <div className="text-sm text-gray-600 flex items-center space-x-2">
            <span>💡</span>
            <span>
              Most issues are resolved by starting the backend server.
            </span>
          </div>
        )}
      </div>

      {/* Instructions */}
      {hasErrors && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Quick Fix Instructions</h4>
          <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>Open a terminal</li>
            <li>Navigate to: <code className="bg-gray-200 px-1 rounded">/Users/blas/Desktop/INRE/INRE-DOCK-2/Back</code></li>
            <li>Run: <code className="bg-gray-200 px-1 rounded">./quick_start.sh</code></li>
            <li>Wait for "Application startup completed successfully!"</li>
            <li>Come back here and click "Run Diagnostics"</li>
          </ol>
        </div>
      )}
    </div>
  );
};
