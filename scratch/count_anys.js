import fs from 'fs';
import path from 'path';

const SRC_DIR = 'c:/TESTES DEV/1_PROJETOS_ATIVOS/Zavorth/src';

function scanForAnys(dir, results = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file === 'zavorth-control' || file === 'ink-test-env') continue; // exclude UI framework
      scanForAnys(fullPath, results);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      if (file.endsWith('.test.ts') || file.endsWith('.spec.ts') || file.includes('smoke') || file.includes('demo') || file.includes('test-')) {
        continue;
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Let's count uses of the word 'any' as a type annotation
      // e.g. ': any', '<any>', 'as any', 'Record<string, any>'
      // We'll use a regex to look for ': any', '<any', 'any>', 'as any', 'Record<string, any>'
      const matches = content.match(/\bany\b/g);
      const count = matches ? matches.length : 0;
      
      if (count > 0) {
        results.push({
          file: path.relative(SRC_DIR, fullPath).replace(/\\/g, '/'),
          count
        });
      }
    }
  }
  return results;
}

const results = scanForAnys(SRC_DIR);
results.sort((a, b) => b.count - a.count);

console.log(JSON.stringify(results.slice(0, 30), null, 2));
