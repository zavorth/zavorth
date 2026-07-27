#!/usr/bin/env node

/**
 * Script to detect and fix empty catch blocks in Zavorth
 *
 * Uso:
 *   node scripts/fix-empty-catch-blocks.js --detect    # Apenas detectar
 *   node scripts/fix-empty-catch-blocks.js --fix        # Detect and fix
 *   node scripts/fix-empty-catch-blocks.js --dry-run    # Simulate fixes
 */

const fs = require('fs');
const path = require('path');

const DIRS_TO_SCAN = [
  path.join(__dirname, '..', 'src'),
  path.join(__dirname, '..', 'apps'),
  path.join(__dirname, '..', 'packages')
];

// Empty catch patterns
const EMPTY_CATCH_PATTERNS = [
  /catch\s*\{\s*\}/g,
  /catch\s*\(\s*\w+\s*\)\s*\{\s*\}/g,
  /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g,
];

// Files to ignore
const IGNORE_DIRS = ['node_modules', 'dist', 'build', '__tests__', '.next', 'public'];

/**
 * Recursively lists TypeScript/JavaScript files
 */
function getSourceFiles(dir) {
  const files = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.includes(entry.name)) {
          files.push(...getSourceFiles(fullPath));
        }
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) &&
                 !entry.name.includes('.test.') &&
                 !entry.name.includes('.spec.')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Ignore permission errors
  }

  return files;
}

/**
 * Counts empty catch blocks in a file
 */
function countEmptyCatches(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    let count = 0;

    for (const pattern of EMPTY_CATCH_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }

    return count;
  } catch (error) {
    return 0;
  }
}

function findTopFiles(n = 20) {
  const files = [];
  for (const dir of DIRS_TO_SCAN) {
    if (fs.existsSync(dir)) {
      files.push(...getSourceFiles(dir));
    }
  }
  const fileCounts = [];
  const rootDir = path.join(__dirname, '..');

  for (const file of files) {
    const count = countEmptyCatches(file);
    if (count > 0) {
      fileCounts.push({
        file: path.relative(rootDir, file),
        fullPath: file,
        count,
      });
    }
  }

  fileCounts.sort((a, b) => b.count ? a.count);
  return fileCounts.slice(0, n);
}

/**
 * Generates a report for empty catch blocks
 */
function generateReport() {
  console.log('=== Top 20 Files With Most Empty Catch Blocks ===\n');

  const topFiles = findTopFiles(20);
  let totalCatches = 0;

  console.log('Pos | File | Empty Catches');
  console.log('--- |---------|--------------');

  for (let i = 0; i < topFiles.length; i++) {
    const { file, count } = topFiles[i];
    console.log(`${i + 1}. | ${file} | ${count}`);
    totalCatches += count;
  }

  console.log('\n=== Resumo ===');
  console.log(`Total empty catch blocks in top 20: ${totalCatches}`);
  console.log(`Total files with empty catch blocks: ${topFiles.length}`);

  return topFiles;
}

/**
 * Fixes empty catch blocks in a file
 */
function fixEmptyCatches(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let fixedCount = 0;

  // Pattern 1: catch { }
  const pattern1 = /catch\s*\{\s*\}/g;
  if (pattern1.test(content)) {
    content = content.replace(pattern1, () => {
      fixedCount++;
      return 'catch (err) { logger.warn("[auto-fix] Empty catch block", err); }';
    });
  }

  // Pattern 2: catch (e) { }
  const pattern2 = /catch\s*\(\s*(\w+)\s*\)\s*\{\s*\}/g;
  if (pattern2.test(content)) {
    content = content.replace(pattern2, (match, varName) => {
      fixedCount++;
      return `catch (${varName}) { logger.warn("[auto-fix] Empty catch block", ${varName}); }`;
    });
  }

  // Pattern 3: .catch(() => {})
  const pattern3 = /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g;
  if (pattern3.test(content)) {
    content = content.replace(pattern3, () => {
      fixedCount++;
      return '.catch((err) => { logger.warn("[auto-fix] Empty catch block", err); })';
    });
  }

  // Add logger import if needed
  if (fixedCount > 0 && !content.includes("import { logger }") && !content.includes("import {logger}")) {
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const endOfLine = content.indexOf('\n', lastImportIndex);
      content = content.slice(0, endOfLine + 1) +
                "import { logger } from '../logger.js';\n" +
                content.slice(endOfLine + 1);
    }
  }

  return { content, fixedCount };
}

/**
 * Applies fixes to files
 */
function applyFixes(dryRun = false) {
  console.log('=== Applying Fixes ===\n');

  const topFiles = findTopFiles(20);
  let totalFixed = 0;

  for (const { file, fullPath, count } of topFiles) {
    const { content, fixedCount } = fixEmptyCatches(fullPath);

    if (fixedCount > 0) {
      console.log(`${dryRun ? '[DRY RUN] ' : ''}Fixing ${file}: ${fixedCount} catch blocks`);

      if (!dryRun) {
        fs.writeFileSync(fullPath, content, 'utf-8');
      }

      totalFixed += fixedCount;
    }
  }

  console.log(`\n=== Total: ${totalFixed} catch blocks fixed ===`);
  return totalFixed;
}

// Main
const args = process.argv.slice(2);
const command = args[0] || '--detect';

switch (command) {
  case '--detect':
    generateReport();
    break;

  case '--fix':
    applyFixes(false);
    break;

  case '--dry-run':
    applyFixes(true);
    break;

  default:
    console.log('Uso:');
    console.log('  node scripts/fix-empty-catch-blocks.js --detect');
    console.log('  node scripts/fix-empty-catch-blocks.js --fix');
    console.log('  node scripts/fix-empty-catch-blocks.js --dry-run');
}
