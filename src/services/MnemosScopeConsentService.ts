import * as os from 'os';
import * as path from 'path';

export type MnemosScopeRisk = 'low' | 'medium' | 'high' | 'critical';

export type MnemosScopeProposal = {
  ok: boolean;
  id: string;
  userText: string;
  vaultDir: string;
  scanDirs: string[];
  labels: string[];
  risk: MnemosScopeRisk;
  requiresConfirmation: boolean;
  wholeComputerRequested: boolean;
  warnings: string[];
  nextSafeAction: string;
  enableMnemosArgs: {
    vault_dir: string;
    scan_dirs: string;
    wide_scope_confirmed: boolean;
  };
};

type CreateProposalInput = {
  userText: string;
  vaultDir?: string | null;
  cwd?: string | null;
  homeDir?: string | null;
};

const WHOLE_COMPUTER_PATTERNS = [
  /\b(pc|computer|machine|notebook)\s+(all|entire|whole)\b/i,
  /\b(entire|whole)\s+(pc|computer|machine|disk|drive)\b/i,
];

const CONFIRMATION_PATTERNS: RegExp[] = [];

export class MnemosScopeConsentService {
  public createProposal(input: CreateProposalInput): MnemosScopeProposal {
    const userText = String(input.userText || '').trim();
    const cwd = path.resolve(input.cwd || process.cwd());
    const homeDir = path.resolve(input.homeDir || os.homedir());
    const vaultDir = this.resolvePath(input.vaultDir || path.join(cwd, 'data', 'mnemos_vault'), cwd, homeDir);
    const wholeComputerRequested = this.isWholeComputerRequest(userText);
    const labels: string[] = [];
    const scanDirs: string[] = [];

    if (wholeComputerRequested) {
      scanDirs.push(this.resolveWholeComputerRoot(homeDir));
      labels.push('whole-computer');
    }

    for (const folder of this.extractCommonFolders(userText, homeDir)) {
      scanDirs.push(folder.path);
      labels.push(folder.label);
    }

    for (const explicitPath of this.extractExplicitPaths(userText)) {
      scanDirs.push(this.resolvePath(explicitPath, cwd, homeDir));
      labels.push('explicit-path');
    }

    if (scanDirs.length === 0 && /\b(projeto|workspace|repo|repositorio|repository)\b/i.test(userText)) {
      scanDirs.push(cwd);
      labels.push('workspace');
    }

    const uniqueScanDirs = Array.from(new Set(scanDirs.map((entry) => path.resolve(entry))));
    const risk = this.resolveRisk(uniqueScanDirs, wholeComputerRequested);
    const warnings = this.buildWarnings(risk, wholeComputerRequested, uniqueScanDirs);
    const requiresConfirmation = true;

    return {
      ok: uniqueScanDirs.length > 0,
      id: `mnemos-scope:${this.hash([userText, vaultDir, uniqueScanDirs.join(';')].join('|'))}`,
      userText,
      vaultDir,
      scanDirs: uniqueScanDirs,
      labels: Array.from(new Set(labels)),
      risk,
      requiresConfirmation,
      wholeComputerRequested,
      warnings,
      nextSafeAction: uniqueScanDirs.length > 0
        ? 'Show this scope to the user and wait for an explicit approval before enabling Mnemos.'
        : 'Ask the user for an exact folder, for example Documents, Downloads, or an absolute path.',
      enableMnemosArgs: {
        vault_dir: vaultDir,
        scan_dirs: uniqueScanDirs.join(';'),
        wide_scope_confirmed: false,
      },
    };
  }

  public isApprovalText(text: string): boolean {
    return CONFIRMATION_PATTERNS.some((pattern) => pattern.test(String(text || '')));
  }

  public formatProposal(proposal: MnemosScopeProposal): string {
    if (!proposal.ok) {
      return [
        'Mnemos needs an explicit scope.',
        'Specify a folder, such as Documents, Downloads, or an absolute path.',
      ].join('\n');
    }

    const lines = [
      'Mnemos scope proposal',
      '',
      `Vault: ${proposal.vaultDir}`,
      'Scan dirs:',
      ...proposal.scanDirs.map((entry) => `- ${entry}`),
      '',
      `Risk: ${proposal.risk}`,
    ];

    if (proposal.warnings.length > 0) {
      lines.push('', 'Warnings:', ...proposal.warnings.map((warning) => `- ${warning}`));
    }

    lines.push('', 'To continue, the user must explicitly approve this scope.');
    return lines.join('\n');
  }

  private extractCommonFolders(text: string, homeDir: string): Array<{ label: string; path: string }> {
    const folders: Array<{ pattern: RegExp; label: string; path: string }> = [
      { pattern: /\b(downloads?|baixados)\b/i, label: 'downloads', path: path.join(homeDir, 'Downloads') },
      { pattern: /\b(documentos|documents|docs)\b/i, label: 'documents', path: path.join(homeDir, 'Documents') },
      { pattern: /\b(desktop|area de trabalho)\b/i, label: 'desktop', path: path.join(homeDir, 'Desktop') },
      { pattern: /\b(imagens|pictures|fotos)\b/i, label: 'pictures', path: path.join(homeDir, 'Pictures') },
      { pattern: /\b(faculdade|college|university)\b/i, label: 'college', path: path.join(homeDir, 'Documents') },
    ];
    return folders.filter((folder) => folder.pattern.test(text)).map((folder) => ({
      label: folder.label,
      path: folder.path,
    }));
  }

  private extractExplicitPaths(text: string): string[] {
    const matches = new Set<string>();
    const patterns = [
      /([A-Za-z]:\\[^\n\r"'`<>|]+)/g,
      /(\/(?:home|mnt|Users|var|tmp|opt|workspace)\/[^\n\r"'`<>|]+)/g,
    ];
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const value = String(match[1] || '').trim().replace(/[.,;]+$/g, '');
        if (value) matches.add(value);
      }
    }
    return Array.from(matches);
  }

  private isWholeComputerRequest(text: string): boolean {
    return WHOLE_COMPUTER_PATTERNS.some((pattern) => pattern.test(text));
  }

  private resolvePath(value: string, cwd: string, homeDir: string): string {
    const trimmed = String(value || '').trim();
    if (!trimmed) return cwd;
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, homeDir);
    if (path.isAbsolute(expanded)) return path.resolve(expanded);
    return path.resolve(cwd, expanded);
  }

  private resolveWholeComputerRoot(homeDir: string): string {
    return path.parse(homeDir).root || path.parse(process.cwd()).root || '/';
  }

  private resolveRisk(scanDirs: string[], wholeComputerRequested: boolean): MnemosScopeRisk {
    if (wholeComputerRequested || scanDirs.some((entry) => this.isRootLikePath(entry))) return 'critical';
    if (scanDirs.some((entry) => /[\\/]Users?[\\/][^\\/]+$/i.test(entry) || entry === os.homedir())) return 'high';
    if (scanDirs.length > 1) return 'medium';
    return 'low';
  }

  private isRootLikePath(entry: string): boolean {
    const resolved = path.resolve(entry);
    const root = path.parse(resolved).root;
    return resolved.toLowerCase() === root.toLowerCase();
  }

  private buildWarnings(risk: MnemosScopeRisk, wholeComputerRequested: boolean, scanDirs: string[]): string[] {
    const warnings: string[] = [];
    if (wholeComputerRequested || risk === 'critical') {
      warnings.push('Whole-computer search can index private files, credentials, browser exports, financial documents, photos, and unrelated project data.');
      warnings.push('Only continue if the user explicitly confirms after seeing the exact root path.');
    }
    if (risk === 'high') {
      warnings.push('This scope may include many personal files. Prefer Documents, Downloads, or a dedicated college/work folder when possible.');
    }
    if (scanDirs.length > 1) {
      warnings.push('Multiple scan folders increase recall coverage and privacy exposure.');
    }
    return warnings;
  }

  private hash(value: string): string {
    let hash = 5381;
    for (const char of value) {
      hash = ((hash << 5) + hash) + char.charCodeAt(0);
      hash &= 0xffffffff;
    }
    return Math.abs(hash).toString(36);
  }
}
