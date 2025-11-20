#!/usr/bin/env node

/**
 * Fix markdown files that have lost their line breaks
 * Restores proper markdown formatting
 */

const fs = require('fs');
const path = require('path');

// Patterns to fix
const patterns = [
  // Fix headers followed by text: ## Header **text** -> ## Header\n\n**text**
  { regex: /(#{1,6}\s+[^\n]+)\s+\*\*(.+?)\*\*/g, replacement: '$1\n\n**$2**' },
  // Fix headers followed by dashes: ## Header --- -> ## Header\n\n---
  { regex: /(#{1,6}\s+[^\n]+)\s+(---)/g, replacement: '$1\n\n$2' },
  // Fix headers followed by lists: ## Header - item -> ## Header\n\n- item
  { regex: /(#{1,6}\s+[^\n]+)\s+(-\s+)/g, replacement: '$1\n\n$2' },
  // Fix headers followed by code blocks: ## Header ``` -> ## Header\n\n```
  { regex: /(#{1,6}\s+[^\n]+)\s+(```)/g, replacement: '$1\n\n$2' },
  // Fix bold text followed by text: **text** More text -> **text**\n\nMore text
  { regex: /\*\*(.+?)\*\*\s+([A-Z])/g, replacement: '**$1**\n\n$2' },
  // Fix list items that are concatenated: - item - item -> - item\n- item
  { regex: /(-\s+[^\n]+)\s+(-\s+)/g, replacement: '$1\n$2' },
  // Fix numbered lists: 1. item 2. item -> 1. item\n2. item
  { regex: /(\d+\.\s+[^\n]+)\s+(\d+\.\s+)/g, replacement: '$1\n$2' },
  // Fix code blocks followed by text: ```\ncode\n``` Text -> ```\ncode\n```\n\nText
  { regex: /(```[^`]+```)\s+([A-Z#])/g, replacement: '$1\n\n$2' },
  // Fix horizontal rules followed by headers: --- ## -> ---\n\n##
  { regex: /(---)\s+(#{1,6})/g, replacement: '$1\n\n$2' },
  // Fix horizontal rules followed by text: --- Text -> ---\n\nText
  { regex: /(---)\s+([A-Z])/g, replacement: '$1\n\n$2' },
];

function fixMarkdownFile(filePath) {
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Apply all patterns
  for (const { regex, replacement } of patterns) {
    content = content.replace(regex, replacement);
  }
  
  // Additional fixes for common markdown patterns
  // Fix: **text**- -> **text**\n-
  content = content.replace(/\*\*(.+?)\*\*-\s+/g, '**$1**\n\n- ');
  
  // Fix: ### Header**text** -> ### Header\n\n**text**
  content = content.replace(/(#{1,6}\s+[^\n]+)\*\*/g, '$1\n\n**');
  
  // Fix: **text**Text -> **text**\n\nText
  content = content.replace(/\*\*(.+?)\*\*([A-Z][a-z])/g, '**$1**\n\n$2');
  
  // Fix: - **text**Text -> - **text**\n\nText
  content = content.replace(/(-\s+\*\*.+?\*\*)([A-Z][a-z])/g, '$1\n\n$2');
  
  // Fix: | col | col |Text -> | col | col |\n\nText
  content = content.replace(/(\|[^\n]+\|)\s+([A-Z#])/g, '$1\n\n$2');
  
  // Fix multiple spaces before headers
  content = content.replace(/\s{3,}(#{1,6})/g, '\n\n$1');
  
  // Fix: **text** **text** -> **text**\n\n**text**
  content = content.replace(/\*\*(.+?)\*\*\s+\*\*/g, '**$1**\n\n**');
  
  // Normalize multiple newlines (max 2 consecutive)
  content = content.replace(/\n{3,}/g, '\n\n');
  
  // Trim trailing whitespace
  content = content.replace(/[ \t]+$/gm, '');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ Fixed ${filePath}`);
    return true;
  } else {
    console.log(`  - No changes needed for ${filePath}`);
    return false;
  }
}

// Main execution
const docsDir = path.join(__dirname, '..', 'docs');
const filesToFix = [
  'PROJECT_AUDIT.md',
  'CLEANUP_PLAN.md',
  'QUICK_ANSWERS.md'
];

let fixedCount = 0;

for (const file of filesToFix) {
  const filePath = path.join(docsDir, file);
  if (fs.existsSync(filePath)) {
    if (fixMarkdownFile(filePath)) {
      fixedCount++;
    }
  } else {
    console.log(`  ✗ File not found: ${filePath}`);
  }
}

console.log(`\n✅ Fixed ${fixedCount} file(s)`);
