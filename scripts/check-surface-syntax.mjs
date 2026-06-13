import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const root = process.cwd();
const targetDefinitions = [
  {
    id: 'ai-gateway',
    label: 'ai-gateway',
    path: path.join(root, 'src', 'ai-gateway'),
  },
  {
    id: 'web-components',
    label: 'web components',
    path: path.join(root, 'src', 'web', 'components'),
  },
];
const extensions = new Set(['.ts', '.tsx']);
const requestedTargets = process.argv
  .slice(2)
  .filter((arg) => arg.startsWith('--target='))
  .map((arg) => arg.slice('--target='.length).trim())
  .filter(Boolean);

const targetIds = new Set(targetDefinitions.map((target) => target.id));
const unknownTargets = requestedTargets.filter((target) => !targetIds.has(target));
if (unknownTargets.length > 0) {
  console.error(`[surface-syntax] target(s) desconhecidos: ${unknownTargets.join(', ')}`);
  console.error(`[surface-syntax] targets suportados: ${Array.from(targetIds).join(', ')}`);
  process.exit(1);
}

const activeTargets =
  requestedTargets.length > 0
    ? targetDefinitions.filter((target) => requestedTargets.includes(target.id))
    : targetDefinitions;

function walk(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') {
        continue;
      }
      files.push(...walk(absolute));
      continue;
    }
    if (entry.isFile() && extensions.has(path.extname(entry.name)) && !entry.name.endsWith('.d.ts')) {
      files.push(absolute);
    }
  }
  return files;
}

const files = activeTargets.flatMap((target) => walk(target.path));
const diagnostics = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  let result;
  try {
    result = ts.transpileModule(source, {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.ReactJSX,
        isolatedModules: true,
        esModuleInterop: true,
      },
    });
  } catch (error) {
    console.error(`${file} - surface syntax check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  for (const diagnostic of result.diagnostics || []) {
    if (diagnostic.category === ts.DiagnosticCategory.Error) {
      diagnostics.push(diagnostic);
    }
  }
}

if (diagnostics.length > 0) {
  for (const diagnostic of diagnostics.slice(0, 50)) {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    const location = diagnostic.file && typeof diagnostic.start === 'number'
      ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
      : null;
    const file = diagnostic.file?.fileName || 'unknown';
    const suffix = location ? `:${location.line + 1}:${location.character + 1}` : '';
    console.error(`${file}${suffix} - TS${diagnostic.code}: ${message}`);
  }
  console.error(`[surface-syntax] ${diagnostics.length} erro(s) em ${files.length} file(s).`);
  process.exit(1);
}

const labels = activeTargets.map((target) => target.label).join(', ');
console.log(`[surface-syntax] ${files.length} file(s) TS/TSX de ${labels} validados.`);
