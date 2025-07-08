#!/usr/bin/env node

/**
 * JSX Void Return Type Checker
 * Detects potential void return type issues in JSX files
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns that commonly cause void return type errors in JSX
const PROBLEMATIC_PATTERNS = [
  // Direct console.log in JSX (exact match)
  /\{\s*console\.log\([^)]*\)\s*\}/g,
  
  // Other direct void function calls in JSX
  /\{\s*(console\.(warn|error|debug)|setInterval|setTimeout|alert)\([^)]*\)\s*\}/g,
];

const SUSPICIOUS_FUNCTIONS = [
  'console.log',
  'console.warn', 
  'console.error', 
  'console.debug',
];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    
    // Check for problematic patterns - only exact matches that cause issues
    PROBLEMATIC_PATTERNS.forEach((pattern, patternIndex) => {
      if (pattern.test(line)) {
        issues.push({
          line: lineNumber,
          content: line.trim(),
          issue: `Direct void function call in JSX (causes TypeScript error)`,
          severity: 'error'
        });
      }
    });
  });

  return issues;
}

function main() {
  console.log('🔍 Checking for potential JSX void return type issues...\n');
  
  const jsxFiles = glob.sync('src/**/*.{tsx,jsx}', { 
    cwd: process.cwd(),
    absolute: true 
  });

  let totalIssues = 0;
  let hasErrors = false;

  jsxFiles.forEach(file => {
    const issues = checkFile(file);
    if (issues.length > 0) {
      console.log(`📄 ${path.relative(process.cwd(), file)}`);
      issues.forEach(issue => {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        console.log(`  ${icon} Line ${issue.line}: ${issue.issue}`);
        console.log(`     ${issue.content}`);
        
        if (issue.severity === 'error') {
          hasErrors = true;
        }
      });
      console.log('');
      totalIssues += issues.length;
    }
  });

  if (totalIssues === 0) {
    console.log('✅ No potential JSX void return issues found!');
  } else {
    console.log(`📊 Found ${totalIssues} potential issues across ${jsxFiles.length} files`);
    
    if (hasErrors) {
      console.log('\n❌ Found critical issues that may cause TypeScript errors');
      process.exit(1);
    } else {
      console.log('\n⚠️ Found warnings - review recommended but build should succeed');
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkFile, PROBLEMATIC_PATTERNS, SUSPICIOUS_FUNCTIONS };