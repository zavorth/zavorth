import fs from 'fs';
import path from 'path';


const ROOT = path.resolve(__dirname, '..', '..');
const INSPECTED_DIRS = [
  'src/adapters',
  'src/agents',
  'src/core',
  'src/execution',
  'src/orchestrator',
  'src/providers',
  'src/services',
  'src/telegram',
  'src/tools',
];

// Segments for exclusion - using path.sep for correct Windows path matching
const ADAPTERS_SEARCH_SEG = `${path.sep}adapters${path.sep}search${path.sep}`;
const SEARCHQUERY_SERVICE_SEG = `${path.sep}services${path.sep}SearchQueryService${path.sep}`;

// Arquivos específicos que legitimamente usam fetch para seeds e queries
const EXCLUDED_FILES = [
  'SeedSourceRegistry.ts',
  'SearchQueryService.ts',
];

const EXCLUDED_SEGMENTS = [
  `${path.sep}web-console-runtime-shell-script${path.sep}`,
  // Adaptadores e serviços que precisam de fetch para funcionalidade externa
  // (busca, RSS, fontes de seeds, queries de serviço)
  ADAPTERS_SEARCH_SEG,
  SEARCHQUERY_SERVICE_SEG,
];

function shouldExcludeFile(fullPath: string): boolean {
  // Verificar por segmentos de diretório
  if (EXCLUDED_SEGMENTS.some((segment) => fullPath.includes(segment))) {
    return true;
  }
  
  // Verificar por nomes de arquivo específicos
  const fileName = path.basename(fullPath);
  if (EXCLUDED_FILES.includes(fileName)) {
    return true;
  }
  
  return false;
}

function listSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (shouldExcludeFile(fullPath)) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Outbound egress perimeter', () => {
  it('does not use raw fetch in agent/server runtime paths', () => {
    const violations = INSPECTED_DIRS
      .flatMap((dir) => listSourceFiles(path.join(ROOT, dir)))
      .flatMap((file) => {
        const content = fs.readFileSync(file, 'utf8');
        return content.split(/\r?\n/)
          .map((line, index) => ({ file, line, lineNumber: index + 1 }))
          .filter(({ line }) => {
            if (!/\bfetch\s*\(/.test(line)) return false;
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
            if (/['"`].*\bfetch\s*\(/.test(trimmed) && !trimmed.includes('await')) return false;
            if (/\.\s*fetch\s*\(/.test(trimmed)) return false;
            return true;
          })
          .map(({ file, line, lineNumber }) => `${path.relative(ROOT, file)}:${lineNumber}: ${line.trim()}`);
      });

    expect(violations).toEqual([]);
  });
});