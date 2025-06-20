// 🧪 Comprehensive Markdown Test Cases for AID-MARKDOWN-C
// This file provides test cases for all markdown elements to verify rendering
// Use these in the chat interface to test markdown functionality

export const markdownTestCases = {
  // 📝 Basic Typography Tests
  basicElements: `# H1 Header with Professional Typography

## H2 Header for Sections  

### H3 Header for Subsections

#### H4 Header for Details

##### H5 Header for Small Details

###### H6 Header for Fine Print

This is a **paragraph** with enhanced spacing and *italic* text. The typography has been **professionally tuned** for *readability* and visual hierarchy.

This is another paragraph to test spacing between paragraphs.`,

  // 📋 List and Organization Tests
  lists: `## Professional List Styling

### Bulleted Lists:
- First item with enhanced spacing
- Second item with blue bullets
- Third item with proper indentation
  - Nested item level 1
  - Nested item level 2
    - Deep nested item
- Back to top level

### Numbered Lists:
1. First numbered item
2. Second numbered item with longer content to test wrapping
3. Third numbered item
   1. Nested numbered item
   2. Another nested item
4. Back to main sequence

### Mixed Content Lists:
1. **Bold item** with *italic* elements
2. Item with \`inline code\` elements
3. Item with [link](https://example.com) elements`,

  // 💻 Code and Technical Content Tests
  codeBlocks: `## Code Block Syntax Highlighting

### JavaScript Example:
\`\`\`javascript
// Modern React component with hooks
import React, { useState, useEffect } from 'react';

const ChatComponent = ({ messages }) => {
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    console.log('Component mounted');
  }, []);

  const handleSubmit = async (message) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container">
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
    </div>
  );
};
\`\`\`

### Python Example:
\`\`\`python
# FastAPI backend service
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncio

app = FastAPI()

class ChatRequest(BaseModel):
    message: str
    user_id: int

@app.post("/api/chat")
async def send_message(request: ChatRequest):
    """Process chat message with AI provider"""
    try:
        # Validate quota
        if not await check_quota(request.user_id):
            raise HTTPException(status_code=429, detail="Quota exceeded")
        
        # Send to LLM
        response = await llm_service.send(request.message)
        
        # Log usage
        await log_usage(request.user_id, response.tokens)
        
        return {"content": response.text, "tokens": response.tokens}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
\`\`\`

### Inline Code:
You can use \`useState\` hook for state management, \`useEffect\` for side effects, and \`fetch\` for API calls.`,

  // 📊 Table Tests
  tables: `## Responsive Table Support

### User Statistics:
| User | Department | Requests | Cost | Status |
|------|------------|----------|------|--------|
| Alice Johnson | Engineering | 1,250 | $15.75 | Active |
| Bob Smith | Marketing | 890 | $11.20 | Active |
| Carol Davis | Sales | 2,100 | $26.80 | Limited |
| David Wilson | HR | 450 | $5.60 | Active |

### Provider Comparison:
| Provider | Model | Cost/1K Tokens | Speed | Quality |
|----------|--------|----------------|--------|---------|
| OpenAI | GPT-4 | $0.03 | Fast | Excellent |
| Anthropic | Claude-3 | $0.025 | Medium | Excellent |
| Google | Gemini Pro | $0.002 | Very Fast | Good |`,

  // 🔗 Links and Media Tests
  linksAndMedia: `## Links and External Content

### External Links:
- [OpenAI API Documentation](https://platform.openai.com/docs) - Official API docs
- [Anthropic Claude Guide](https://docs.anthropic.com) - Claude integration guide
- [FastAPI Documentation](https://fastapi.tiangolo.com) - Backend framework docs

### Internal Navigation:
Visit the [Dashboard](/dashboard) or check [User Settings](/settings) for configuration.

---

*Note: Links open in new tabs for security and user experience.*`,

  // 📋 Quotes and Special Elements Tests
  quotesAndSpecial: `## Blockquotes and Special Elements

> This is a professional blockquote with enhanced styling and blue accent colors.
> It supports multiple lines and maintains proper formatting.
> 
> Perfect for highlighting important information or quotes from documentation.

### Code with Explanation:
The \`useState\` hook allows you to add state to functional components:

\`\`\`javascript
const [count, setCount] = useState(0);
\`\`\`

### Horizontal Rule:

---

Content after the horizontal rule with professional gradient styling.`,

  // 🚨 Edge Cases and Error Handling Tests
  edgeCases: `## Edge Case Testing

### Empty and Special Content:

#### Very Long Code Line Test:
\`\`\`javascript
const veryLongVariableName = "This is a very long line of code that should test horizontal scrolling and mobile responsiveness in code blocks";
\`\`\`

#### Mixed Content Test:
**Bold text** with *italic* and \`inline code\` and [a link](https://example.com) all in one line.

#### Special Characters:
Testing special characters: !@#$%^&*()_+-=[]{}|;':",./<>?

#### Unicode and Emojis:
Testing unicode: ñáéíóú 中文 العربية 🚀 💻 📊 ✅

### Performance Test Content:
This tests the performance optimization for content handling.`,

  // 📱 Mobile Responsiveness Tests
  mobileTests: `## Mobile Responsiveness Testing

### Wide Table (Tests Horizontal Scroll):
| Very Long Column Header | Another Long Header | Third Long Header | Fourth Column | Fifth Column | Sixth Column |
|------------------------|-------------------|------------------|---------------|--------------|--------------|
| Very long content that should wrap properly | More long content | Even more content | Data 4 | Data 5 | Data 6 |
| Another row with lengthy information | More data | Additional info | Value 4 | Value 5 | Value 6 |

### Long Code Lines (Tests Horizontal Scroll):
\`\`\`javascript
function processUserDataWithVeryLongFunctionNameThatTestsHorizontalScrolling(userData, configuration, options) {
  return userData.map(user => ({ ...user, processed: true, timestamp: Date.now(), configuration: configuration.settings }));
}
\`\`\`

### Long Paragraph (Tests Text Wrapping):
This is a very long paragraph designed to test text wrapping behavior on mobile devices. It contains many words and should wrap gracefully across multiple lines while maintaining readability and proper spacing. The text should be legible on small screens and maintain the professional typography established in our design system.`,

  // 🎯 Comprehensive Mixed Content Test
  comprehensiveTest: `# 🎯 Comprehensive Markdown Test

This message tests **all markdown elements** together to ensure *proper integration* and professional rendering.

## Features Tested ✅

### 1. Typography Hierarchy
- **H1-H6 headers** with proper spacing
- **Paragraph spacing** and line height
- **Bold** and *italic* text styling

### 2. Code Integration 💻
Inline code like \`useState\` works alongside:

\`\`\`typescript
interface User {
  id: number;
  name: string;
  department: string;
  quota: number;
}

const processUsers = async (users: User[]): Promise<User[]> => {
  return users.filter(user => user.quota > 0);
};
\`\`\`

### 3. Data Tables 📊
| Feature | Status | Notes |
|---------|--------|-------|
| Headers | ✅ | H1-H6 all working |
| Code Blocks | ✅ | Syntax highlighting active |
| Tables | ✅ | Responsive with scroll |
| Links | ✅ | External with security |

### 4. Content Organization
> **Important:** All markdown elements render with professional blue theme
> and maintain mobile responsiveness.

#### Links and References:
- [Project Documentation](https://github.com/example) 
- Internal [Dashboard](/dashboard) link

---

**Result:** Complete markdown implementation with typography polish! 🎉`
};

// 🧪 Function to get a random test case for quick testing
export const getRandomTestCase = (): string => {
  const keys = Object.keys(markdownTestCases) as Array<keyof typeof markdownTestCases>;
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return markdownTestCases[randomKey];
};

// 📋 Test sequence for systematic testing
export const getTestSequence = (): string[] => {
  return [
    markdownTestCases.basicElements,
    markdownTestCases.lists,
    markdownTestCases.codeBlocks,
    markdownTestCases.tables,
    markdownTestCases.linksAndMedia,
    markdownTestCases.quotesAndSpecial,
    markdownTestCases.edgeCases,
    markdownTestCases.mobileTests,
    markdownTestCases.comprehensiveTest
  ];
};

// 🎯 Quick test messages for immediate verification
export const quickTests = {
  typography: "# Header Test\n\n**Bold** and *italic* with proper spacing.",
  code: "Code test: \`inline\` and\n\n```javascript\nconsole.log('Hello!');\n```",
  table: "| Col 1 | Col 2 |\n|-------|-------|\n| Data 1 | Data 2 |",
  mixed: "**Bold** with \`code\` and [link](https://example.com)\n\n> Blockquote test"
};
