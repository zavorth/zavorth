#!/usr/bin/env node

/**
 * Script para detectar e corrigir catch {} vazios no Zavorth
 * 
 * Uso:
 *   node scripts/fix-empty-catch-blocks.js --detect    # Apenas detectar
 *   node scripts/fix-empty-catch-blocks.js --fix        # Detectar e corrigir
 *   node scripts/fix-empty-catch-blocks.js --dry-run    # Simular correções
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');

// Padrões de catch vazios
const EMPTY_CATCH_PATTERNS = [
  /catch\s*\{\s*\}/g,
  /catch\s*\(\s*\w+\s*\)\s*\{\s*\}/g,
  /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g,
];

// Arquivos para ignorar
const IGNORE_DIRS = ['node_modules', 'dist', 'build', '__tests__', '.next', 'public'];

/**
 * Lista recursivamente arquivos TypeScript/JavaScript
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
    // Ignorar erros de permissão
  }
  
  return files;
}

/**
 * Conta catchs vazios em um arquivo
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

/**
 * Encontra os top N arquivos com mais catchs vazios
 */
function findTopFiles(n = 20) {
  const files = getSourceFiles(SRC_DIR);
  const fileCounts = [];
  
  for (const file of files) {
    const count = countEmptyCatches(file);
    if (count > 0) {
      fileCounts.push({
        file: path.relative(SRC_DIR, file),
        fullPath: file,
        count,
      });
    }
  }
  
  fileCounts.sort((a, b) => b.count - a.count);
  return fileCounts.slice(0, n);
}

/**
 * Gera relatório dos catchs vazios
 */
function generateReport() {
  console.log('=== Top 20 Arquivos com Mais Catchs Vazios ===\n');
  
  const topFiles = findTopFiles(20);
  let totalCatches = 0;
  
  console.log('Pos | Arquivo | Catchs Vazios');
  console.log('--- |---------|--------------');
  
  for (let i = 0; i < topFiles.length; i++) {
    const { file, count } = topFiles[i];
    console.log(`${i + 1}. | ${file} | ${count}`);
    totalCatches += count;
  }
  
  console.log('\n=== Resumo ===');
  console.log(`Total de catchs vazios nos top 20: ${totalCatches}`);
  console.log(`Total de arquivos com catchs vazios: ${topFiles.length}`);
  
  return topFiles;
}

/**
 * Corrige catchs vazios em um arquivo
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
  
  // Adicionar import do logger se necessário
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
 * Aplica correções nos arquivos
 */
function applyFixes(dryRun = false) {
  console.log('=== Aplicando Correções ===\n');
  
  const topFiles = findTopFiles(20);
  let totalFixed = 0;
  
  for (const { file, fullPath, count } of topFiles) {
    const { content, fixedCount } = fixEmptyCatches(fullPath);
    
    if (fixedCount > 0) {
      console.log(`${dryRun ? '[DRY RUN] ' : ''}Corrigindo ${file}: ${fixedCount} catchs`);
      
      if (!dryRun) {
        fs.writeFileSync(fullPath, content, 'utf-8');
      }
      
      totalFixed += fixedCount;
    }
  }
  
  console.log(`\n=== Total: ${totalFixed} catchs corrigidos ===`);
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
