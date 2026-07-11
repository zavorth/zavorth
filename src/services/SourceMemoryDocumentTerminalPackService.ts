import {
  SOURCE_MEMORY_DOCUMENT_TERMINAL_PACKAGES,
  ZAVORTH_SOURCE_MEMORY_DOCUMENT_TERMINAL_PACK_CONTRACT_VERSION,
} from '../contracts/SourceMemoryDocumentTerminalPackContract.js';
import { GovernedTerminalRuntime } from './GovernedTerminalRuntime.js';
import fs from 'node:fs';
import path from 'node:path';
import { SqliteVecMemoryBackend } from '../adapters/memory/SqliteVecMemoryBackend.js';
import type {
  SourceMemoryDocumentTerminalPackSnapshot,
  SourceMemoryDocumentTerminalPackageName,
  SourceStage5Decision,
  Stage5PackageEvidence,
} from '../contracts/SourceMemoryDocumentTerminalPackContract.js';


import { SourceDocumentExtractionService } from './SourceDocumentExtractionService.js';
import { SourceSearchFetchService } from './SourceSearchFetchService.js';
import { ShellSafetyClassifier } from './ShellSafetyClassifier.js';
import { resolveZavorthSourceRoot } from './ZavorthSourceRootResolver.js';
import { logger } from '../logger.js';

type Runtime = {
  now?: () => Date;
  sourceRoot?: string;
  zavorthRoot?: string;
  memoryDbPath?: string;
  memoryBackend?: SqliteVecMemoryBackend;
  documentService?: SourceDocumentExtractionService;
  searchFetchService?: SourceSearchFetchService;
  terminalRuntime?: GovernedTerminalRuntime;
  shellSafetyClassifier?: ShellSafetyClassifier;
};

type PackageJsonShape = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type Reference = {
  relativePath: string;
  kind: 'package-json' | 'lockfile' | 'source';
};

const GENERATED_OR_VENDOR_ROOTS = new Set([
  '.git',
  '.next',
  'build',
  'coverage',
  'dist',
  'dist-ops',
  'node_modules',
  'out',
  'target',
  'tmp',
]);

const LOCKFILE_NAMES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);
const SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.patch',
]);

export class SourceMemoryDocumentTerminalPackService {
  private readonly now: () => Date;
  private readonly sourceRoot?: string;
  private readonly zavorthRoot?: string;
  private readonly memoryDbPath?: string;
  private readonly memoryBackend?: SqliteVecMemoryBackend;
  private readonly documentService?: SourceDocumentExtractionService;
  private readonly searchFetchService?: SourceSearchFetchService;
  private readonly terminalRuntime?: GovernedTerminalRuntime;
  private readonly shellSafetyClassifier?: ShellSafetyClassifier;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sourceRoot = runtime.sourceRoot;
    this.zavorthRoot = runtime.zavorthRoot;
    this.memoryDbPath = runtime.memoryDbPath;
    this.memoryBackend = runtime.memoryBackend;
    this.documentService = runtime.documentService;
    this.searchFetchService = runtime.searchFetchService;
    this.terminalRuntime = runtime.terminalRuntime;
    this.shellSafetyClassifier = runtime.shellSafetyClassifier;
  }

  public async buildSnapshot(input: {
    sourceRoot?: string | null;
    zavorthRoot?: string | null;
  } = {}): Promise<SourceMemoryDocumentTerminalPackSnapshot> {
    const zavorthRoot = path.resolve(input.zavorthRoot || this.zavorthRoot || process.cwd());
    const sourceRoot = resolveZavorthSourceRoot({
      sourceRoot: input.sourceRoot || this.sourceRoot,
      zavorthRoot,
    });
    const packageEvidence = SOURCE_MEMORY_DOCUMENT_TERMINAL_PACKAGES.map((packageName) =>
      this.buildPackageEvidence(packageName, sourceRoot, zavorthRoot),
    );

    const createdMemoryBackend = !this.memoryBackend;
    const memoryBackend = this.memoryBackend || new SqliteVecMemoryBackend({
      now: this.now,
      dbPath: this.memoryDbPath || ':memory:',
    });
    const memoryWrite = memoryBackend.write({
      namespace: 'source-credential-vault',
      text: 'Credential vault absorbs Source memory host semantics with sqlite-backed deterministic vector recall.',
      metadata: {
        source: 'source-memory-document-terminal-pack',
        secretValuesSerialized: false,
      },
    });
    const memoryQuery = memoryBackend.query({
      namespace: 'source-credential-vault',
      query: 'sqlite vector memory recall',
      limit: 3,
    });
    const documents = (this.documentService || new SourceDocumentExtractionService({
      now: this.now,
    })).runSmoke();
    const searchFetch = this.searchFetchService || new SourceSearchFetchService({
      now: this.now,
    });
    const searchReceipts = [
      searchFetch.simulateSearch({
        query: 'Source memory document terminal pack',
        resultCount: 2,
      }),
    ];
    const classifier = this.shellSafetyClassifier || new ShellSafetyClassifier({
      now: this.now,
      allowedRoots: [zavorthRoot],
    });
    const shellSafetyReceipts = [
      classifier.classify({
        command: 'node --version',
        cwd: zavorthRoot,
      }),
      classifier.classify({
        command: 'rm -rf .',
        cwd: zavorthRoot,
      }),
    ];
    const terminal = this.terminalRuntime || new GovernedTerminalRuntime({
      now: this.now,
      classifier,
      allowedRoots: [zavorthRoot],
      enabledByDefault: false,
    });
    const terminalReceipts = [
      await terminal.run({
        command: 'node --version',
        cwd: zavorthRoot,
        allowExecution: false,
      }),
      await terminal.run({
        command: 'rm -rf .',
        cwd: zavorthRoot,
        allowExecution: true,
        approvalId: 'credential-vault-danger-check',
      }),
    ];
    const dangerousCommandsBlocked = [
      ...shellSafetyReceipts.filter((receipt) => receipt.blocked),
      ...terminalReceipts.filter((receipt) => receipt.status === 'blocked'),
    ].length;
    const packagesImplementedInZavorth = packageEvidence.filter((entry) =>
      entry.presentInZavorthPackageJson
      || entry.decision === 'implemented-zavorth-native'
      || entry.decision === 'replaced-by-existing-zavorth-capability'
      || entry.decision === 'implemented-optional-runtime',
    ).length;
    const summary = {
      packagesTracked: SOURCE_MEMORY_DOCUMENT_TERMINAL_PACKAGES.length,
      packagesPresentInSource: packageEvidence.filter((entry) => entry.presentInSource).length,
      packagesImplementedInZavorth,
      memoryReceipts: 2,
      documentArtifacts: documents.artifacts.filter((artifact) => artifact.text.trim()).length,
      searchReceipts: searchReceipts.length,
      terminalReceipts: terminalReceipts.length,
      dangerousCommandsBlocked,
      liveNetworkPerformed: false,
      liveProcessSpawnedByDefault: false,
      secretValuesSerialized: false,
    } as const;
    const status = this.resolveStatus({
      memoryWriteStatus: memoryWrite.receipt.status,
      memoryQueryResults: memoryQuery.results.length,
      documentArtifacts: summary.documentArtifacts,
      dangerousCommandsBlocked,
      terminalReceipts,
      searchReceipts,
    });
    if (createdMemoryBackend) {
      memoryBackend.close();
    }

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SOURCE_MEMORY_DOCUMENT_TERMINAL_PACK_CONTRACT_VERSION,
      status,
      gate: 'source-memory-document-terminal-pack',
      statement: 'Source memory, document, search and terminal behavior is absorbed as governed Zavorth-native runtimes with artifact-first receipts.',
      sourceRoot: normalizePath(sourceRoot),
      zavorthRoot: normalizePath(zavorthRoot),
      packageEvidence,
      memory: {
        backendId: memoryBackend.backendId,
        writeReceipt: memoryWrite.receipt,
        queryReceipt: memoryQuery.receipt,
        resultCount: memoryQuery.results.length,
      },
      documents,
      search: {
        receipts: searchReceipts,
      },
      terminal: {
        shellSafetyReceipts,
        terminalReceipts,
      },
      summary,
      policy: {
        noSourceSourceCopy: true,
        artifactFirstReceipts: true,
        memoryWriteReadReplayable: true,
        pdfAndHtmlExtractionProduceArtifacts: true,
        terminalDisabledUntilPolicyAllows: true,
        dangerousShellRequiresApproval: true,
        scopedCwdRootsRequired: true,
        proxyValuesAreRefsOnly: true,
        liveNetworkRequiresExplicitCommand: true,
      },
      commands: {
        inspect: 'npm run source-memory-document-terminal-pack --silent',
        inspectJson: 'npm run source-memory-document-terminal-pack:json --silent',
        check: 'npm run source-memory-document-terminal-pack:check --silent',
        qa: 'npm run qa:source-memory-document-terminal-pack --silent',
        liveFetch: 'npm run source-memory-document-terminal-pack -- --fetch <url> --confirm-live-network',
        terminalSmoke: 'npm run source-memory-document-terminal-pack -- --terminal <command> --cwd <path> --approval-id <id>',
        nextStage: 'Runtime gateway - Native Companion And Device Capability Pack',
      },
    };
  }

  public formatSnapshotText(snapshot: SourceMemoryDocumentTerminalPackSnapshot): string {
    const lines = [
      'Zavorth Source Memory Document Terminal Pack - Credential vault',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Packages tracked: ${snapshot.summary.packagesTracked}`,
      `Packages present in Source: ${snapshot.summary.packagesPresentInSource}`,
      `Packages implemented/replaced in Zavorth: ${snapshot.summary.packagesImplementedInZavorth}`,
      `Memory backend: ${snapshot.memory.backendId}`,
      `Memory receipts: ${snapshot.summary.memoryReceipts}`,
      `Document artifacts: ${snapshot.summary.documentArtifacts}`,
      `Search/fetch receipts: ${snapshot.summary.searchReceipts}`,
      `Terminal receipts: ${snapshot.summary.terminalReceipts}`,
      `Dangerous commands blocked: ${snapshot.summary.dangerousCommandsBlocked}`,
      `Live network performed: ${snapshot.summary.liveNetworkPerformed}`,
      `Live process spawned by default: ${snapshot.summary.liveProcessSpawnedByDefault}`,
      'Package decisions:',
    ];
    for (const entry of snapshot.packageEvidence) {
      lines.push(`- ${entry.packageName}: ${entry.decision}, source=${entry.presentInSource}, zavorthPackage=${entry.presentInZavorthPackageJson}`);
    }
    lines.push(`Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  public async runLiveFetch(input: {
    url: string;
    confirmLiveNetwork?: boolean;
  }) {
    return await (this.searchFetchService || new SourceSearchFetchService({
      now: this.now,
    })).fetchUrl(input);
  }

  public async runTerminalSmoke(input: {
    command: string;
    cwd?: string | null;
    approvalId?: string | null;
    allowExecution?: boolean;
  }) {
    const root = path.resolve(input.cwd || this.zavorthRoot || process.cwd());
    const classifier = this.shellSafetyClassifier || new ShellSafetyClassifier({
      now: this.now,
      allowedRoots: [root],
    });
    return await (this.terminalRuntime || new GovernedTerminalRuntime({
      now: this.now,
      classifier,
      allowedRoots: [root],
    })).run({
      ...input,
      cwd: root,
    });
  }

  private resolveStatus(input: {
    memoryWriteStatus: 'applied' | 'blocked';
    memoryQueryResults: number;
    documentArtifacts: number;
    dangerousCommandsBlocked: number;
    terminalReceipts: Array<{ liveProcessSpawned: boolean; status: string }>;
    searchReceipts: Array<{ liveNetworkPerformed: boolean; status: string }>;
  }): 'passed' | 'failed' {
    if (input.memoryWriteStatus !== 'applied' || input.memoryQueryResults < 1) return 'failed';
    if (input.documentArtifacts < 2) return 'failed';
    if (input.dangerousCommandsBlocked < 2) return 'failed';
    if (input.terminalReceipts.some((receipt) => receipt.liveProcessSpawned)) return 'failed';
    if (input.searchReceipts.some((receipt) => receipt.liveNetworkPerformed)) return 'failed';
    return 'passed';
  }

  private buildPackageEvidence(
    packageName: SourceMemoryDocumentTerminalPackageName,
    sourceRoot: string,
    zavorthRoot: string,
  ): Stage5PackageEvidence {
    const sourceReferences = this.findPackageReferences(sourceRoot, packageName);
    const zavorthReferences = this.findPackageReferences(zavorthRoot, packageName);
    return {
      packageName,
      presentInSource: sourceReferences.length > 0,
      presentInZavorthPackageJson: zavorthReferences.some((reference) => reference.kind === 'package-json'),
      presentInZavorthLockfile: zavorthReferences.some((reference) => reference.kind === 'lockfile'),
      sourceReferenceFiles: sourceReferences.map((reference) => reference.relativePath),
      zavorthReferenceFiles: zavorthReferences.map((reference) => reference.relativePath),
      decision: packageDecision(packageName),
    };
  }

  private findPackageReferences(root: string, packageName: SourceMemoryDocumentTerminalPackageName): Reference[] {
    if (!fs.existsSync(root)) {
      return [];
    }
    const references: Reference[] = [];
    for (const file of collectCandidateFiles(root)) {
      const text = readText(file);
      if (!text.includes(packageName)) continue;
      const relativePath = normalizePath(path.relative(root, file));
      if (path.basename(file) === 'package.json') {
        const packageJson = parseJson(text);
        if (packageJsonHasDependency(packageJson, packageName)) {
          references.push({
            relativePath: `${relativePath}${dependencySections(packageJson, packageName)}`,
            kind: 'package-json',
          });
          continue;
        }
      }
      references.push({
        relativePath,
        kind: LOCKFILE_NAMES.has(path.basename(file)) ? 'lockfile' : 'source',
      });
    }
    return dedupeReferences(references);
  }
}

function packageDecision(packageName: SourceMemoryDocumentTerminalPackageName): SourceStage5Decision {
  if (packageName === '@source/memory-host-sdk') return 'implemented-zavorth-native';
  if (packageName === 'sqlite-vec') return 'implemented-zavorth-native';
  if (packageName === 'pdfjs-dist' || packageName === '@mozilla/readability' || packageName === 'jsdom') return 'implemented';
  if (packageName === 'duck-duck-scrape' || packageName === 'proxy-agent' || packageName === 'https-proxy-agent' || packageName === 'undici') {
    return 'replaced-by-existing-zavorth-capability';
  }
  if (packageName === 'node-pty' || packageName === '@lydell/node-pty') return 'implemented-optional-runtime';
  if (packageName === 'tree-sitter-bash' || packageName === 'web-tree-sitter') return 'owner-gated';
  return 'not-needed';
}

function collectCandidateFiles(root: string): string[] {
  const files: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of readDir(current)) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (GENERATED_OR_VENDOR_ROOTS.has(entry.name)) continue;
        stack.push(absolutePath);
        continue;
      }
      if (entry.isFile() && isCandidateFile(entry.name)) {
        files.push(absolutePath);
      }
    }
  }
  return files.sort();
}

function isCandidateFile(fileName: string): boolean {
  if (fileName === 'package.json' || LOCKFILE_NAMES.has(fileName)) return true;
  return SOURCE_EXTENSIONS.has(path.extname(fileName));
}

function packageJsonHasDependency(packageJson: PackageJsonShape | null, packageName: string): boolean {
  if (!packageJson) return false;
  return dependencySectionNames().some((section) => Boolean(packageJson[section]?.[packageName]));
}

function dependencySections(packageJson: PackageJsonShape | null, packageName: string): string {
  if (!packageJson) return '';
  const sections = dependencySectionNames().filter((section) => Boolean(packageJson[section]?.[packageName]));
  return sections.length > 0 ? `#${sections.join(',')}` : '';
}

function dependencySectionNames(): Array<keyof PackageJsonShape> {
  return ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
}

function parseJson(text: string): PackageJsonShape | null {
  try {
    return JSON.parse(text) as PackageJsonShape;
  } catch (error: unknown) {logger.warn('[Source Memory Document Terminal Pack] JSON parse failed', error); return null; }
}

function dedupeReferences(references: Reference[]): Reference[] {
  const seen = new Map<string, Reference>();
  for (const reference of references) {
    seen.set(`${reference.kind}:${reference.relativePath}`, reference);
  }
  return Array.from(seen.values()).sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function readDir(absolutePath: string): fs.Dirent[] {
  try {
    return fs.readdirSync(absolutePath, { withFileTypes: true });
  } catch (error: unknown) {logger.warn('[Source Memory Document Terminal Pack] filesystem operation failed', error); return []; }
}

function readText(absolutePath: string): string {
  try {
    const stat = fs.statSync(absolutePath);
    if (stat.size > 25 * 1024 * 1024) return '';
    return fs.readFileSync(absolutePath, 'utf8');
  } catch (error: unknown) {logger.warn('[Source Memory Document Terminal Pack] filesystem operation failed', error); return ''; }
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/');
}
