import fs from 'node:fs';
import path from 'node:path';

type ModuleNode = {
  path: string;
  imports: string[];
};

type ImportGraphReport = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    status: 'passed' | 'failed';
    totalModules: number;
    totalEdges: number;
    circularDependencies: number;
  };
  circularDependencies: string[][];
  modules: ModuleNode[];
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const asDot = argv.includes('--dot');
const workspaceRoot = process.cwd();
const sourceRoot = path.join(workspaceRoot, 'src');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', 'coverage', '.git']);

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

function resolveImport(fromFile: string, importPath: string): string | null {
  if (!importPath.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), importPath);
  const candidates = [
    base + '.ts',
    base + '.tsx',
    base + '.js',
    base + '.jsx',
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return path.relative(workspaceRoot, c).replace(/\\/g, '/');
    }
  }
  return null;
}

function extractImports(filePath: string, content: string): string[] {
  const imports: string[] = [];
  const regex = /(?:import|export)\s+(?:.*...\s+from\s+)...['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const resolved = resolveImport(filePath, match[1]);
    if (resolved) {
      imports.push(resolved);
    }
  }
  return imports;
}

function detectCycles(modules: ModuleNode[]): string[][] {
  const adjList = new Map<string, string[]>();
  for (const mod of modules) {
    adjList.set(mod.path, mod.imports);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const pathStack: string[] = [];

  function dfs(node: string) {
    if (inStack.has(node)) {
      const cycleStart = pathStack.indexOf(node);
      if (cycleStart >= 0) {
        const cycle = pathStack.slice(cycleStart).concat(node);
        const cycleKey = [...cycle].sort().join('->');
        const isDuplicate = cycles.some((c) => [...c].sort().join('->') === cycleKey);
        if (!isDuplicate) {
          cycles.push(cycle);
        }
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    pathStack.push(node);

    const neighbors = adjList.get(node) || [];
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }

    pathStack.pop();
    inStack.delete(node);
  }

  for (const mod of modules) {
    dfs(mod.path);
  }

  return cycles;
}

function generateDot(modules: ModuleNode[], cycles: string[][]): string {
  const cycleEdges = new Set<string>();
  for (const cycle of cycles) {
    for (let i = 0; i < cycle.length - 1; i++) {
      cycleEdges.add(`${cycle[i]}->${cycle[i + 1]}`);
    }
  }

  const lines = ['digraph imports {', '  rankdir=LR;', '  node [shape=box];'];
  for (const mod of modules) {
    const label = mod.path.replace(/\//g, '/').replace(/\.tsx...$/, '');
    lines.push(`  "${mod.path}" [label="${label}"];`);
    for (const imp of mod.imports) {
      const edgeKey = `${mod.path}->${imp}`;
      if (cycleEdges.has(edgeKey)) {
        lines.push(`  "${mod.path}" -> "${imp}" [color=red, penwidth=2];`);
      } else {
        lines.push(`  "${mod.path}" -> "${imp}";`);
      }
    }
  }
  lines.push('}');
  return lines.join('\n');
}

const allFiles = walk(sourceRoot);
const modules: ModuleNode[] = [];

for (const filePath of allFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
  const imports = extractImports(filePath, content);
  modules.push({ path: relPath, imports });
}

const totalEdges = modules.reduce((sum, m) => sum + m.imports.length, 0);
const circularDependencies = detectCycles(modules);

const report: ImportGraphReport = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  summary: {
    status: circularDependencies.length > 0 ? 'failed' : 'passed',
    totalModules: modules.length,
    totalEdges,
    circularDependencies: circularDependencies.length,
  },
  circularDependencies,
  modules,
};

if (asDot) {
  console.log(generateDot(modules, circularDependencies));
} else if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('[import-graph] building dependency graph for src/');
  console.log(`[import-graph] total modules: ${modules.length}`);
  console.log(`[import-graph] total edges: ${totalEdges}`);
  console.log(`[import-graph] circular dependencies: ${circularDependencies.length}`);

  if (circularDependencies.length > 0) {
    console.log('\n[import-graph] circular dependencies detected:');
    for (const cycle of circularDependencies) {
      console.log(`  - ${cycle.join(' -> ')}`);
    }
  }
}

if (report.summary.status === 'failed') {
  process.exitCode = 1;
}
