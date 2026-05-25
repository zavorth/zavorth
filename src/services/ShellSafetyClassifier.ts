import path from 'node:path';
import type {
  ShellSafetyReceipt,
} from '../contracts/SourceMemoryDocumentTerminalPackContract.js';

type Runtime = {
  now?: () => Date;
  allowedRoots?: string[];
  treeSitterAvailable?: boolean;
};

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; hazard: string }> = [
  { pattern: /\brm\s+(-[a-z]*r[a-z]*f|-rf|-fr)\b/i, hazard: 'recursive-force-delete' },
  { pattern: /\bremove-item\b[\s\S]*\b-recurse\b[\s\S]*\b-force\b/i, hazard: 'powershell-recursive-force-delete' },
  { pattern: /\bdel\b[\s\S]*\/s\b/i, hazard: 'recursive-delete' },
  { pattern: /\bgit\s+reset\s+--hard\b/i, hazard: 'git-hard-reset' },
  { pattern: /\bgit\s+clean\b[\s\S]*-[a-z]*f/i, hazard: 'git-force-clean' },
  { pattern: /\bformat\b\s+[a-z]:/i, hazard: 'disk-format' },
  { pattern: /\bshutdown\b|\breboot\b|\bstop-computer\b/i, hazard: 'machine-power-action' },
  { pattern: /\bset-executionpolicy\b/i, hazard: 'execution-policy-change' },
  { pattern: /\b(?:curl|wget|irm|iwr)\b[\s\S]*\|\s*(?:sh|bash|powershell|pwsh|iex|invoke-expression)\b/i, hazard: 'download-pipe-execute' },
  { pattern: /\bnpm\s+publish\b|\bpnpm\s+publish\b|\byarn\s+npm\s+publish\b/i, hazard: 'package-publish' },
];

const ATTENTION_PATTERNS: Array<{ pattern: RegExp; hazard: string }> = [
  { pattern: /[;&|]{1,2}/, hazard: 'shell-control-operator' },
  { pattern: />{1,2}\s*\S+/, hazard: 'file-redirection' },
  { pattern: /\bmove-item\b|\bmv\b|\bcopy-item\b|\bcp\b/i, hazard: 'filesystem-mutation' },
  { pattern: /\bnpm\s+install\b|\bpnpm\s+add\b|\byarn\s+add\b/i, hazard: 'dependency-mutation' },
  { pattern: /\bgit\s+push\b|\bgh\s+pr\b|\bgh\s+release\b/i, hazard: 'remote-mutation' },
];

export class ShellSafetyClassifier {
  private readonly now: () => Date;
  private readonly allowedRoots: string[];
  private readonly treeSitterAvailableOverride?: boolean;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.allowedRoots = (runtime.allowedRoots || [process.cwd()]).map((root) => path.resolve(root));
    this.treeSitterAvailableOverride = runtime.treeSitterAvailable;
  }

  public classify(input: {
    command: string;
    cwd?: string | null;
    approvalId?: string | null;
  }): ShellSafetyReceipt {
    const command = String(input.command || '').trim();
    const cwd = path.resolve(input.cwd || process.cwd());
    const cwdAllowed = isWithinRoots(cwd, this.allowedRoots);
    const treeSitterAvailable = this.treeSitterAvailableOverride ?? hasTreeSitter();
    const hazards = [
      ...DANGEROUS_PATTERNS.filter((entry) => entry.pattern.test(command)).map((entry) => entry.hazard),
      ...ATTENTION_PATTERNS.filter((entry) => entry.pattern.test(command)).map((entry) => entry.hazard),
    ];
    const dangerous = DANGEROUS_PATTERNS.some((entry) => entry.pattern.test(command));
    const attention = ATTENTION_PATTERNS.some((entry) => entry.pattern.test(command));
    const blocked = !command || !cwdAllowed || dangerous;
    const level = blocked ? (dangerous || !command ? 'blocked' : 'dangerous') : attention ? 'attention' : 'safe';
    const approvalRequired = blocked || attention;

    return {
      id: `credential-vault.shell-safety.${hashText(`${command}:${cwd}:${this.now().toISOString()}`)}`,
      command,
      level,
      approvalRequired,
      blocked,
      cwdAllowed,
      hazards: [...new Set(hazards)],
      shellParser: treeSitterAvailable ? 'tree-sitter-bash-available' : 'zavorth-token-classifier',
      treeSitterAvailable,
      reason: reasonFor({ command, cwdAllowed, dangerous, attention, approvalRequired }),
    };
  }
}

function reasonFor(input: {
  command: string;
  cwdAllowed: boolean;
  dangerous: boolean;
  attention: boolean;
  approvalRequired: boolean;
}): string {
  if (!input.command) return 'Command is empty.';
  if (!input.cwdAllowed) return 'Command cwd is outside the configured roots.';
  if (input.dangerous) return 'Command contains a dangerous shell pattern and is blocked until explicit owner approval changes policy.';
  if (input.attention) return 'Command contains mutation/dashboard operators and requires explicit approval.';
  if (input.approvalRequired) return 'Command requires approval.';
  return 'Command is classified as safe within the configured cwd roots.';
}

function isWithinRoots(candidate: string, roots: string[]): boolean {
  const resolved = path.resolve(candidate);
  return roots.some((root) => {
    const relative = path.relative(path.resolve(root), resolved);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  });
}

function hasTreeSitter(): boolean {
  try {
    require.resolve('tree-sitter-bash');
    return true;
  } catch {
    try {
      require.resolve('web-tree-sitter');
      return true;
    } catch {
      return false;
    }
  }
}

function hashText(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
