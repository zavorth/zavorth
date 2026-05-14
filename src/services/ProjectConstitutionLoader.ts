import fs from 'fs';
import path from 'path';
import type { ProjectConstitutionSnapshot } from '../contracts/PracticalAgencyContract.js';

const MAX_CONSTITUTION_CHARS = 64_000;

type ProjectConstitutionLoaderRuntime = {
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

export class ProjectConstitutionLoader {
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;

  constructor(runtime: ProjectConstitutionLoaderRuntime = {}) {
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public load(input: { workspaceRoot?: string | null; content?: string | null } = {}): ProjectConstitutionSnapshot {
    const inline = String(input.content || '').trim();
    if (inline) {
      return this.snapshot(true, null, inline);
    }
    const root = String(input.workspaceRoot || '').trim();
    if (!root) {
      return this.snapshot(false, null, '');
    }
    const target = path.resolve(root, 'ZAVORTH_PROJECT.md');
    if (!this.existsSyncImpl(target)) {
      return this.snapshot(false, target, '');
    }
    return this.snapshot(true, target, String(this.readFileSyncImpl(target, 'utf8') || '').slice(0, MAX_CONSTITUTION_CHARS));
  }

  private snapshot(found: boolean, filePath: string | null, content: string): ProjectConstitutionSnapshot {
    return {
      source: 'ProjectConstitutionLoader',
      found,
      path: filePath,
      contextHints: extractHints(content),
      policyBypassAllowed: false,
    };
  }
}

function extractHints(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => redact(line.replace(/^[-#*\s]+/, '').trim()))
    .filter((line) => line.length > 0)
    .filter((line) => /\b(ai|seguranca|security|arquitetura|prefer|regra|nunca|sempre|workspace|portugues)\b/i.test(line))
    .slice(0, 12);
}

function redact(value: string): string {
  return String(value || '')
    .replace(/\b(?:token|api[_ -]?key|secret|senha|password|chave)\s*[:=]\s*([^\s,;]+)/gi, '[redacted-secret]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{8,}\b/g, '[redacted-secret]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g, '[redacted-secret]')
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g, '[redacted-secret]')
    .slice(0, 300);
}
