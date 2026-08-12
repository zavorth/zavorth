import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import type {
  ZavorthAstContextGraph,
  ZavorthAstContextGraphFile,
  ZavorthAstContextGraphSymbol,
} from './ZavorthSpeculativeAutonomyService.js';


const MAX_VALIDATION_COMMANDS = 3;
const MAX_AST_FILES = 80;
const MAX_DIFF_CHARS = 100000;
const MAX_STDIO_CHARS = 12000;
const MAX_EDIT_BYTES = 1024 * 1024;

const IGNORED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-ops',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  '.tmp',
  'tmp',
]);

const IGNORED_RELATIVE_PREFIXES = [
  'data/runtime/',
  'data\\runtime\\',
];

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'];

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizePortablePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\//g, '/');
}

function looksLikeSecret(value: string): boolean {
  return /\b(?:\.env|id_rsa|credentials\.json|secrets.*\.json|token|secret|password|api[_-]?key|sk-[a-z0-9_-]{12,})\b/i.test(value);
}

function clampText(value: unknown, maxChars = MAX_STDIO_CHARS): string {
  const text = String(value ?? '');
  return text.length <= maxChars ? text : text.slice(0, maxChars - 20) + '\n[truncated]';
}

function normalizeSandboxIsolation(value: unknown): 'container' | 'local-copy' | 'microvm' | 'auto' {
  const text = normalizeText(value).toLowerCase();
  if (text === 'container' || text === 'docker') {
    return 'container';
  }
  if (text === 'host' || text === 'local' || text === 'local-copy') {
    return 'local-copy';
  }
  if (text === 'microvm' || text === 'firecracker') {
    return 'microvm';
  }
  return 'auto';
}



export function buildAstContextGraph(input: {
    workspaceRoot: string;
    entryFiles: string[];
    generatedAt?: string;
  }): ZavorthAstContextGraph {
    const workspaceRoot = path.resolve(input.workspaceRoot);
    const generatedAt = input.generatedAt || new Date().toISOString();
    const queue = Array.from(new Set(
      input.entryFiles
        .map((entry) => normalizeRelativeSourcePath(workspaceRoot, entry))
        .filter((entry): entry is string => Boolean(entry)),
    ));
    const visited = new Set<string>();
    const files: ZavorthAstContextGraphFile[] = [];
    const edges: ZavorthAstContextGraph['edges'] = [];

    while (queue.length > 0 && visited.size < MAX_AST_FILES) {
      const relativePath = queue.shift();
      if (!relativePath || visited.has(relativePath)) {
        continue;
      }
      visited.add(relativePath);
      const absolutePath = WorkspaceResolver.ensurePathInsideWorkspace(workspaceRoot, relativePath);
      if (!fs.existsSync(absolutePath) || !SOURCE_EXTENSIONS.includes(path.extname(absolutePath))) {
        continue;
      }
      const fileStat = fs.lstatSync(absolutePath);
      if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
        continue;
      }

      const sourceText = fs.readFileSync(absolutePath, 'utf8');
      const sourceFile = ts.createSourceFile(absolutePath, sourceText, ts.ScriptTarget.Latest, true);
      const fileRecord = inspectSourceFile({
        workspaceRoot,
        absolutePath,
        relativePath,
        sourceFile,
      });
      files.push(fileRecord);
      for (const item of fileRecord.imports) {
        edges.push({
          from: relativePath,
          to: item.resolvedPath || item.specifier,
          kind: item.external ? 'external-import' : 'relative-import',
        });
        if (item.resolvedPath && !item.external && !visited.has(item.resolvedPath)) {
          queue.push(item.resolvedPath);
        }
      }
    }

    return {
      generatedAt,
      workspaceRoot,
      entryFiles: queueIndependentEntries(input.entryFiles, workspaceRoot),
      files,
      edges,
      summary: {
        fileCount: files.length,
        edgeCount: edges.length,
        symbolCount: files.reduce((sum, file) => sum + file.symbols.length, 0),
        parseErrorCount: files.reduce((sum, file) => sum + file.parseErrors.length, 0),
      },
    };
  }

export function inspectSourceFile(input: {
    workspaceRoot: string;
    absolutePath: string;
    relativePath: string;
    sourceFile: ts.SourceFile;
  }): ZavorthAstContextGraphFile {
    const imports: ZavorthAstContextGraphFile['imports'] = [];
    const symbols: ZavorthAstContextGraphSymbol[] = [];
    const identifiers = new Set<string>();
    const parseDiagnostics = ((input.sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics || []);
    const parseErrors = parseDiagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    );

    const visit = (node: ts.Node): void => {
      const symbol = symbolFromNode(input.sourceFile, node);
      if (symbol) {
        symbols.push(symbol);
      }
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const specifier = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : null;
        if (specifier) {
          const resolvedPath = resolveRelativeImport(input.workspaceRoot, input.absolutePath, specifier);
          imports.push({
            specifier,
            resolvedPath,
            external: !specifier.startsWith('.'),
          });
        }
      }
      if (ts.isIdentifier(node) && identifiers.size < 80) {
        identifiers.add(node.text);
      }
      ts.forEachChild(node, visit);
    };

    visit(input.sourceFile);
    return {
      path: input.relativePath,
      imports,
      symbols: symbols.slice(0, 80),
      referencedIdentifiers: Array.from(identifiers).slice(0, 80),
      parseErrors,
    };
  }

export function symbolFromNode(sourceFile: ts.SourceFile, node: ts.Node): ZavorthAstContextGraphSymbol | null {
    const named = (name: ts.Node | undefined, kind: ZavorthAstContextGraphSymbol['kind']): ZavorthAstContextGraphSymbol | null => {
      if (!name || !ts.isIdentifier(name)) {
        return null;
      }
      const line = sourceFile.getLineAndCharacterOfPosition(name.getStart(sourceFile)).line + 1;
      return {
        name: name.text,
        kind,
        exported: hasExportModifier(node),
        line,
      };
    };
    if (ts.isClassDeclaration(node)) {
      return named(node.name, 'class');
    }
    if (ts.isFunctionDeclaration(node)) {
      return named(node.name, 'function');
    }
    if (ts.isInterfaceDeclaration(node)) {
      return named(node.name, 'interface');
    }
    if (ts.isTypeAliasDeclaration(node)) {
      return named(node.name, 'type');
    }
    if (ts.isEnumDeclaration(node)) {
      return named(node.name, 'enum');
    }
    if (ts.isVariableDeclaration(node)) {
      return named(node.name, 'variable');
    }
    return null;
  }

export function resolveRelativeImport(workspaceRoot: string, importerPath: string, specifier: string): string | null {
    if (!specifier.startsWith('.')) {
      return null;
    }
    const base = path.resolve(path.dirname(importerPath), specifier);
    const candidates = [
      base,
      ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
      ...SOURCE_EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
    ];
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) {
        continue;
      }
      const stat = fs.lstatSync(candidate);
      if (stat.isFile() && !stat.isSymbolicLink()) {
        return normalizePortablePath(path.relative(workspaceRoot, candidate));
      }
    }
    return null;
  }

export function normalizeRelativeSourcePath(workspaceRoot: string, entry: string): string | null {
    const trimmed = normalizeText(entry);
    if (!trimmed) {
      return null;
    }
    const absolutePath = path.isAbsolute(trimmed)
      ? trimmed
      : WorkspaceResolver.ensurePathInsideWorkspace(workspaceRoot, trimmed);
    const relativePath = normalizePortablePath(path.relative(workspaceRoot, absolutePath));
    if (relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
      return null;
    }
    return SOURCE_EXTENSIONS.includes(path.extname(relativePath)) ? relativePath : null;
  }

export function hasExportModifier(node: ts.Node): boolean {
  return Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

export function queueIndependentEntries(entries: string[], workspaceRoot: string): string[] {
  return entries
    .map((entry) => {
      const trimmed = normalizeText(entry);
      if (!trimmed) {
        return null;
      }
      const absolutePath = path.isAbsolute(trimmed) ? trimmed : path.resolve(workspaceRoot, trimmed);
      const relativePath = normalizePortablePath(path.relative(workspaceRoot, absolutePath));
      return relativePath.startsWith('../') || path.isAbsolute(relativePath) ? null : relativePath;
    })
    .filter((entry): entry is string => Boolean(entry));
}