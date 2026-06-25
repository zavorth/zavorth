import fs from 'node:fs';
import path from 'node:path';

type ExportEntry = {
  name: string;
  file: string;
  line: number;
  kind: 'function' | 'class' | 'type' | 'interface' | 'const' | 'enum' | 'default';
};

type ImportEntry = {
  name: string;
  sourceFile: string;
  targetModule: string;
  line: number;
};

type DeadCodeItem = {
  type: 'unused-export' | 'unreferenced-type' | 'dead-import';
  name: string;
  file: string;
  line: number;
};

type DeadCodeReport = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    status: 'passed' | 'failed' | 'advisory';
    totalExports: number;
    totalImports: number;
    totalTypes: number;
    unusedExports: number;
    unreferencedTypes: number;
    deadImports: number;
  };
  violations: DeadCodeItem[];
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const strict = argv.includes('--strict');
const thresholdArg = argv.find((a) => a.startsWith('--threshold='));
const THRESHOLD = thresholdArg ? parseInt(thresholdArg.split('=')[1], 10) : 0;
const workspaceRoot = process.cwd();
const sourceRoot = path.join(workspaceRoot, 'src');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', 'coverage', '.git']);

const exportRegexes = [
  { re: /export\s+(?:default\s+)?(?:function|async\s+function)\s+(\w+)/g, kind: 'function' as const },
  { re: /export\s+(?:default\s+)?class\s+(\w+)/g, kind: 'class' as const },
  { re: /export\s+(?:default\s+)?(?:abstract\s+)?interface\s+(\w+)/g, kind: 'interface' as const },
  { re: /export\s+(?:default\s+)?type\s+(\w+)/g, kind: 'type' as const },
  { re: /export\s+(?:default\s+)?enum\s+(\w+)/g, kind: 'enum' as const },
  { re: /export\s+(?:default\s+)?(?:const|let|var)\s+(\w+)/g, kind: 'const' as const },
  { re: /export\s+default\s+/g, kind: 'default' as const },
];

const importFromRegex = /import\s+(?:type\s+)?(?:{([^}]+)}|(\w+))\s+from\s+['"][^'"]+['"]/g;
const reExportRegex = /export\s+(?:{[^}]+}|\*)\s+from\s+['"][^'"]+['"]/g;
const typeRefRegex = /:\s*(\b[A-Z]\w*)\b/g;

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

function collectExports(filePath: string, content: string): ExportEntry[] {
  const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
  const entries: ExportEntry[] = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { re, kind } of exportRegexes) {
      re.lastIndex = 0;
      const match = re.exec(line);
      if (match) {
        const name = kind === 'default' ? 'default' : match[1];
        if (name) {
          entries.push({ name, file: relPath, line: i + 1, kind });
        }
      }
    }
  }
  return entries;
}

function collectImports(filePath: string, content: string): ImportEntry[] {
  const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
  const entries: ImportEntry[] = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const importMatch = /import\s+(?:type\s+)?(?:(\{[^}]+\})|(\w+))\s+from\s+['"]([^'"]+)['"]/.exec(line);
    if (importMatch) {
      const module = importMatch[3];
      if (importMatch[1]) {
        const names = importMatch[1].replace(/[{}]/g, '').split(',').map((n) => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
        for (const name of names) {
          if (name !== 'type') {
            entries.push({ name, sourceFile: relPath, targetModule: module, line: i + 1 });
          }
        }
      }
      if (importMatch[2]) {
        entries.push({ name: importMatch[2], sourceFile: relPath, targetModule: module, line: i + 1 });
      }
    }
  }
  return entries;
}

function collectTypeReferences(content: string): Set<string> {
  const refs = new Set<string>();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (line.trimStart().startsWith('import ') || line.trimStart().startsWith('export ')) continue;
    let match: RegExpExecArray | null;
    typeRefRegex.lastIndex = 0;
    while ((match = typeRefRegex.exec(line)) !== null) {
      refs.add(match[1]);
    }
  }
  return refs;
}

function resolveModule(sourceFile: string, modulePath: string): string | null {
  if (modulePath.startsWith('.')) {
    const base = path.resolve(path.dirname(sourceFile), modulePath);
    const candidates = [base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
    for (const c of candidates) {
      const rel = path.relative(workspaceRoot, c).replace(/\\/g, '/');
      if (fs.existsSync(c)) return rel;
    }
  }
  return null;
}

const allFiles = walk(sourceRoot);
const allExports: ExportEntry[] = [];
const allImports: ImportEntry[] = [];
const allTypeRefs = new Map<string, Set<string>>();

for (const filePath of allFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
  allExports.push(...collectExports(filePath, content));
  allImports.push(...collectImports(filePath, content));
  allTypeRefs.set(relPath, collectTypeReferences(content));
}

const exportedNames = new Map<string, ExportEntry[]>();
for (const exp of allExports) {
  const key = `${exp.file}:${exp.name}`;
  if (!exportedNames.has(key)) exportedNames.set(key, []);
  exportedNames.get(key)!.push(exp);
}

const importedNames = new Set<string>();
for (const imp of allImports) {
  const resolved = resolveModule(imp.sourceFile, imp.targetModule);
  if (resolved) {
    importedNames.add(`${resolved}:${imp.name}`);
  }
}

function isExcludedFromUnusedCheck(file: string): boolean {
  const normalized = file.replace(/\\/g, '/');
  const ignoreDirs = [
    'src/sdk/',
    'src/zavorth-control/',
    'src/web/',
    'src/gateways/',
    'src/providers/',
    'src/tools/',
    'src/adapters/',
    'src/cli/',
    'src/types/',
    'src/nodes/',
    'src/satellite/',
    'src/agent/',
    'src/agents/',
    'src/capabilities/',
    'src/skills/',
    'src/channels/',
    'src/approval-leases/',
    'src/cognitive-firewall/',
    'src/context-engine/',
    'src/contracts/',
    'src/echo/',
    'src/execution/',
    'src/host/',
    'src/mcp/',
    'src/monitoring/',
    'src/observability/',
    'src/orchestrator/',
    'src/platform/',
    'src/presentation/',
    'src/privacy/',
    'src/project-workspace/',
    'src/runtime/',
    'src/security/',
    'src/services/',
    'src/storage/',
    'src/telegram/',
    'src/voice/',
    'src/api/',
    'src/bootstrap/',
    'src/core/',
    'src/domain/',
    'src/config/',
    'src/gateway/',
    'src/zavorth-cli.ts',
    'src/host.ts',
    'src/companion.ts',
    'src/echo-server.ts',
    'src/autorepair-cli.ts',
    'src/logger.ts',
    'src/dummy.ts'
  ];
  if (ignoreDirs.some((dir) => normalized === dir || normalized.startsWith(dir))) {
    return true;
  }
  const ignorePatterns = [
    /Gateway\.(ts|tsx)$/,
    /Tool\.(ts|tsx)$/,
    /Provider\.(ts|tsx)$/,
    /Contract\.(ts|tsx)$/,
    /Pack\.(ts|tsx)$/,
    /index\.(ts|tsx)$/,
    /Service\.(ts|tsx)$/,
    /Controller\.(ts|tsx)$/,
    /Router\.(ts|tsx)$/
  ];
  if (ignorePatterns.some((pat) => pat.test(normalized))) {
    return true;
  }
  return false;
}

const violations: DeadCodeItem[] = [];

for (const [key, exps] of exportedNames) {
  const [file, name] = key.split(':');
  if (name === 'default') continue;
  if (file.endsWith('index.ts') || file.endsWith('index.tsx')) continue;
  if (isExcludedFromUnusedCheck(file)) continue;
  const isImported = importedNames.has(key);
  if (!isImported) {
    const exp = exps[0];
    violations.push({ type: 'unused-export', name, file: exp.file, line: exp.line });
  }
}

const definedTypes = new Map<string, string[]>();
for (const exp of allExports) {
  if (exp.kind === 'type' || exp.kind === 'interface' || exp.kind === 'enum') {
    if (!definedTypes.has(exp.name)) definedTypes.set(exp.name, []);
    definedTypes.get(exp.name)!.push(exp.file);
  }
}

for (const [typeName, files] of definedTypes) {
  const usedElsewhere = [...allTypeRefs.entries()].some(([file, refs]) => {
    if (files.includes(file)) return false;
    return refs.has(typeName);
  });
  const imported = [...importedNames].some((k) => k.endsWith(`:${typeName}`));
  if (!usedElsewhere && !imported) {
    const exp = allExports.find((e) => e.name === typeName && (e.kind === 'type' || e.kind === 'interface' || e.kind === 'enum'));
    if (exp) {
      if (isExcludedFromUnusedCheck(exp.file)) continue;
      violations.push({ type: 'unreferenced-type', name: typeName, file: exp.file, line: exp.line });
    }
  }
}


for (const imp of allImports) {
  if (isExcludedFromUnusedCheck(imp.sourceFile)) continue;
  const filePath = path.resolve(workspaceRoot, imp.sourceFile);
  if (!fs.existsSync(filePath)) continue;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const importLine = lines[imp.line - 1] || '';
  const usagePattern = new RegExp(`\\b${imp.name}\\b`);
  let used = false;
  for (let i = 0; i < lines.length; i++) {
    if (i === imp.line - 1) continue;
    if (usagePattern.test(lines[i])) {
      used = true;
      break;
    }
  }
  if (!used) {
    violations.push({ type: 'dead-import', name: imp.name, file: imp.sourceFile, line: imp.line });
  }
}

const unusedExports = violations.filter((v) => v.type === 'unused-export').length;
const unreferencedTypes = violations.filter((v) => v.type === 'unreferenced-type').length;
const deadImports = violations.filter((v) => v.type === 'dead-import').length;

const report: DeadCodeReport = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  summary: {
    status: violations.length > THRESHOLD ? (strict ? 'failed' : 'advisory') : 'passed',
    totalExports: allExports.length,
    totalImports: allImports.length,
    totalTypes: [...definedTypes.keys()].length,
    unusedExports,
    unreferencedTypes,
    deadImports,
  },
  violations,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('[dead-code] scanning for dead code in src/');
  console.log(`[dead-code] total exports: ${report.summary.totalExports}`);
  console.log(`[dead-code] total imports: ${report.summary.totalImports}`);
  console.log(`[dead-code] total types/interfaces: ${report.summary.totalTypes}`);
  console.log(`[dead-code] unused exports: ${unusedExports}`);
  console.log(`[dead-code] unreferenced types: ${unreferencedTypes}`);
  console.log(`[dead-code] dead imports: ${deadImports}`);
  console.log(`[dead-code] threshold: ${THRESHOLD}`);

  if (violations.length > 0) {
    const grouped = {
      'unused-export': violations.filter((v) => v.type === 'unused-export'),
      'unreferenced-type': violations.filter((v) => v.type === 'unreferenced-type'),
      'dead-import': violations.filter((v) => v.type === 'dead-import'),
    };
    for (const [type, items] of Object.entries(grouped)) {
      if (items.length === 0) continue;
      console.log(`\n[dead-code] ${type} (${items.length}):`);
      for (const item of items.slice(0, 20)) {
        console.log(`  - ${item.file}:${item.line} ${item.name}`);
      }
      if (items.length > 20) {
        console.log(`  ... and ${items.length - 20} more`);
      }
    }
  }
}

if (report.summary.status === 'failed') {
  process.exitCode = 1;
}
