// 🌈 Professional Multi-Color Syntax Highlighter
// Features vibrant color scheme with comprehensive language support

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  children: string;
  className?: string;
}

// 🎨 Professional Color Palette
const COLORS = {
  // Keywords and control flow
  keyword: '#8B5CF6',        // Purple - if, for, function, class
  controlFlow: '#EC4899',    // Pink - return, break, continue
  dataType: '#3B82F6',       // Blue - int, String, boolean
  modifier: '#10B981',       // Emerald - public, private, static
  
  // Literals and values
  string: '#059669',         // Green - "strings"
  number: '#DC2626',         // Red - 123, 45.67
  boolean: '#F59E0B',        // Amber - true, false
  null: '#6B7280',           // Gray - null, undefined, None
  
  // Identifiers and calls
  function: '#2563EB',       // Bright Blue - myFunction()
  method: '#1D4ED8',         // Dark Blue - object.method()
  variable: '#374151',       // Dark Gray - variables
  parameter: '#4B5563',      // Medium Gray - function parameters
  
  // Operators and punctuation
  operator: '#DC2626',       // Red - +, -, =, ===
  punctuation: '#6B7280',    // Gray - {}, [], (), ;
  
  // Comments and docs
  comment: '#9CA3AF',        // Light Gray - // comments
  docComment: '#6366F1',     // Indigo - /** documentation */
  
  // HTML/XML specific
  htmlTag: '#7C3AED',        // Purple - <div>, <span>
  htmlAttribute: '#059669',  // Green - class="value"
  htmlValue: '#DC2626',      // Red - attribute values
  
  // CSS specific
  cssProperty: '#7C3AED',    // Purple - color, margin
  cssValue: '#059669',       // Green - #fff, 10px
  cssSelector: '#2563EB',    // Blue - .class, #id
  
  // Default
  default: '#1F2937',        // Dark Gray - default text
};

// Enhanced language detection
const getLanguageFromClassName = (className: string = ''): string => {
  const match = className.match(/(?:language-|lang-)(\w+)/);
  const language = match ? match[1] : 'text';
  return language;
};

const getLanguageDisplayName = (language: string): string => {
  const languageMap: { [key: string]: string } = {
    'js': 'JavaScript', 'javascript': 'JavaScript', 'jsx': 'React JSX',
    'ts': 'TypeScript', 'tsx': 'TypeScript JSX',
    'py': 'Python', 'python': 'Python',
    'java': 'Java', 'kotlin': 'Kotlin', 'scala': 'Scala',
    'cpp': 'C++', 'c': 'C', 'cs': 'C#', 'csharp': 'C#',
    'php': 'PHP', 'rb': 'Ruby', 'ruby': 'Ruby',
    'go': 'Go', 'rs': 'Rust', 'rust': 'Rust',
    'swift': 'Swift', 'objc': 'Objective-C',
    'sh': 'Shell', 'bash': 'Bash', 'zsh': 'Zsh',
    'sql': 'SQL', 'mysql': 'MySQL', 'postgresql': 'PostgreSQL',
    'html': 'HTML', 'xml': 'XML', 'svg': 'SVG',
    'css': 'CSS', 'scss': 'SCSS', 'sass': 'Sass', 'less': 'LESS',
    'json': 'JSON', 'yaml': 'YAML', 'yml': 'YAML', 'toml': 'TOML',
    'md': 'Markdown', 'markdown': 'Markdown',
    'dockerfile': 'Dockerfile', 'docker': 'Docker',
    'text': 'Text', 'txt': 'Text',
  };
  
  return languageMap[language.toLowerCase()] || language.toUpperCase();
};

// 🎯 Enhanced token patterns for each language
const getLanguagePatterns = (language: string) => {
  const lang = language.toLowerCase();
  
  if (['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx'].includes(lang)) {
    return [
      // Comments (highest priority)
      { regex: /\/\*\*[\s\S]*?\*\//g, color: COLORS.docComment, priority: 1 },
      { regex: /\/\*[\s\S]*?\*\//g, color: COLORS.comment, priority: 2 },
      { regex: /\/\/.*$/gm, color: COLORS.comment, priority: 3 },
      
      // Strings (high priority)
      { regex: /`[^`]*`/g, color: COLORS.string, priority: 4 },
      { regex: /"(?:[^"\\]|\\.)*"/g, color: COLORS.string, priority: 5 },
      { regex: /'(?:[^'\\]|\\.)*'/g, color: COLORS.string, priority: 6 },
      
      // Keywords and control flow
      { regex: /\b(if|else|for|while|do|switch|case|default|break|continue|return|throw|try|catch|finally)\b/g, color: COLORS.controlFlow, priority: 7 },
      { regex: /\b(function|class|extends|implements|interface|type|enum|namespace|module|import|export|from|default|as)\b/g, color: COLORS.keyword, priority: 8 },
      { regex: /\b(const|let|var|async|await|yield|new|this|super|static|public|private|protected|readonly|abstract)\b/g, color: COLORS.modifier, priority: 9 },
      
      // Types and primitives
      { regex: /\b(string|number|boolean|object|undefined|any|void|never)\b/g, color: COLORS.dataType, priority: 10 },
      { regex: /\b(true|false)\b/g, color: COLORS.boolean, priority: 11 },
      { regex: /\b(null|undefined)\b/g, color: COLORS.null, priority: 12 },
      
      // Numbers
      { regex: /\b\d+\.?\d*([eE][+-]?\d+)?\b/g, color: COLORS.number, priority: 13 },
      
      // Function calls
      { regex: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, color: COLORS.function, priority: 14 },
      
      // Operators
      { regex: /[+\-*\/=<>!&|%^~?:]+/g, color: COLORS.operator, priority: 15 },
      { regex: /[{}[\]();,.]/g, color: COLORS.punctuation, priority: 16 },
    ];
  }
  
  if (['python', 'py'].includes(lang)) {
    return [
      // Comments
      { regex: /#.*$/gm, color: COLORS.comment, priority: 1 },
      
      // Strings (Python has many string types)
      { regex: /"""[\s\S]*?"""/g, color: COLORS.docComment, priority: 2 },
      { regex: /'''[\s\S]*?'''/g, color: COLORS.docComment, priority: 3 },
      { regex: /f"(?:[^"\\]|\\.)*"/g, color: COLORS.string, priority: 4 },
      { regex: /f'(?:[^'\\]|\\.)*'/g, color: COLORS.string, priority: 5 },
      { regex: /"(?:[^"\\]|\\.)*"/g, color: COLORS.string, priority: 6 },
      { regex: /'(?:[^'\\]|\\.)*'/g, color: COLORS.string, priority: 7 },
      
      // Keywords and control flow
      { regex: /\b(if|elif|else|for|while|break|continue|return|yield|raise|try|except|finally|with|as)\b/g, color: COLORS.controlFlow, priority: 8 },
      { regex: /\b(def|class|lambda|import|from|global|nonlocal|pass|del|assert)\b/g, color: COLORS.keyword, priority: 9 },
      { regex: /\b(and|or|not|in|is)\b/g, color: COLORS.operator, priority: 10 },
      
      // Types and primitives
      { regex: /\b(int|float|str|bool|list|dict|tuple|set|None)\b/g, color: COLORS.dataType, priority: 11 },
      { regex: /\b(True|False)\b/g, color: COLORS.boolean, priority: 12 },
      { regex: /\b(None)\b/g, color: COLORS.null, priority: 13 },
      
      // Numbers
      { regex: /\b\d+\.?\d*([eE][+-]?\d+)?\b/g, color: COLORS.number, priority: 14 },
      
      // Function calls
      { regex: /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, color: COLORS.function, priority: 15 },
      
      // Operators and punctuation
      { regex: /[+\-*\/=<>!%^~]+/g, color: COLORS.operator, priority: 16 },
      { regex: /[{}[\]();:,.]/g, color: COLORS.punctuation, priority: 17 },
    ];
  }
  
  if (['java', 'csharp', 'cs'].includes(lang)) {
    return [
      // Comments
      { regex: /\/\*\*[\s\S]*?\*\//g, color: COLORS.docComment, priority: 1 },
      { regex: /\/\*[\s\S]*?\*\//g, color: COLORS.comment, priority: 2 },
      { regex: /\/\/.*$/gm, color: COLORS.comment, priority: 3 },
      
      // Strings
      { regex: /"(?:[^"\\]|\\.)*"/g, color: COLORS.string, priority: 4 },
      { regex: /'(?:[^'\\]|\\.)?'/g, color: COLORS.string, priority: 5 },
      
      // Keywords and control flow
      { regex: /\b(if|else|for|while|do|switch|case|default|break|continue|return|throw|try|catch|finally|goto)\b/g, color: COLORS.controlFlow, priority: 6 },
      { regex: /\b(class|interface|enum|struct|namespace|using|import|package|extends|implements|abstract|final|synchronized)\b/g, color: COLORS.keyword, priority: 7 },
      { regex: /\b(public|private|protected|static|final|override|virtual|sealed|readonly)\b/g, color: COLORS.modifier, priority: 8 },
      
      // Types
      { regex: /\b(int|long|short|byte|char|float|double|boolean|bool|String|string|void|var|object|Object)\b/g, color: COLORS.dataType, priority: 9 },
      { regex: /\b(true|false)\b/g, color: COLORS.boolean, priority: 10 },
      { regex: /\b(null)\b/g, color: COLORS.null, priority: 11 },
      { regex: /\b(new|this|super|instanceof)\b/g, color: COLORS.keyword, priority: 12 },
      
      // Numbers
      { regex: /\b\d+\.?\d*[fFdDlL]?\b/g, color: COLORS.number, priority: 13 },
      
      // Function/Method calls
      { regex: /\b([A-Z][a-zA-Z0-9_]*)\s*(?=\()/g, color: COLORS.function, priority: 14 },
      { regex: /\.([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, color: COLORS.method, priority: 15 },
      
      // Operators and punctuation
      { regex: /[+\-*\/=<>!&|%^~?:]+/g, color: COLORS.operator, priority: 16 },
      { regex: /[{}[\]();,.]/g, color: COLORS.punctuation, priority: 17 },
    ];
  }
  
  if (['html', 'xml'].includes(lang)) {
    return [
      // Comments
      { regex: /<!--[\s\S]*?-->/g, color: COLORS.comment, priority: 1 },
      
      // Tags and elements
      { regex: /<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^>]*)?\/?>/g, color: COLORS.htmlTag, priority: 2 },
      
      // Attributes and values
      { regex: /\s([a-zA-Z-]+)(?==)/g, color: COLORS.htmlAttribute, priority: 3 },
      { regex: /=\s*"[^"]*"/g, color: COLORS.htmlValue, priority: 4 },
      { regex: /=\s*'[^']*'/g, color: COLORS.htmlValue, priority: 5 },
    ];
  }
  
  if (['css', 'scss', 'sass'].includes(lang)) {
    return [
      // Comments
      { regex: /\/\*[\s\S]*?\*\//g, color: COLORS.comment, priority: 1 },
      
      // Selectors
      { regex: /[.#]?[a-zA-Z][a-zA-Z0-9_-]*(?=\s*{)/g, color: COLORS.cssSelector, priority: 2 },
      
      // Properties
      { regex: /([a-zA-Z-]+)\s*(?=:)/g, color: COLORS.cssProperty, priority: 3 },
      
      // Values and units
      { regex: /:\s*([^;}\n]+)/g, color: COLORS.cssValue, priority: 4 },
      { regex: /#[0-9a-fA-F]{3,6}\b/g, color: COLORS.cssValue, priority: 5 },
      { regex: /\b\d+(?:px|em|rem|%|vh|vw|deg|s|ms|fr)\b/g, color: COLORS.number, priority: 6 },
      
      // Punctuation
      { regex: /[{}:;]/g, color: COLORS.punctuation, priority: 7 },
    ];
  }
  
  // Default patterns for unknown languages
  return [
    { regex: /\/\/.*$/gm, color: COLORS.comment, priority: 1 },
    { regex: /"(?:[^"\\]|\\.)*"/g, color: COLORS.string, priority: 2 },
    { regex: /'(?:[^'\\]|\\.)*'/g, color: COLORS.string, priority: 3 },
    { regex: /\b\d+\.?\d*\b/g, color: COLORS.number, priority: 4 },
  ];
};

// 🎨 Apply patterns to create colorful JSX
const highlightLine = (line: string, language: string): JSX.Element[] => {
  const patterns = getLanguagePatterns(language);
  const matches: Array<{ start: number, end: number, color: string, text: string }> = [];
  
  // Find all matches
  patterns.forEach(pattern => {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match;
    while ((match = regex.exec(line)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        color: pattern.color,
        text: match[0]
      });
    }
  });
  
  // Sort and remove overlaps
  matches.sort((a, b) => a.start - b.start);
  const cleanMatches = [];
  let lastEnd = 0;
  
  for (const match of matches) {
    if (match.start >= lastEnd) {
      cleanMatches.push(match);
      lastEnd = match.end;
    }
  }
  
  // Build JSX
  const result: JSX.Element[] = [];
  let currentPos = 0;
  
  cleanMatches.forEach((match, index) => {
    if (match.start > currentPos) {
      result.push(
        <span key={`text-${index}`} style={{ color: COLORS.default }}>
          {line.slice(currentPos, match.start)}
        </span>
      );
    }
    
    result.push(
      <span key={`highlight-${index}`} style={{ color: match.color, fontWeight: match.color === COLORS.keyword ? '600' : 'normal' }}>
        {match.text}
      </span>
    );
    
    currentPos = match.end;
  });
  
  if (currentPos < line.length) {
    result.push(
      <span key="remaining" style={{ color: COLORS.default }}>
        {line.slice(currentPos)}
      </span>
    );
  }
  
  return result.length > 0 ? result : [<span key="default" style={{ color: COLORS.default }}>{line}</span>];
};

// 🌈 Main highlighting function
const highlightCode = (code: string, language: string): JSX.Element => {
  const lines = code.trim().split('\n');
  
  return (
    <div>
      {lines.map((line, i) => (
        <div key={i} className="flex">
          <span className="inline-block w-6 md:w-8 text-blue-400/60 text-xs text-right mr-2 md:mr-4 select-none flex-shrink-0">
            {i + 1}
          </span>
          <span className="flex-1 break-all md:break-normal">
            {highlightLine(line, language)}
          </span>
        </div>
      ))}
    </div>
  );
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ children, className = '' }) => {
  const [isCopied, setIsCopied] = useState(false);
  
  const language = getLanguageFromClassName(className);
  const displayLanguage = getLanguageDisplayName(language);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="group relative my-3 md:my-4 overflow-hidden rounded-lg bg-blue-50/90 backdrop-blur-sm border border-blue-200/50 shadow-sm">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2 bg-blue-100/50 border-b border-blue-200/30">
        <span className="text-xs font-medium text-blue-700 uppercase tracking-wide">
          {displayLanguage}
        </span>
        
        <button
          onClick={handleCopy}
          className="md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-md hover:bg-blue-200/50 text-blue-600 hover:text-blue-800 touch-manipulation"
          title={isCopied ? 'Copied!' : 'Copy code'}
        >
          {isCopied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Enhanced colorful code display */}
      <div className="overflow-x-auto">
        <pre className="p-3 md:p-4 text-xs md:text-sm leading-relaxed font-mono bg-transparent">
          {highlightCode(children, language)}
        </pre>
      </div>
    </div>
  );
};
