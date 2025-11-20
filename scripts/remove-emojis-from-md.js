#!/usr/bin/env node

/**
 * Script to remove emojis from all markdown files
 * This fixes Cursor IDE issues with emoji characters
 */

const fs = require('fs');
const path = require('path');

// Common emoji patterns (Unicode ranges)
const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2190}-\u{21FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}-\u{2B55}]|[\u{3030}-\u{303F}]|[\u{3297}-\u{3299}]/gu;

// Specific emojis found in the files
const specificEmojis = [
  '🔍', '🔐', '🌐', '📁', '🎯', '💡', '📊', '🚀', '✅', '❌', '⚠️',
  '🛠️', '📝', '🗑️', '⚙️', '⏱️', '🎨', '🔧', '📈', '📉', '🎉',
  '🔒', '🔓', '📌', '📍', '💾', '🗂️', '📋', '📄', '📑', '📚',
  '🔎', '🎪', '🎭', '🎬', '🎤', '🎧', '🎨', '🎯', '🎲', '🎮',
  '🏁', '🏆', '🏅', '🎖️', '⭐', '🌟', '💫', '✨', '🔥', '💯'
];

function removeEmojis(text) {
  // Remove emojis using regex (preserve all whitespace and newlines)
  let cleaned = text.replace(emojiRegex, '');
  
  // Also remove specific emojis that might have been missed
  specificEmojis.forEach(emoji => {
    cleaned = cleaned.replace(new RegExp(emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
  });
  
  // Only clean up double spaces (but preserve newlines and markdown structure)
  // Replace multiple spaces with single space, but preserve newlines
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  
  // Clean up any double newlines (max 2 consecutive newlines)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned;
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const cleaned = removeEmojis(content);
    
    if (content !== cleaned) {
      fs.writeFileSync(filePath, cleaned, 'utf8');
      console.log(`✅ Cleaned: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function findMarkdownFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findMarkdownFiles(filePath, fileList);
    } else if (file.endsWith('.md')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Main execution
const projectRoot = path.join(__dirname, '..');
const mdFiles = findMarkdownFiles(projectRoot);

console.log(`Found ${mdFiles.length} markdown files\n`);

let cleanedCount = 0;
mdFiles.forEach(file => {
  if (processFile(file)) {
    cleanedCount++;
  }
});

console.log(`\n✨ Done! Cleaned ${cleanedCount} out of ${mdFiles.length} files.`);

