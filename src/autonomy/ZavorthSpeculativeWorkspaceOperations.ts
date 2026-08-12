import fs from 'node:fs';
import path from 'node:path';
import { createTwoFilesPatch } from 'diff';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import type {
  ZavorthSpeculativeWorkspaceWrite,
  ZavorthSpeculativeWorkspacePatch,
} from './ZavorthSpeculativeAutonomyService.js';
import { asErrorLike } from '../utils/errorLike.js';

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

export type WorkspaceCopyStats = {
  files: number;
  bytes: number;
  skipped: string[];
};

const SENSITIVE_WORKSPACE_PATH_PATTERN =
  /(^|[\\/])(\.env(?:\.|$)|.ssh|\.aws|\.gnupg|secrets.*|credentials.*|private[-_]...key|id_rsa|id_ed25519)([\\/]|$)/i;
const BROAD_WINDOWS_ROOT_PATTERN = /^[a-z]:[\\/]...$/i;
const SYSTEM_WORKSPACE_PATH_PATTERN =
  /(^[a-z]:[\\/](windows|program files|program files \(x86\)|programdata)([\\/]|$)|^[\\/]...(etc|bin|usr|var|root)([\\/]|$))/i;

function countOccurrences(value: string, search: string): number {
  if (!search) return 0;
  let count = 0;
  let index = value.indexOf(search);
  while (index >= 0) {
    count += 1;
    index = value.indexOf(search, index + search.length);
  }
  return count;
}

export function copyWorkspace(sourceRoot: string, targetRoot: string, maxCopyFiles: number, maxCopyBytes: number): WorkspaceCopyStats {
    const stats: WorkspaceCopyStats = { files: 0, bytes: 0, skipped: [] };
    const root = path.resolve(sourceRoot);
    const copyRecursive = (sourcePath: string): void => {
      const relativePath = normalizePortablePath(path.relative(root, sourcePath));
      if (relativePath && shouldSkipCopy(relativePath, sourcePath)) {
        stats.skipped.push(relativePath);
        return;
      }
      const targetPath = WorkspaceResolver.ensurePathInsideWorkspace(targetRoot, relativePath || '.');
      const stat = fs.lstatSync(sourcePath);
      if (stat.isSymbolicLink()) {
        stats.skipped.push(relativePath ? `${relativePath} (symlink)` : '(root symlink)');
        return;
      }
      if (stat.isDirectory()) {
        fs.mkdirSync(targetPath, { recursive: true });
        for (const entry of fs.readdirSync(sourcePath)) {
          copyRecursive(path.join(sourcePath, entry));
        }
        return;
      }
      if (!stat.isFile()) {
        stats.skipped.push(relativePath);
        return;
      }
      if (stats.files + 1 > maxCopyFiles || stats.bytes + stat.size > maxCopyBytes) {
        throw new Error(`Speculative copy exceeded limits (${stats.files} files, ${stats.bytes} bytes).`);
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
      stats.files += 1;
      stats.bytes += stat.size;
    };

    copyRecursive(root);
    return stats;
  }

export function shouldSkipCopy(relativePath: string, sourcePath: string): boolean {
    const normalized = normalizePortablePath(relativePath);
    const baseName = path.basename(sourcePath);
    if (IGNORED_DIR_NAMES.has(baseName)) {
      return true;
    }
    if (IGNORED_RELATIVE_PREFIXES.some((prefix) => normalized.startsWith(normalizePortablePath(prefix)))) {
      return true;
    }
    return /\.(?:png|jpg|jpeg|gif|webp|mp4|mov|zip|tar|gz|7z|sqlite|db)$/i.test(baseName);
  }

export function applyWrite(input: {
    sandboxWorkspace: string;
    write: ZavorthSpeculativeWorkspaceWrite;
  }): { relativePath: string | null; blockedReason: string | null } {
    try {
      const targetPath = WorkspaceResolver.ensurePathInsideWorkspace(input.sandboxWorkspace, input.write.path);
      const relativePath = normalizePortablePath(path.relative(input.sandboxWorkspace, targetPath));
      const blockedReason = validateWrite(input.write, relativePath);
      if (blockedReason) {
        return { relativePath, blockedReason };
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, input.write.content, 'utf8');
      return { relativePath, blockedReason: null };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      return {
        relativePath: null,
        blockedReason: error instanceof Error ? err.message : String(error),
      };
    }
  }

export function applyPatch(input: {
    sandboxWorkspace: string;
    patch: ZavorthSpeculativeWorkspacePatch;
  }): { relativePath: string | null; blockedReason: string | null } {
    try {
      const targetPath = WorkspaceResolver.ensurePathInsideWorkspace(input.sandboxWorkspace, input.patch.path);
      const relativePath = normalizePortablePath(path.relative(input.sandboxWorkspace, targetPath));
      const blockedReason = validatePatch(input.patch, relativePath);
      if (blockedReason) {
        return { relativePath, blockedReason };
      }
      if (!fs.existsSync(targetPath)) {
        return { relativePath, blockedReason: `Patch blocked because the target file does not exist: ${relativePath}.` };
      }
      const currentContent = fs.readFileSync(targetPath, 'utf8');
      let nextContent = currentContent;
      for (const [index, hunk] of input.patch.hunks.entries()) {
        const occurrences = countOccurrences(nextContent, hunk.search);
        if (occurrences === 0) {
          return { relativePath, blockedReason: `Patch blocked because hunk ${index + 1} was not found in ${relativePath}.` };
        }
        if (occurrences > 1) {
          return { relativePath, blockedReason: `Patch blocked because hunk ${index + 1} appears ${occurrences} times in ${relativePath}.` };
        }
        nextContent = nextContent.replace(hunk.search, hunk.replace);
      }
      if (looksLikeSecret(nextContent)) {
        return { relativePath, blockedReason: 'Patch blocked because the resulting content appears to contain a secret.' };
      }
      fs.writeFileSync(targetPath, nextContent, 'utf8');
      return { relativePath, blockedReason: null };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      return {
        relativePath: null,
        blockedReason: error instanceof Error ? err.message : String(error),
      };
    }
  }

export function validateWrite(write: ZavorthSpeculativeWorkspaceWrite, relativePath: string): string | null {
    if (!relativePath || relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
      return 'Invalid write path or path outside the workspace.';
    }
    if (looksLikeSecret(relativePath) || looksLikeSecret(write.content)) {
      return 'Write blocked because the target or content appears to contain a secret.';
    }
    if (Buffer.byteLength(write.content, 'utf8') > MAX_EDIT_BYTES) {
      return 'Write blocked because it exceeds the speculative run size limit.';
    }
    return null;
  }

export function validatePatch(patch: ZavorthSpeculativeWorkspacePatch, relativePath: string): string | null {
    if (!relativePath || relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
      return 'Invalid patch path or path outside the workspace.';
    }
    if (!Array.isArray(patch.hunks) || patch.hunks.length === 0) {
      return 'Patch blocked because no structured hunks were provided.';
    }
    if (patch.hunks.length > 12) {
      return 'Patch blocked because a single file cannot exceed 12 hunks.';
    }
    for (const hunk of patch.hunks) {
      if (!hunk.search) {
        return 'Patch blocked because a hunk has an empty search value.';
      }
      if (looksLikeSecret(relativePath) || looksLikeSecret(hunk.search) || looksLikeSecret(hunk.replace)) {
        return 'Patch blocked because the target or content appears to contain a secret.';
      }
      if (Buffer.byteLength(hunk.search, 'utf8') > MAX_EDIT_BYTES || Buffer.byteLength(hunk.replace, 'utf8') > MAX_EDIT_BYTES) {
        return 'Patch blocked because it exceeds the speculative run size limit.';
      }
    }
    return null;
  }

export function buildUnifiedDiff(input: {
    originalWorkspace: string;
    sandboxWorkspace: string;
    touchedFiles: string[];
  }): string {
    const parts: string[] = [];
    for (const relativePath of input.touchedFiles) {
      const originalPath = WorkspaceResolver.ensurePathInsideWorkspace(input.originalWorkspace, relativePath);
      const sandboxPath = WorkspaceResolver.ensurePathInsideWorkspace(input.sandboxWorkspace, relativePath);
      const before = safeReadWorkspaceTextFile(originalPath);
      const after = safeReadWorkspaceTextFile(sandboxPath);
      if (before === after) {
        continue;
      }
      parts.push(createTwoFilesPatch(
        `a/${relativePath}`,
        `b/${relativePath}`,
        before,
        after,
        'original',
        'sandbox',
      ));
    }
    return clampText(parts.join('\n'), MAX_DIFF_CHARS);
  }

export function findUnsafeOriginalPath(workspaceRoot: string, relativePath: string): string | null {
    const normalized = normalizePortablePath(relativePath);
    if (!normalized || normalized.startsWith('../') || path.isAbsolute(normalized)) {
      return normalized || relativePath;
    }

    let current = path.resolve(workspaceRoot);
    for (const part of normalized.split('/').filter(Boolean)) {
      current = path.join(current, part);
      if (!fs.existsSync(current)) {
        continue;
      }
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) {
        return normalizePortablePath(path.relative(workspaceRoot, current));
      }
    }
    return null;
  }

export function safeReadWorkspaceTextFile(absolutePath: string): string {
    if (!fs.existsSync(absolutePath)) {
      return '';
    }
    const stat = fs.lstatSync(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return '';
    }
    return fs.readFileSync(absolutePath, 'utf8');
  }
