import fs from 'fs';
import path from 'path';

export type SkillContentScanIssue = {
  severity: 'error' | 'warn';
  code:
    | 'unsupported-file'
    | 'unsafe-pattern'
    | 'binary-like-file'
    | 'symlink-file'
    | 'missing-entrypoint';
  filePath: string;
  relativePath: string;
  message: string;
};

export type SkillContentScanResult = {
  safeToImport: boolean;
  issues: SkillContentScanIssue[];
  importableFiles: string[];
  skippedFiles: string[];
};

type SkillContentScannerRuntime = {
  existsSync?: typeof fs.existsSync;
  readdirSync?: typeof fs.readdirSync;
  readFileSync?: typeof fs.readFileSync;
  lstatSync?: typeof fs.lstatSync;
  statSync?: typeof fs.statSync;
};

const IMPORTABLE_ROOT_FILES = new Set([
  'SKILL.md',
  'README.md',
  'USO.md',
  'workflow.md',
  'ATTRIBUTION.md',
  'ORIGIN.md',
  'EXTERNAL_SOURCE.json',
  'metadata.json',
  'OMNI_ENHANCED.json',
  'LICENSE.txt',
  'LICENSE.md',
  'LICENSE',
]);
const IMPORTABLE_DIRECTORIES = new Set(['references', 'examples', 'agents', 'steps']);
const IMPORTABLE_TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.yaml', '.yml']);
const BLOCKING_PATTERNS: Array<{ code: SkillContentScanIssue['code']; regex: RegExp; message: string }> = [
  {
    code: 'unsafe-pattern',
    regex: /\brm\s+-rf\s+\/(?:\s|$)/i,
    message: 'Comando destrutivo de remocao total detectado.',
  },
  {
    code: 'unsafe-pattern',
    regex: /\bRemove-Item\s+-Recurse\s+-Force\s+(?:[A-Za-z]:\\|\/)/i,
    message: 'Comando destrutivo de PowerShell detectado.',
  },
  {
    code: 'unsafe-pattern',
    regex: /\b(?:steal|exfiltrat\w*|harvest|dump)\b[\s\S]{0,80}\b(?:credential|token|cookie|password|secret|api[_ -]?key)s?\b/i,
    message: 'Padrao explicito de exfiltracao ou roubo de credenciais detectado.',
  },
  {
    code: 'unsafe-pattern',
    regex: /\b(?:keylogger|ransomware|credential\s+stuffing|phishing\s+kit)\b/i,
    message: 'Conteudo ofensivo de alto risco detectado.',
  },
  {
    code: 'unsafe-pattern',
    regex: /\b(?:disable|turn off)\b[\s\S]{0,40}\b(?:defender|antivirus|security)\b/i,
    message: 'Instrucao para desabilitar controles de seguranca detectada.',
  },
];

export class SkillContentScannerService {
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readdirSyncImpl: typeof fs.readdirSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly lstatSyncImpl: typeof fs.lstatSync;
  private readonly statSyncImpl: typeof fs.statSync;

  constructor(runtime: SkillContentScannerRuntime = {}) {
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readdirSyncImpl = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.lstatSyncImpl = runtime.lstatSync || fs.lstatSync.bind(fs);
    this.statSyncImpl = runtime.statSync || fs.statSync.bind(fs);
  }

  public scanSkillDirectory(skillDirPath: string): SkillContentScanResult {
    const issues: SkillContentScanIssue[] = [];
    const importableFiles: string[] = [];
    const skippedFiles: string[] = [];

    const skillFilePath = path.join(skillDirPath, 'SKILL.md');
    if (!this.existsSyncImpl(skillFilePath)) {
      issues.push({
        severity: 'error',
        code: 'missing-entrypoint',
        filePath: skillFilePath,
        relativePath: 'SKILL.md',
        message: 'Skill sem SKILL.md nao pode ser importada.',
      });
      return {
        safeToImport: false,
        issues,
        importableFiles,
        skippedFiles,
      };
    }

    for (const filePath of this.collectFiles(skillDirPath)) {
      const relativePath = path.relative(skillDirPath, filePath).replace(/\\/g, '/');
      const importable = this.isImportableFile(relativePath);
      if (!importable) {
        skippedFiles.push(relativePath);
        continue;
      }

      if (this.isSymbolicLink(filePath)) {
        issues.push({
          severity: 'warn',
          code: 'symlink-file',
          filePath,
          relativePath,
          message: 'Symlink ignorado para impedir leitura ou copia fora da skill.',
        });
        skippedFiles.push(relativePath);
        continue;
      }

      if (!this.isTextLikeFile(filePath)) {
        issues.push({
          severity: 'warn',
          code: 'binary-like-file',
          filePath,
          relativePath,
          message: 'Arquivo nao textual ignorado no intake seletivo.',
        });
        skippedFiles.push(relativePath);
        continue;
      }

      const content = this.readFileSyncImpl(filePath, 'utf8');
      const match = BLOCKING_PATTERNS.find((pattern) => pattern.regex.test(content));
      if (match) {
        issues.push({
          severity: 'error',
          code: match.code,
          filePath,
          relativePath,
          message: match.message,
        });
        continue;
      }

      importableFiles.push(relativePath);
    }

    return {
      safeToImport: !issues.some((issue) => issue.severity === 'error'),
      issues,
      importableFiles: importableFiles.sort((left, right) => left.localeCompare(right, 'en-US')),
      skippedFiles: skippedFiles.sort((left, right) => left.localeCompare(right, 'en-US')),
    };
  }

  private collectFiles(rootPath: string): string[] {
    const collected: string[] = [];
    const entries = this.readdirSyncImpl(rootPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(rootPath, entry.name);
      if (entry.isDirectory()) {
        collected.push(...this.collectFiles(entryPath));
        continue;
      }
      collected.push(entryPath);
    }

    return collected;
  }

  private isImportableFile(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    if (!normalized) {
      return false;
    }

    if (!normalized.includes('/')) {
      return IMPORTABLE_ROOT_FILES.has(normalized);
    }

    const [topLevel] = normalized.split('/');
    if (!IMPORTABLE_DIRECTORIES.has(topLevel)) {
      return false;
    }

    return IMPORTABLE_TEXT_EXTENSIONS.has(path.extname(normalized).toLowerCase());
  }

  private isTextLikeFile(filePath: string): boolean {
    try {
      const stat = this.statSyncImpl(filePath);
      if (!stat.isFile()) {
        return false;
      }
      if (stat.size > 2 * 1024 * 1024) {
        return false;
      }
      const ext = path.extname(filePath).toLowerCase();
      return IMPORTABLE_TEXT_EXTENSIONS.has(ext);
    } catch {
      return false;
    }
  }

  private isSymbolicLink(filePath: string): boolean {
    try {
      return this.lstatSyncImpl(filePath).isSymbolicLink();
    } catch {
      return true;
    }
  }
}
