import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import JSZip from 'jszip';
import {
  ZAVORTH_UNIVERSAL_SKILL_INTAKE_CONTRACT_VERSION,
  type ZavorthUniversalSkillCandidate,
  type ZavorthUniversalSkillCapabilityTag,
  type ZavorthUniversalSkillIntakeIssue,
  type ZavorthUniversalSkillIntakeIssueCode,
  type ZavorthUniversalSkillIntakePreview,
  type ZavorthUniversalSkillIntakeStatus,
  type ZavorthUniversalSkillManifest,
  type ZavorthUniversalSkillPermissionProfileId,
  type ZavorthUniversalSkillSourceKind,
  type ZavorthUniversalSkillSourceProfile,
  type ZavorthUniversalSkillSourceProfileId,
} from '../contracts/ZavorthUniversalSkillIntakeContract.js';
import { SkillSourceProfileRegistry } from './SkillSourceProfileRegistry.js';type Runtime = {
  now?: () => Date;
  profileRegistry?: Pick<SkillSourceProfileRegistry, 'listProfiles'>;
  existsSync?: typeof fs.existsSync;
  statSync?: typeof fs.statSync;
  lstatSync?: typeof fs.lstatSync;
  readdirSync?: typeof fs.readdirSync;
  readFileSync?: typeof fs.readFileSync;
};

export type UniversalSkillIntakePreviewInput = {
  sourcePath: string;
  sourceKind?: 'auto' | ZavorthUniversalSkillSourceKind;
  sourceLabel?: string;
  maxArchiveBytes?: number;
  maxFileBytes?: number;
  maxFiles?: number;
};

type Limits = {
  maxArchiveBytes: number;
  maxFileBytes: number;
  maxFiles: number;
};

type VirtualFile = {
  relativePath: string;
  absolutePath: string | null;
  size: number;
  text: string | null;
  hash: string | null;
  accepted: boolean;
  skipped: boolean;
};

type FileSet = {
  files: VirtualFile[];
  issues: ZavorthUniversalSkillIntakeIssue[];
  archiveBytes: number | null;
  exists: boolean;
};

type CandidateSeed = {
  sourceProfileId: ZavorthUniversalSkillSourceProfileId;
  relativeSkillPath: string;
  entrypointPath: string | null;
  manifestPath: string | null;
  files: VirtualFile[];
  synthetic?: {
    id?: string;
    name?: string;
    title?: string;
    description?: string;
    version?: string;
    tools?: unknown[];
    permissions?: unknown;
    rawText: string;
  };
};

const DEFAULT_LIMITS: Limits = {
  maxArchiveBytes: 50 * 1024 * 1024,
  maxFileBytes: 2 * 1024 * 1024,
  maxFiles: 1000,
};

const ROOT_TEXT_FILES = new Set([
  'ATTRIBUTION.md',
  'EXTERNAL_SOURCE.json',
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'OMNI_ENHANCED.json',
  'ORIGIN.json',
  'ORIGIN.md',
  'README.md',
  'SKILL.md',
  'TOOLS.md',
  'catalog.json',
  'catalog.yaml',
  'catalog.yml',
  'extension.json',
  'manifest.json',
  'mcp.json',
  'metadata.json',
  'package.json',
  'plugin.json',
  'registry.json',
  'skills.json',
  'skills.yaml',
  'skills.yml',
]);

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.yaml', '.yml']);
const SUPPORT_DIRECTORIES = new Set([
  'agents',
  'data',
  'docs',
  'examples',
  'knowledge',
  'playbooks',
  'plays',
  'prompts',
  'references',
  'steps',
  'templates',
]);
const SCRIPT_EXTENSIONS = new Set(['.bat', '.cmd', '.cjs', '.js', '.mjs', '.ps1', '.py', '.sh', '.ts', '.tsx']);
const CATALOG_FILENAMES = new Set(['catalog.json', 'catalog.yaml', 'catalog.yml', 'registry.json', 'skills.json', 'skills.yaml', 'skills.yml']);

const UNSAFE_TEXT_PATTERNS: Array<{
  code: ZavorthUniversalSkillIntakeIssueCode;
  regex: RegExp;
  message: string;
  severity: 'warn' | 'error';
}> = [
  {
    code: 'script-auto-executable',
    regex: /\b(?:curl|wget|Invoke-WebRequest|iwr)\b[\s\S]{0,100}\|\s*(?:sh|bash|iex|Invoke-Expression)\b/i,
    message: 'Chained download and execution instruction detected.',
    severity: 'error',
  },
  {
    code: 'script-auto-executable',
    regex: /(?:^|\n)\s*(?:(?:run|execute|exec|delete|remove)\b[^\n]{0,80})?\brm\s+-rf\s+\/(?:\s|$)/i,
    message: 'Destructive full-removal command detected.',
    severity: 'error',
  },
  {
    code: 'script-auto-executable',
    regex: /(?:^|\n)\s*(?:(?:run|execute|exec|delete|remove)\b[^\n]{0,80})?\bRemove-Item\s+-Recurse\s+-Force\s+(?:[A-Za-z]:\\|\/)/i,
    message: 'Destructive PowerShell command detected.',
    severity: 'error',
  },
  {
    code: 'script-auto-executable',
    regex: /(?:^|\n)\s*(?:(?:please|now|then)\s+)?(?:(?:you\s+(?:must|should|will)\s+)?)?(?:(?:ignore|bypass)[^\n]{0,80}\band\s+)?(?:steal|harvest|dump)\b[^\n]{0,100}\b(?:credential|token|cookie|password|secret|api[_ -]?key)s?\b/i,
    message: 'Explicit credential exfiltration or theft pattern detected.',
    severity: 'error',
  },
  {
    code: 'script-auto-executable',
    regex: /(?:^|\n)\s*(?:(?:please|now|then)\s+)?(?:(?:you\s+(?:must|should|will)\s+)?)?(?:(?:ignore|bypass)[^\n]{0,80}\band\s+)?exfiltrat(?:e|ed|ing)\b[^\n]{0,100}\b(?:credential|token|cookie|password|secret|api[_ -]?key)s?\b/i,
    message: 'Explicit instruction to exfiltrate credentials detected.',
    severity: 'error',
  },
  {
    code: 'script-auto-executable',
    regex: /\b(?:disable|turn off)\b[\s\S]{0,60}\b(?:defender|antivirus|security)\b/i,
    message: 'Instruction to disable security controls detected.',
    severity: 'error',
  },
  {
    code: 'suspicious-external-link',
    regex: /https?:\/\/(?:localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[0-1])\.)[^\s)"']*/i,
    message: 'Link to a local or private target detected; any future network access must require approval.',
    severity: 'warn',
  },
];

export class UniversalSkillIntakeService {
  private readonly now: () => Date;
  private readonly profileRegistry: Pick<SkillSourceProfileRegistry, 'listProfiles'>;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly statSyncImpl: typeof fs.statSync;
  private readonly lstatSyncImpl: typeof fs.lstatSync;
  private readonly readdirSyncImpl: typeof fs.readdirSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.profileRegistry = runtime.profileRegistry || new SkillSourceProfileRegistry();
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.statSyncImpl = runtime.statSync || fs.statSync.bind(fs);
    this.lstatSyncImpl = runtime.lstatSync || fs.lstatSync.bind(fs);
    this.readdirSyncImpl = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public async previewSource(input: UniversalSkillIntakePreviewInput): Promise<ZavorthUniversalSkillIntakePreview> {
    const limits = this.normalizeLimits(input);
    const sourcePath = path.resolve(input.sourcePath || '.');
    const sourceKind = this.resolveSourceKind(sourcePath, input.sourceKind || 'auto');
    const fileSet = await this.collectSourceFiles(sourcePath, sourceKind, limits);
    const seeds = this.discoverCandidateSeeds(fileSet.files);
    const candidates = this.buildCandidates({
      seeds,
      sourceKind,
      sourcePath,
      sourceIssues: fileSet.issues,
    });
    const duplicateIssues = this.applyDuplicatePolicy(candidates);
    const issues = [...fileSet.issues, ...duplicateIssues];
    const allCandidateIssues = candidates.flatMap((candidate) => candidate.issues);
    const errors = [...issues, ...allCandidateIssues].filter((issue) => issue.severity === 'error').length;
    const warnings = [...issues, ...allCandidateIssues].filter((issue) => issue.severity === 'warn').length;
    const status = this.resolveStatus(fileSet.exists, errors, warnings, candidates.length);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_UNIVERSAL_SKILL_INTAKE_CONTRACT_VERSION,
      status,
      source: {
        kind: sourceKind,
        path: sourcePath,
        label: input.sourceLabel || path.basename(sourcePath) || sourcePath,
        exists: fileSet.exists,
        archiveBytes: fileSet.archiveBytes,
      },
      limits,
      profiles: this.profileRegistry.listProfiles(),
      summary: {
        filesScanned: fileSet.files.length,
        textFilesAccepted: fileSet.files.filter((file) => file.accepted).length,
        filesSkipped: fileSet.files.filter((file) => file.skipped).length,
        candidates: candidates.length,
        blockedCandidates: candidates.filter((candidate) => candidate.status === 'blocked').length,
        sourceIssues: issues.length,
        candidateIssues: allCandidateIssues.length,
        errors,
        warnings,
        previewOnly: true,
        importPerformed: false,
        executionPerformed: false,
      },
      issues,
      candidates,
      policy: {
        previewOnly: true,
        denyByDefault: true,
        noImportPerformed: true,
        noExecutionPerformed: true,
        noUpstreamRuntimeTrust: true,
        pathTraversalBlocked: true,
        zipSlipBlocked: true,
        symlinkEscapeBlocked: true,
        binaryAndScriptFilesSkipped: true,
      },
      commands: {
        inspect: 'npm run zavorth:universal-skill-intake -- --source <path>',
        inspectJson: 'npm run zavorth:universal-skill-intake:json -- --source <path>',
        check: 'npm run zavorth:universal-skill-intake:check --silent',
        nextStage: 'Preview engine - Trust-Governed Import Pipeline',
      },
    };
  }

  public formatPreviewText(preview: ZavorthUniversalSkillIntakePreview): string {
    const lines = [
      'Zavorth Universal Skill Intake - Intent model',
      `Status: ${preview.status}`,
      `Source: ${preview.source.label} (${preview.source.kind})`,
      `Path: ${preview.source.path}`,
      `Files scanned: ${preview.summary.filesScanned}`,
      `Candidates: ${preview.summary.candidates}`,
      `Blocked candidates: ${preview.summary.blockedCandidates}`,
      `Issues: ${preview.summary.errors} error(s), ${preview.summary.warnings} warning(s)`,
      '',
      'Policy:',
      '- preview only',
      '- deny by default',
      '- no import performed',
      '- no execution performed',
      '',
      'Candidates:',
    ];

    for (const candidate of preview.candidates) {
      lines.push(
        `- ${candidate.manifest.name} [${candidate.status}]`,
        `  profile=${candidate.manifest.sourceProfileId}`,
        `  permission=${candidate.manifest.permissionProfileId}`,
        `  path=${candidate.manifest.relativeSkillPath}`,
      );
      if (candidate.blockedReason) {
        lines.push(`  blocked=${candidate.blockedReason}`);
      }
    }

    if (preview.issues.length > 0) {
      lines.push('', 'Source issues:');
      for (const issue of preview.issues.slice(0, 20)) {
        lines.push(`- [${issue.severity}] ${issue.code} ${issue.relativePath || '<source>'}: ${issue.message}`);
      }
    }

    lines.push('', `Next: ${preview.commands.nextStage}`);
    return lines.join('\n');
  }

  private normalizeLimits(input: UniversalSkillIntakePreviewInput): Limits {
    return {
      maxArchiveBytes: positiveInteger(input.maxArchiveBytes, DEFAULT_LIMITS.maxArchiveBytes),
      maxFileBytes: positiveInteger(input.maxFileBytes, DEFAULT_LIMITS.maxFileBytes),
      maxFiles: positiveInteger(input.maxFiles, DEFAULT_LIMITS.maxFiles),
    };
  }

  private resolveSourceKind(sourcePath: string, requested: 'auto' | ZavorthUniversalSkillSourceKind): ZavorthUniversalSkillSourceKind {
    if (requested === 'directory' || requested === 'zip') {
      return requested;
    }
    if (sourcePath.toLowerCase().endsWith('.zip')) {
      return 'zip';
    }
    return 'directory';
  }

  private async collectSourceFiles(
    sourcePath: string,
    sourceKind: ZavorthUniversalSkillSourceKind,
    limits: Limits,
  ): Promise<FileSet> {
    if (!this.existsSyncImpl(sourcePath)) {
      return {
        files: [],
        archiveBytes: null,
        exists: false,
        issues: [issue('error', 'missing-entrypoint', 'Skill source not found.', null, sourcePath)],
      };
    }
    if (sourceKind === 'zip') {
      return this.collectZipFiles(sourcePath, limits);
    }
    return this.collectDirectoryFiles(sourcePath, limits);
  }

  private collectDirectoryFiles(sourcePath: string, limits: Limits): FileSet {
    const files: VirtualFile[] = [];
    const issues: ZavorthUniversalSkillIntakeIssue[] = [];
    const root = path.resolve(sourcePath);
    const stack = [root];
    const chunkCounts = new Map<string, number>();

    while (stack.length > 0) {
      const current = stack.pop()!;
      let entries: fs.Dirent[];
      try {
        entries = this.readdirSyncImpl(current, { withFileTypes: true });
      } catch (error: unknown) {issues.push(issue('warn', 'unsupported-file', 'Directory cannot be read during preview.', relativeFromRoot(root, current), current));
        continue;
      }

      for (const entry of sortDirentsForDeterministicScan(entries)) {
        const absolutePath = path.join(current, entry.name);
        const relativePath = relativeFromRoot(root, absolutePath);
        if (!isSafeRelativePath(relativePath)) {
          issues.push(issue('error', 'path-traversal', 'Path would escape the source root.', relativePath, absolutePath));
          continue;
        }

        let lstat: fs.Stats;
        try {
          lstat = this.lstatSyncImpl(absolutePath);
        } catch (error: unknown) {issues.push(issue('warn', 'unsupported-file', 'File cannot be inspected.', relativePath, absolutePath));
          continue;
        }

        if (lstat.isSymbolicLink()) {
          issues.push(issue('error', 'symlink-escape', 'Symlink ignored to prevent reads outside the source.', relativePath, absolutePath));
          continue;
        }

        if (entry.isDirectory()) {
          stack.push(absolutePath);
          continue;
        }
        if (!entry.isFile()) {
          issues.push(issue('warn', 'unsupported-file', 'Non-regular entry ignored.', relativePath, absolutePath));
          continue;
        }

        if (!reserveChunkFile(chunkCounts, relativePath, limits)) {
          issues.push(issue(
            'error',
            'zip-entry-limit',
            `Chunk ${chunkKeyForRelativePath(relativePath)} exceeded the ${limits.maxFiles} file preview limit.`,
            relativePath,
            absolutePath,
          ));
          continue;
        }

        files.push(this.readVirtualFile({
          absolutePath,
          relativePath,
          size: lstat.size,
          limits,
          issues,
        }));
      }
    }

    return {
      files,
      issues,
      archiveBytes: null,
      exists: true,
    };
  }

  private async collectZipFiles(sourcePath: string, limits: Limits): Promise<FileSet> {
    const files: VirtualFile[] = [];
    const issues: ZavorthUniversalSkillIntakeIssue[] = [];
    const stat = this.statSyncImpl(sourcePath);

    if (stat.size > limits.maxArchiveBytes) {
      return {
        files,
        issues: [issue('error', 'archive-too-large', `Zip archive exceeds the ${limits.maxArchiveBytes} byte limit.`, null, sourcePath)],
        archiveBytes: stat.size,
        exists: true,
      };
    }

    const buffer = this.readFileSyncImpl(sourcePath);
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.values(zip.files)
      .sort((left, right) => left.name.localeCompare(right.name, 'en-US'));
    const chunkCounts = new Map<string, number>();

    for (const entry of entries) {
      if (entry.dir) {
        continue;
      }
      const originalName = String((entry as unknown as { unsafeOriginalName?: string }).unsafeOriginalName || entry.name);
      if (originalName !== entry.name && !normalizeZipEntryPath(originalName)) {
        issues.push(issue('error', 'zip-slip', 'Zip entry would escape the source root.', originalName, sourcePath));
        continue;
      }

      const relativePath = normalizeZipEntryPath(entry.name);
      if (!relativePath) {
        issues.push(issue('error', 'zip-slip', 'Zip entry would escape the source root.', entry.name, sourcePath));
        continue;
      }

      if (!reserveChunkFile(chunkCounts, relativePath, limits)) {
        issues.push(issue(
          'error',
          'zip-entry-limit',
          `Chunk ${chunkKeyForRelativePath(relativePath)} exceeded the ${limits.maxFiles} file preview limit.`,
          relativePath,
          sourcePath,
        ));
        continue;
      }

      const lower = relativePath.toLowerCase();
      const script = SCRIPT_EXTENSIONS.has(path.posix.extname(lower));
      const importable = this.isImportableTextPath(relativePath);
      if (script) {
        files.push(skippedVirtualFile(relativePath, null));
        issues.push(issue('error', 'script-auto-executable', 'Script executavel ignorado no preview universal.', relativePath, sourcePath));
        continue;
      }
      if (!importable) {
        files.push(skippedVirtualFile(relativePath, null));
        issues.push(issue('warn', 'unsupported-file', 'File outside the allowed text set was ignored.', relativePath, sourcePath));
        continue;
      }

      const declaredSize = Number((entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0);
      if (declaredSize > limits.maxFileBytes) {
        files.push(skippedVirtualFile(relativePath, declaredSize));
        issues.push(issue('error', 'file-too-large', `File exceeds ${limits.maxFileBytes} bytes.`, relativePath, sourcePath));
        continue;
      }

      const content = await entry.async('nodebuffer');
      if (content.byteLength > limits.maxFileBytes) {
        files.push(skippedVirtualFile(relativePath, content.byteLength));
        issues.push(issue('error', 'file-too-large', `File exceeds ${limits.maxFileBytes} bytes.`, relativePath, sourcePath));
        continue;
      }

      const text = content.toString('utf8').replace(/^\uFEFF/, '');
      if (looksBinary(text)) {
        files.push(skippedVirtualFile(relativePath, content.byteLength));
        issues.push(issue('error', 'binary-like-file', 'Text file contains null bytes or binary content.', relativePath, sourcePath));
        continue;
      }

      files.push({
        relativePath,
        absolutePath: null,
        size: content.byteLength,
        text,
        hash: sha256(text),
        accepted: true,
        skipped: false,
      });
    }

    return {
      files,
      issues,
      archiveBytes: stat.size,
      exists: true,
    };
  }

  private readVirtualFile(input: {
    absolutePath: string;
    relativePath: string;
    size: number;
    limits: Limits;
    issues: ZavorthUniversalSkillIntakeIssue[];
  }): VirtualFile {
    const lower = input.relativePath.toLowerCase();
    const script = SCRIPT_EXTENSIONS.has(path.extname(lower));
    const importable = this.isImportableTextPath(input.relativePath);

    if (script) {
      input.issues.push(issue('error', 'script-auto-executable', 'Script executavel ignorado no preview universal.', input.relativePath, input.absolutePath));
      return skippedVirtualFile(input.relativePath, input.size, input.absolutePath);
    }
    if (!importable) {
      input.issues.push(issue('warn', 'unsupported-file', 'File outside the allowed text set was ignored.', input.relativePath, input.absolutePath));
      return skippedVirtualFile(input.relativePath, input.size, input.absolutePath);
    }
    if (input.size > input.limits.maxFileBytes) {
      input.issues.push(issue('error', 'file-too-large', `File exceeds ${input.limits.maxFileBytes} bytes.`, input.relativePath, input.absolutePath));
      return skippedVirtualFile(input.relativePath, input.size, input.absolutePath);
    }

    const text = this.readFileSyncImpl(input.absolutePath, 'utf8').replace(/^\uFEFF/, '');
    if (looksBinary(text)) {
      input.issues.push(issue('error', 'binary-like-file', 'Text file contains null bytes or binary content.', input.relativePath, input.absolutePath));
      return skippedVirtualFile(input.relativePath, input.size, input.absolutePath);
    }

    return {
      relativePath: normalizeRelativePath(input.relativePath),
      absolutePath: input.absolutePath,
      size: input.size,
      text,
      hash: sha256(text),
      accepted: true,
      skipped: false,
    };
  }

  private isImportableTextPath(relativePath: string): boolean {
    const normalized = normalizeRelativePath(relativePath);
    const basename = path.posix.basename(normalized);
    const ext = path.posix.extname(normalized).toLowerCase();
    if (!normalized.includes('/')) {
      return ROOT_TEXT_FILES.has(basename) || basename.endsWith('.plugin.json') || TEXT_EXTENSIONS.has(ext);
    }
    const segments = normalized.split('/');
    if (segments.some((segment) => SUPPORT_DIRECTORIES.has(segment))) {
      return TEXT_EXTENSIONS.has(ext);
    }
    return ROOT_TEXT_FILES.has(basename) || basename.endsWith('.plugin.json');
  }

  private discoverCandidateSeeds(files: VirtualFile[]): CandidateSeed[] {
    const acceptedFiles = files.filter((file) => file.accepted && file.text !== null);
    const byPath = new Map(acceptedFiles.map((file) => [file.relativePath, file]));
    const seeds: CandidateSeed[] = [];
    const skillRoots = new Set<string>();

    for (const file of acceptedFiles) {
      if (path.posix.basename(file.relativePath) === 'SKILL.md') {
        const root = dirnameOrDot(file.relativePath);
        skillRoots.add(root);
        seeds.push({
          sourceProfileId: this.resolveSkillMdProfile(root, acceptedFiles),
          relativeSkillPath: root,
          entrypointPath: file.relativePath,
          manifestPath: file.relativePath,
          files: filesUnderRoot(acceptedFiles, root),
        });
      }
    }

    for (const file of acceptedFiles) {
      const basename = path.posix.basename(file.relativePath);
      if (CATALOG_FILENAMES.has(basename)) {
        seeds.push(...this.catalogSeeds(file));
        continue;
      }

      if (skillRoots.has(dirnameOrDot(file.relativePath))) {
        continue;
      }

      if (isManifestFile(file.relativePath)) {
        const root = dirnameOrDot(file.relativePath);
        seeds.push({
          sourceProfileId: this.resolveManifestProfile(file),
          relativeSkillPath: root,
          entrypointPath: file.relativePath,
          manifestPath: file.relativePath,
          files: root === '.' ? [file] : filesUnderRoot(acceptedFiles, root),
        });
      }
    }

    for (const file of acceptedFiles) {
      const basename = path.posix.basename(file.relativePath);
      if (basename === 'SKILL.md' || basename === 'README.md' || basename === 'TOOLS.md') {
        continue;
      }
      if (path.posix.extname(file.relativePath).toLowerCase() !== '.md') {
        continue;
      }
      const root = dirnameOrDot(file.relativePath);
      if (skillRoots.has(root) || seeds.some((seed) => seed.entrypointPath === file.relativePath)) {
        continue;
      }
      if (Array.from(skillRoots.values()).some((skillRoot) => isPathInsideRoot(file.relativePath, skillRoot))) {
        continue;
      }
      if (!extractMarkdownTitle(file.text || '')) {
        continue;
      }
      seeds.push({
        sourceProfileId: 'generic-markdown',
        relativeSkillPath: file.relativePath,
        entrypointPath: file.relativePath,
        manifestPath: file.relativePath,
        files: [file],
      });
    }

    return seeds;
  }

  private catalogSeeds(file: VirtualFile): CandidateSeed[] {
    const parsed = parseDataFile(file.text || '', file.relativePath);
    const rawItems = Array.isArray(parsed)
      ? parsed
      : objectValueArray(parsed, 'skills') || objectValueArray(parsed, 'items') || objectValueArray(parsed, 'capabilities') || [];

    return rawItems
      .filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === 'object' && !Array.isArray(entry))
      .map((entry, index) => ({
        sourceProfileId: 'json-yaml-catalog' as const,
        relativeSkillPath: `${dirnameOrDot(file.relativePath)}#${safeId(String(entry.name || entry.title || entry.id || `catalog-entry-${index + 1}`))}`,
        entrypointPath: file.relativePath,
        manifestPath: file.relativePath,
        files: [file],
        synthetic: {
          id: stringOrUndefined(entry.id),
          name: stringOrUndefined(entry.name),
          title: stringOrUndefined(entry.title),
          description: stringOrUndefined(entry.description || entry.summary),
          version: stringOrUndefined(entry.version),
          tools: Array.isArray(entry.tools) ? entry.tools : Array.isArray(entry.commands) ? entry.commands : [],
          permissions: entry.permissions,
          rawText: JSON.stringify(entry),
        },
      }));
  }

  private resolveSkillMdProfile(root: string, files: VirtualFile[]): ZavorthUniversalSkillSourceProfileId {
    const rootFiles = filesUnderRoot(files, root).map((file) => file.relativePath);
    if (rootFiles.some((entry) => entry.endsWith('/OMNI_ENHANCED.json') || entry.endsWith('/EXTERNAL_SOURCE.json') || entry.endsWith('/metadata.json'))) {
      return 'omni-skill';
    }
    if (normalizeRelativePath(root).includes('.codex/skills')) {
      return 'codex-skill';
    }
    if (rootFiles.some((entry) => entry.includes('/agents/'))) {
      return 'agent-skill';
    }
    return 'skill-md';
  }

  private resolveManifestProfile(file: VirtualFile): ZavorthUniversalSkillSourceProfileId {
    const basename = path.posix.basename(file.relativePath);
    const parsed = parseDataFile(file.text || '', file.relativePath);
    const text = `${basename} ${JSON.stringify(parsed || {})}`.toLowerCase();

    if (basename === 'mcp.json' || basename === 'TOOLS.md' || text.includes('"resources"') || text.includes('"tools"')) {
      return 'mcp-tool-pack';
    }
    if (basename.endsWith('.plugin.json') || basename === 'extension.json') {
      return 'agent-extension';
    }
    if (basename === 'plugin.json') {
      return 'plugin-manifest';
    }
    return 'plugin-manifest';
  }

  private buildCandidates(input: {
    seeds: CandidateSeed[];
    sourceKind: ZavorthUniversalSkillSourceKind;
    sourcePath: string;
    sourceIssues: ZavorthUniversalSkillIntakeIssue[];
  }): ZavorthUniversalSkillCandidate[] {
    return input.seeds.map((seed) => {
      const candidateIssues = this.buildCandidateIssues(seed, input.sourceIssues);
      const manifest = this.buildManifest(seed, input.sourceKind, input.sourcePath, candidateIssues);
      const error = candidateIssues.find((entry) => entry.severity === 'error');
      return {
        id: manifest.id,
        status: error ? 'blocked' : 'candidate',
        blockedReason: error?.message || null,
        manifest,
        issues: candidateIssues,
      };
    });
  }

  private buildManifest(
    seed: CandidateSeed,
    sourceKind: ZavorthUniversalSkillSourceKind,
    sourcePath: string,
    candidateIssues: ZavorthUniversalSkillIntakeIssue[],
  ): ZavorthUniversalSkillManifest {
    const entrypoint = seed.entrypointPath ? seed.files.find((file) => file.relativePath === seed.entrypointPath) || seed.files[0] : seed.files[0];
    const entryText = seed.synthetic?.rawText || entrypoint?.text || '';
    const parsed = this.parseSeedMetadata(seed, entryText);
    const declaredTools = uniqueStrings([
      ...(seed.synthetic?.tools || []).map((value) => String(value)),
      ...extractDeclaredTools(entryText),
    ]);
    const combinedText = `${entryText}\n${seed.files.map((file) => file.text || '').join('\n')}\n${declaredTools.join(' ')}`;
    const permissionProfileId = this.inferPermissionProfile(combinedText, declaredTools, candidateIssues);
    const capabilityTags = this.inferCapabilityTags(combinedText, seed.sourceProfileId);
    const supportFiles = seed.files
      .map((file) => file.relativePath)
      .filter((relativePath) => relativePath !== seed.entrypointPath && relativePath !== seed.manifestPath)
      .sort((left, right) => left.localeCompare(right, 'en-US'));
    const name = parsed.name || parsed.title || path.posix.basename(seed.relativeSkillPath).replace(/\.md$/i, '') || 'External skill';
    const description = parsed.description || firstSentence(entryText) || 'External skill candidate discovered by universal intake.';
    const id = `universal-skill:${safeId(seed.synthetic?.id || name)}`;
    const contentHash = sha256([
      seed.sourceProfileId,
      seed.relativeSkillPath,
      entryText,
      ...seed.files.map((file) => `${file.relativePath}:${file.hash || ''}`),
    ].join('\n'));
    const bundleTags = uniqueStrings([seed.sourceProfileId, ...capabilityTags]);

    return {
      id,
      name,
      description,
      version: parsed.version || seed.synthetic?.version || null,
      sourceProfileId: seed.sourceProfileId,
      sourceKind,
      sourceRootPath: sourcePath,
      relativeSkillPath: seed.relativeSkillPath,
      entrypointPath: seed.entrypointPath,
      manifestPath: seed.manifestPath,
      supportFiles,
      declaredTools,
      permissionProfileId,
      capabilityTags,
      contentHash,
      catalogProjection: {
        name,
        description,
        searchText: `${name} ${description} ${bundleTags.join(' ')}`.toLowerCase(),
        bundleTags,
        supportFileCount: supportFiles.length,
      },
      notes: [
        'Intent model preview only: no import, no execution, no upstream trust.',
        `Profile: ${seed.sourceProfileId}.`,
      ],
    };
  }

  private parseSeedMetadata(seed: CandidateSeed, entryText: string): {
    name: string | null;
    title: string | null;
    description: string | null;
    version: string | null;
  } {
    if (seed.synthetic) {
      return {
        name: seed.synthetic.name || null,
        title: seed.synthetic.title || null,
        description: seed.synthetic.description || null,
        version: seed.synthetic.version || null,
      };
    }

    if (seed.sourceProfileId === 'generic-markdown' || seed.entrypointPath?.endsWith('.md')) {
      const frontmatter = parseFrontmatter(entryText);
      return {
        name: stringOrNull(frontmatter.name) || extractMarkdownTitle(entryText),
        title: stringOrNull(frontmatter.title),
        description: stringOrNull(frontmatter.description) || firstParagraph(entryText),
        version: stringOrNull(frontmatter.version),
      };
    }

    const parsed = parseDataFile(entryText, seed.entrypointPath || '');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      return {
        name: stringOrNull(record.name),
        title: stringOrNull(record.title || record.displayName),
        description: stringOrNull(record.description || record.summary),
        version: stringOrNull(record.version),
      };
    }

    return {
      name: null,
      title: null,
      description: null,
      version: null,
    };
  }

  private buildCandidateIssues(
    seed: CandidateSeed,
    sourceIssues: ZavorthUniversalSkillIntakeIssue[],
  ): ZavorthUniversalSkillIntakeIssue[] {
    const root = seed.relativeSkillPath.includes('#') || seed.sourceProfileId === 'generic-markdown'
      ? dirnameOrDot(seed.entrypointPath || seed.relativeSkillPath)
      : seed.relativeSkillPath;
    const issues = sourceIssues.filter((entry) => (
      entry.relativePath !== null && isPathInsideRoot(entry.relativePath, root)
    ));

    if (!seed.entrypointPath && !seed.synthetic) {
      issues.push(issue('error', 'missing-entrypoint', 'Candidate has no inspectable entrypoint.', seed.relativeSkillPath));
    }

    for (const file of seed.files) {
      const text = file.text || '';
      for (const pattern of UNSAFE_TEXT_PATTERNS) {
        if (pattern.regex.test(text)) {
          issues.push(issue(pattern.severity, pattern.code, pattern.message, file.relativePath, file.absolutePath));
        }
      }
    }

    if (seed.sourceProfileId === 'json-yaml-catalog' && !seed.synthetic?.name && !seed.synthetic?.title) {
      issues.push(issue('warn', 'catalog-entry-invalid', 'Catalog entry has no name/title; a safe id will be inferred.', seed.entrypointPath));
    }

    return dedupeIssues(issues);
  }

  private inferPermissionProfile(
    text: string,
    declaredTools: string[],
    issues: ZavorthUniversalSkillIntakeIssue[],
  ): ZavorthUniversalSkillPermissionProfileId {
    if (issues.some((entry) => entry.severity === 'error')) {
      return 'blocked';
    }

    const normalized = `${text} ${declaredTools.join(' ')}`.toLowerCase();
    if (/\b(oauth|token|api[_ -]?key|secret|credential|webhook)\b/.test(normalized)) {
      return 'connector-live-secretref';
    }
    if (/\b(shell|exec|execute|command|docker|mcp|tool|spawn|process)\b/.test(normalized)) {
      return 'tool-execution-approval';
    }
    if (/\b(write|edit|delete|remove|commit|deploy|publish|upload|mutate|patch)\b/.test(normalized)) {
      return 'workspace-write-approval';
    }
    if (/\b(fetch|http|https|web|network|search|crawl|scrape|browser)\b/.test(normalized)) {
      return 'network-read-approval';
    }
    if (/\b(read|files?|workspace|documents?|docs?|repo|repository)\b/.test(normalized)) {
      return 'workspace-read';
    }
    return 'local-readonly';
  }

  private inferCapabilityTags(
    text: string,
    profileId: ZavorthUniversalSkillSourceProfileId,
  ): ZavorthUniversalSkillCapabilityTag[] {
    const normalized = text.toLowerCase();
    const tags = new Set<ZavorthUniversalSkillCapabilityTag>();
    if (profileId === 'mcp-tool-pack') tags.add('mcp');
    if (profileId === 'plugin-manifest' || profileId === 'agent-extension') tags.add('plugin');
    if (/\b(browser|chrome|page|dom|screenshot)\b/.test(normalized)) tags.add('browser');
    if (/\b(code|repo|typescript|javascript|python|debug|test)\b/.test(normalized)) tags.add('code');
    if (/\b(data|csv|json|database|sql)\b/.test(normalized)) tags.add('data');
    if (/\b(doc|document|pdf|markdown|report)\b/.test(normalized)) tags.add('document');
    if (/\b(research|search|investigate|evidence)\b/.test(normalized)) tags.add('research');
    if (/\b(security|threat|risk|audit|vulnerability)\b/.test(normalized)) tags.add('security');
    if (/\b(slack|telegram|discord|gmail|calendar|connector|oauth)\b/.test(normalized)) tags.add('app-connector');
    if (/\b(automation|workflow|runbook|process)\b/.test(normalized)) tags.add('workflow');
    if (/\b(shell|exec|command|tool)\b/.test(normalized)) tags.add('automation');
    if (tags.size === 0) tags.add('workflow');
    return Array.from(tags.values()).sort((left, right) => left.localeCompare(right, 'en-US'));
  }

  private applyDuplicatePolicy(candidates: ZavorthUniversalSkillCandidate[]): ZavorthUniversalSkillIntakeIssue[] {
    const seen = new Map<string, ZavorthUniversalSkillCandidate>();
    const issues: ZavorthUniversalSkillIntakeIssue[] = [];

    for (const candidate of candidates) {
      const existing = seen.get(candidate.id);
      if (!existing) {
        seen.set(candidate.id, candidate);
        continue;
      }
      const duplicateIssue = issue(
        'error',
        'duplicate-skill',
        `Skill duplicada conflita com ${existing.manifest.relativeSkillPath}.`,
        candidate.manifest.relativeSkillPath,
      );
      candidate.issues.push(duplicateIssue);
      candidate.status = 'blocked';
      candidate.blockedReason = duplicateIssue.message;
      candidate.manifest.permissionProfileId = 'blocked';
      issues.push(duplicateIssue);
    }

    return issues;
  }

  private resolveStatus(
    exists: boolean,
    errors: number,
    warnings: number,
    candidates: number,
  ): ZavorthUniversalSkillIntakeStatus {
    if (!exists || errors > 0 || candidates === 0) {
      return 'fail';
    }
    if (warnings > 0) {
      return 'warn';
    }
    return 'pass';
  }
}

function issue(
  severity: ZavorthUniversalSkillIntakeIssue['severity'],
  code: ZavorthUniversalSkillIntakeIssueCode,
  message: string,
  relativePath: string | null,
  sourcePath: string | null = null,
): ZavorthUniversalSkillIntakeIssue {
  return {
    severity,
    code,
    message,
    relativePath: relativePath ? normalizeRelativePath(relativePath) : null,
    sourcePath,
  };
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
}

function normalizeRelativePath(value: string): string {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function normalizeZipEntryPath(value: string): string | null {
  const raw = normalizeRelativePath(value);
  if (!raw || raw.startsWith('/') || /^[A-Za-z]:\//.test(raw)) {
    return null;
  }
  const parts = raw.split('/').filter(Boolean);
  if (parts.some((part) => part === '..')) {
    return null;
  }
  const normalized = path.posix.normalize(parts.join('/'));
  if (!isSafeRelativePath(normalized)) {
    return null;
  }
  return normalized;
}

function isSafeRelativePath(value: string): boolean {
  const normalized = normalizeRelativePath(value);
  return Boolean(normalized)
    && !normalized.startsWith('../')
    && normalized !== '..'
    && !path.isAbsolute(normalized)
    && !/^[A-Za-z]:\//.test(normalized)
    && !normalized.split('/').includes('..');
}

function relativeFromRoot(root: string, absolutePath: string): string {
  return normalizeRelativePath(path.relative(root, absolutePath)) || '.';
}

function dirnameOrDot(relativePath: string): string {
  const dir = path.posix.dirname(normalizeRelativePath(relativePath));
  return dir === '.' ? '.' : dir;
}

function filesUnderRoot(files: VirtualFile[], root: string): VirtualFile[] {
  return files.filter((file) => isPathInsideRoot(file.relativePath, root));
}

function isPathInsideRoot(relativePath: string, root: string): boolean {
  const normalizedPath = normalizeRelativePath(relativePath);
  const normalizedRoot = normalizeRelativePath(root);
  if (normalizedRoot === '.' || normalizedRoot === '') {
    return !normalizedPath.includes('/') || normalizedPath.length > 0;
  }
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function sortDirentsForDeterministicScan(entries: fs.Dirent[]): fs.Dirent[] {
  return [...entries].sort((left, right) => {
    if (left.isDirectory() !== right.isDirectory()) {
      return left.isDirectory() ? -1 : 1;
    }
    return left.name.localeCompare(right.name, 'en-US');
  });
}

function reserveChunkFile(
  chunkCounts: Map<string, number>,
  relativePath: string,
  limits: Limits,
): boolean {
  const chunkKey = chunkKeyForRelativePath(relativePath);
  const current = chunkCounts.get(chunkKey) || 0;
  if (current >= limits.maxFiles) {
    return false;
  }
  chunkCounts.set(chunkKey, current + 1);
  return true;
}

function chunkKeyForRelativePath(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) {
    return '.';
  }
  if (segments.length === 1) {
    return segments[0];
  }
  const skillRootIndex = segments.findIndex((segment, index) =>
    segment === 'skills' && index < segments.length - 1);
  if (skillRootIndex >= 0) {
    return segments.slice(0, skillRootIndex + 2).join('/');
  }
  if (segments[0] === 'skill-library' && segments[1] === 'imported' && segments[2]) {
    return segments.slice(0, 3).join('/');
  }
  if (segments[0] === 'skill-library' && segments[1]) {
    return segments.slice(0, 2).join('/');
  }
  return segments[0];
}

function isManifestFile(relativePath: string): boolean {
  const basename = path.posix.basename(relativePath);
  return basename === 'manifest.json'
    || basename === 'plugin.json'
    || basename === 'extension.json'
    || basename === 'mcp.json'
    || basename === 'package.json'
    || basename === 'TOOLS.md'
    || basename.endsWith('.plugin.json');
}

function parseDataFile(text: string, relativePath: string): unknown {
  const ext = path.posix.extname(relativePath).toLowerCase();
  try {
    if (ext === '.yaml' || ext === '.yml') {
      return yaml.load(text);
    }
    if (ext === '.json') {
      return JSON.parse(text);
    }
  } catch (error: unknown) {return null;
  }
  return null;
}

function objectValueArray(value: unknown, key: string): unknown[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidate = (value as Record<string, unknown>)[key];
  return Array.isArray(candidate) ? candidate : null;
}

function parseFrontmatter(text: string): Record<string, unknown> {
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return {};
  }
  try {
    const parsed = yaml.load(match[1]);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch (error: unknown) {return {};
  }
}

function extractMarkdownTitle(text: string): string | null {
  const frontmatter = parseFrontmatter(text);
  const frontmatterName = stringOrNull(frontmatter.name || frontmatter.title);
  if (frontmatterName) {
    return frontmatterName;
  }
  const withoutFrontmatter = text.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*/, '');
  const match = withoutFrontmatter.match(/^\s*#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function firstParagraph(text: string): string | null {
  const withoutFrontmatter = text.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*/, '');
  const paragraphs = withoutFrontmatter
    .split(/\r?\n\r?\n/g)
    .map((entry) => entry.replace(/^#+\s+/gm, '').trim())
    .filter(Boolean);
  return paragraphs.find((entry) => !entry.startsWith('```')) || null;
}

function firstSentence(text: string): string | null {
  const paragraph = firstParagraph(text);
  if (!paragraph) {
    return null;
  }
  const sentence = paragraph.split(/(?<=[.!?])\s+/)[0]?.trim();
  return sentence || paragraph.slice(0, 180);
}

function extractDeclaredTools(text: string): string[] {
  const values = new Set<string>();
  const frontmatter = parseFrontmatter(text);
  const tools = Array.isArray(frontmatter.tools) ? frontmatter.tools : [];
  for (const tool of tools) {
    const normalized = String(tool || '').trim();
    if (normalized) values.add(normalized);
  }
  for (const match of text.matchAll(/\b(?:tool|command|mcp)\s*[:=]\s*([A-Za-z0-9_.:-]+)/gi)) {
    values.add(match[1]);
  }
  return Array.from(values.values());
}

function stringOrNull(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function stringOrUndefined(value: unknown): string | undefined {
  return stringOrNull(value) || undefined;
}

function safeId(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'skill';
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, 'en-US'));
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function looksBinary(text: string): boolean {
  return text.includes('\u0000');
}

function skippedVirtualFile(relativePath: string, size: number | null, absolutePath: string | null = null): VirtualFile {
  return {
    relativePath: normalizeRelativePath(relativePath),
    absolutePath,
    size: size || 0,
    text: null,
    hash: null,
    accepted: false,
    skipped: true,
  };
}

function dedupeIssues(issues: ZavorthUniversalSkillIntakeIssue[]): ZavorthUniversalSkillIntakeIssue[] {
  const seen = new Set<string>();
  const deduped: ZavorthUniversalSkillIntakeIssue[] = [];
  for (const entry of issues) {
    const key = `${entry.severity}:${entry.code}:${entry.relativePath}:${entry.message}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }
  return deduped;
}
