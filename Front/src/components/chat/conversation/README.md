# AI Dock Conversation Components

## 📦 Components Overview

This directory contains modular, reusable React components for conversation management in the AI Dock application.

### 🧩 Components

#### **ConversationItem.tsx**
Individual conversation display component with:
- Inline title editing with keyboard shortcuts (Enter/Escape)
- Delete confirmation with overlay
- Professional metadata display (messages, dates, models)
- Mobile-responsive design with touch optimization
- Current conversation highlighting

#### **ConversationList.tsx**
Advanced conversation list component featuring:
- Real-time search with instant filtering
- Advanced filtering (model, date range, message count)
- Flexible sorting (date, title, message count)
- Pagination and load-more functionality
- Empty states and loading indicators
- Configurable features (search/filters can be disabled)

#### **SaveConversationModal.tsx**
Professional save/rename dialog with:
- Dual mode: Save new conversations or rename existing ones
- Auto-generated conversation titles from message content
- Form validation with character limits
- Keyboard accessibility (Enter to save, Escape to cancel)
- Loading states and error handling
- Mobile-friendly responsive design

### 🎯 Usage Examples

```tsx
// Basic conversation list
<ConversationList
  conversations={conversations}
  currentConversationId={currentId}
  onSelectConversation={handleSelect}
  onEditConversation={handleEdit}
  onDeleteConversation={handleDelete}
  enableSearch={true}
  enableFilters={true}
/>

// Individual conversation item
<ConversationItem
  conversation={conversation}
  isCurrentConversation={isSelected}
  onSelect={handleSelect}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>

// Save conversation modal
<SaveConversationModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onSave={handleSave}
  messages={chatMessages}
  mode="save" // or "rename"
/>
```

### 🔧 Integration

These components are designed to work seamlessly with:
- **Backend Services**: `/services/conversationService.ts`
- **TypeScript Types**: `/types/conversation.ts`
- **Existing UI**: Blue glassmorphism theme matching AI Dock design
- **Mobile Support**: Touch-optimized with responsive breakpoints

### 🎨 Design System

All components follow the AI Dock design system:
- **Colors**: Blue glassmorphism theme with white/95 transparency
- **Typography**: Professional hierarchy with proper spacing
- **Animations**: Smooth transitions and hover effects
- **Accessibility**: Keyboard navigation and screen reader support
- **Mobile-First**: Responsive design with touch optimization

### 🧪 Testing

Use the `ConversationExample.tsx` component to test all functionality:
```bash
# Import in your app to see components in action
import { ConversationExample } from './conversation/ConversationExample';
```

### 📚 Learning Achievements

Building these components teaches:
- **Component Composition**: Breaking large features into reusable pieces
- **Props Drilling**: Passing data and callbacks between components
- **State Management**: Managing complex UI state effectively
- **Modal Patterns**: Professional dialog design and accessibility
- **Advanced Filtering**: Search, sort, and filter implementation
- **TypeScript Integration**: Strong typing for component interfaces
- **Responsive Design**: Mobile-first development principles

---

**Created**: June 16, 2025  
**Part of**: AI Dock Conversation Save/Load Feature (Step 6)  
**Next**: Integration & Auto-save functionality (Step 7)
