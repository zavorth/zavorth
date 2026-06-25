import fs from 'node:fs';
import path from 'node:path';

type FunctionInfo = {
  name: string;
  file: string;
  line: number;
  complexity: number;
};

type ComplexityReport = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    status: 'passed' | 'failed' | 'advisory';
    totalFunctions: number;
    averageComplexity: number;
    functionsAboveWarn: number;
    functionsAboveFail: number;
    maxComplexity: number;
  };
  thresholds: {
    warn: number;
    fail: number;
  };
  violations: FunctionInfo[];
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const strict = argv.includes('--strict');
const workspaceRoot = process.cwd();
const sourceRoot = path.join(workspaceRoot, 'src');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', 'coverage', '.git']);

function parseThreshold(argName: string, defaultValue: number): number {
  const arg = argv.find((a) => a.startsWith(`--${argName}=`));
  return arg ? parseInt(arg.split('=')[1], 10) : defaultValue;
}

const WARN_THRESHOLD = parseThreshold('warn', 100);
const FAIL_THRESHOLD = parseThreshold('fail', 250);

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...walk(full));
      }
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

function extractFunctions(content: string): { name: string; startLine: number; body: string }[] {
  const functions: { name: string; startLine: number; body: string }[] = [];
  const lines = content.split(/\r?\n/);

  const fnPatterns = [
    /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)/,
    /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*\s+(\w+)/,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\()/,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/,
    /(\w+)\s*(?:\(.*?\)|\([^)]*\))\s*{/,
    /(?:public|private|protected|static|async|abstract)\s+(?:async\s+)?(\w+)\s*(?:\([^)]*\))\s*{/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    for (const pattern of fnPatterns) {
      const match = pattern.exec(line);
      if (match && match[1] && match[1] !== 'if' && match[1] !== 'for' && match[1] !== 'while' && match[1] !== 'switch' && match[1] !== 'catch') {
        let braceCount = 0;
        let started = false;
        const bodyLines: string[] = [];

        for (let j = i; j < Math.min(i + 500, lines.length); j++) {
          const bodyLine = lines[j];
          for (const ch of bodyLine) {
            if (ch === '{') {
              braceCount++;
              started = true;
            } else if (ch === '}') {
              braceCount--;
            }
          }
          bodyLines.push(bodyLine);
          if (started && braceCount <= 0) {
            functions.push({
              name: match[1],
              startLine: i + 1,
              body: bodyLines.join('\n'),
            });
            break;
          }
        }
        break;
      }
    }
  }

  return functions;
}

function calculateComplexity(body: string): number {
  let complexity = 1;

  const patterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\belse\b/g,
    /\bcase\s+/g,
    /\bfor\s*\(/g,
    /\bfor\s+.*\bof\b/g,
    /\bfor\s+.*\bin\b/g,
    /\bwhile\s*\(/g,
    /\bcatch\s*\(/g,
    /\?[^?]/g,
    /&&/g,
    /\|\|/g,
    /\?\?/g,
  ];

  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const matches = line.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
  }

  return complexity;
}

const allFiles = walk(sourceRoot);
const allFunctions: FunctionInfo[] = [];

for (const filePath of allFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
  const functions = extractFunctions(content);

  for (const fn of functions) {
    const complexity = calculateComplexity(fn.body);
    allFunctions.push({
      name: fn.name,
      file: relPath,
      line: fn.startLine,
      complexity,
    });
  }
}

const violations = allFunctions
  .filter((fn) => fn.complexity > WARN_THRESHOLD)
  .sort((a, b) => b.complexity - a.complexity);

const avgComplexity = allFunctions.length > 0
  ? allFunctions.reduce((sum, fn) => sum + fn.complexity, 0) / allFunctions.length
  : 0;
const maxComplexity = allFunctions.length > 0
  ? Math.max(...allFunctions.map((fn) => fn.complexity))
  : 0;

const report: ComplexityReport = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  summary: {
    status: allFunctions.some((fn) => fn.complexity > FAIL_THRESHOLD) ? (strict ? 'failed' : 'advisory') : 'passed',
    totalFunctions: allFunctions.length,
    averageComplexity: Math.round(avgComplexity * 100) / 100,
    functionsAboveWarn: violations.length,
    functionsAboveFail: violations.filter((fn) => fn.complexity > FAIL_THRESHOLD).length,
    maxComplexity,
  },
  thresholds: {
    warn: WARN_THRESHOLD,
    fail: FAIL_THRESHOLD,
  },
  violations,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('[complexity] analyzing cyclomatic complexity in src/');
  console.log(`[complexity] total functions: ${allFunctions.length}`);
  console.log(`[complexity] average complexity: ${report.summary.averageComplexity}`);
  console.log(`[complexity] max complexity: ${maxComplexity}`);
  console.log(`[complexity] warn threshold: ${WARN_THRESHOLD}, fail threshold: ${FAIL_THRESHOLD}`);
  console.log(`[complexity] functions above warn: ${violations.length}`);
  console.log(`[complexity] functions above fail: ${report.summary.functionsAboveFail}`);

  if (violations.length > 0) {
    console.log('\n[complexity] functions exceeding thresholds:');
    for (const fn of violations.slice(0, 25)) {
      const level = fn.complexity > FAIL_THRESHOLD ? 'FAIL' : 'WARN';
      console.log(`  - [${level}] ${fn.file}:${fn.line} ${fn.name} (complexity: ${fn.complexity})`);
    }
    if (violations.length > 25) {
      console.log(`  ... and ${violations.length - 25} more`);
    }
  }
}

if (report.summary.status === 'failed') {
  process.exitCode = 1;
}
