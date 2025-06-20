// AI Dock Conversation Components Usage Example
// Demonstrates how to use the new conversation UI components

import React, { useState } from 'react';
import { 
  ConversationList, 
  SaveConversationModal,
  ConversationSummary 
} from './index';
import { ChatMessage } from '../../../types/chat';

/**
 * Example usage of the new conversation components
 * This shows how to integrate them into your application
 */
export const ConversationExample: React.FC = () => {
  // Example state
  const [conversations, setConversations] = useState<ConversationSummary[]>([
    {
      id: 1,
      title: "Getting Started with AI",
      created_at: "2025-06-16T10:00:00Z",
      updated_at: "2025-06-16T11:30:00Z",
      message_count: 8,
      model_used: "gpt-4-turbo",
      last_message_at: "2025-06-16T11:30:00Z"
    },
    {
      id: 2,
      title: "Code Review Discussion",
      created_at: "2025-06-15T14:00:00Z",
      updated_at: "2025-06-15T15:45:00Z",
      message_count: 12,
      model_used: "claude-3-sonnet",
      last_message_at: "2025-06-15T15:45:00Z"
    }
  ]);
  
  const [currentConversationId, setCurrentConversationId] = useState<number | undefined>(1);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Example chat messages for saving
  const exampleMessages: ChatMessage[] = [
    { role: 'user', content: 'Hello, can you help me with React components?' },
    { role: 'assistant', content: 'Of course! I\'d be happy to help you with React components. What specific aspect would you like to learn about?' },
    { role: 'user', content: 'How do I create reusable components?' },
    { role: 'assistant', content: 'Great question! Creating reusable components involves several key principles...' }
  ];
  
  // Event handlers
  const handleSelectConversation = (conversationId: number) => {
    setCurrentConversationId(conversationId);
    console.log('Selected conversation:', conversationId);
  };
  
  const handleEditConversation = async (conversationId: number, newTitle: string) => {
    console.log('Editing conversation:', conversationId, 'New title:', newTitle);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update local state
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, title: newTitle, updated_at: new Date().toISOString() }
        : conv
    ));
  };
  
  const handleDeleteConversation = async (conversationId: number) => {
    console.log('Deleting conversation:', conversationId);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Update local state
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    
    // Clear selection if deleted conversation was selected
    if (currentConversationId === conversationId) {
      setCurrentConversationId(undefined);
    }
  };
  
  const handleSaveConversation = async (title: string, autoGenerate?: boolean) => {
    console.log('Saving conversation:', { title, autoGenerate });
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Create new conversation
    const newConversation: ConversationSummary = {
      id: Date.now(), // Simple ID generation
      title: title || 'New Conversation',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: exampleMessages.length,
      model_used: 'gpt-4-turbo',
      last_message_at: new Date().toISOString()
    };
    
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
    setShowSaveModal(false);
  };
  
  const handleRefresh = () => {
    setIsLoading(true);
    console.log('Refreshing conversations...');
    
    // Simulate refresh
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };
  
  return (
    <div className="h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-teal-600 p-4">
      <div className="h-full max-w-4xl mx-auto bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
        <div className="h-full flex">
          {/* Conversation List */}
          <div className="w-80 border-r border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h1 className="text-xl font-semibold text-gray-800">
                Conversation Components Demo
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Showcasing the new conversation UI components
              </p>
            </div>
            
            <ConversationList
              conversations={conversations}
              currentConversationId={currentConversationId}
              isLoading={isLoading}
              onSelectConversation={handleSelectConversation}
              onEditConversation={handleEditConversation}
              onDeleteConversation={handleDeleteConversation}
              onRefresh={handleRefresh}
              enableSearch={true}
              enableFilters={true}
              className="h-full"
            />
          </div>
          
          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    Component Features
                  </h2>
                  <p className="text-gray-600">
                    Professional conversation management UI
                  </p>
                </div>
                
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save New Conversation
                </button>
              </div>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-medium text-green-800 mb-2">✅ Completed Components:</h3>
                  <ul className="space-y-1 text-green-700 text-sm">
                    <li>• <strong>ConversationItem</strong> - Individual conversation display with edit/delete</li>
                    <li>• <strong>ConversationList</strong> - Advanced list with search, filtering, and sorting</li>
                    <li>• <strong>SaveConversationModal</strong> - Professional save/rename dialog</li>
                    <li>• <strong>ConversationSidebar</strong> - Complete sidebar integration (existing)</li>
                  </ul>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-800 mb-2">🚀 Key Features:</h3>
                  <ul className="space-y-1 text-blue-700 text-sm">
                    <li>• Real-time search and advanced filtering</li>
                    <li>• Inline editing with keyboard shortcuts</li>
                    <li>• Professional delete confirmations</li>
                    <li>• Auto-generated conversation titles</li>
                    <li>• Mobile-responsive design</li>
                    <li>• Accessibility support</li>
                    <li>• TypeScript integration</li>
                    <li>• Modular component architecture</li>
                  </ul>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-medium text-yellow-800 mb-2">🎯 Learning Achieved:</h3>
                  <ul className="space-y-1 text-yellow-700 text-sm">
                    <li>• Component composition and reusability</li>
                    <li>• Props drilling and callback patterns</li>
                    <li>• Modal design and accessibility</li>
                    <li>• Advanced state management</li>
                    <li>• Professional UI/UX patterns</li>
                    <li>• TypeScript interface design</li>
                  </ul>
                </div>
                
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-medium text-purple-800 mb-2">💡 Next Steps:</h3>
                  <ul className="space-y-1 text-purple-700 text-sm">
                    <li>• Integrate components into main ChatInterface</li>
                    <li>• Add conversation auto-save functionality</li>
                    <li>• Implement conversation import/export</li>
                    <li>• Add conversation sharing features</li>
                    <li>• Create conversation analytics</li>
                  </ul>
                </div>
              </div>
              
              {currentConversationId && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700">
                    <strong>Selected Conversation:</strong> {
                      conversations.find(c => c.id === currentConversationId)?.title
                    }
                  </p>
                  <p className="text-gray-600 text-sm mt-1">
                    In a real app, this would load the conversation messages and show the chat interface.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Save Conversation Modal */}
      <SaveConversationModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveConversation}
        messages={exampleMessages}
        mode="save"
      />
    </div>
  );
};

// 🎯 How to Use These Components in Your App:
//
// 1. **ConversationList** - For displaying conversation lists:
//    ```tsx
//    <ConversationList
//      conversations={conversations}
//      currentConversationId={currentId}
//      onSelectConversation={handleSelect}
//      onEditConversation={handleEdit}
//      onDeleteConversation={handleDelete}
//      enableSearch={true}
//      enableFilters={true}
//    />
//    ```
//
// 2. **ConversationItem** - For individual conversation display:
//    ```tsx
//    <ConversationItem
//      conversation={conv}
//      isCurrentConversation={conv.id === currentId}
//      onSelect={handleSelect}
//      onEdit={handleEdit}
//      onDelete={handleDelete}
//    />
//    ```
//
// 3. **SaveConversationModal** - For saving conversations:
//    ```tsx
//    <SaveConversationModal
//      isOpen={showModal}
//      onClose={() => setShowModal(false)}
//      onSave={handleSave}
//      messages={chatMessages}
//      mode="save"
//    />
//    ```
//
// These components are designed to be:
// - Modular and reusable
// - TypeScript-safe
// - Accessible and responsive
// - Easy to integrate
// - Professional and polished
