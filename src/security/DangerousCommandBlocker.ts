export type CommandSafetyDecision = {
  safe: boolean;
  reason: string;
  commandName: string | null;
};

export class DangerousCommandBlocker {
  private static readonly ALLOWED_COMMANDS = new Set([
    'cat',
    'dir',
    'echo',
    'eslint',
    'git',
    'jest',
    'ls',
    'mkdir',
    'node',
    'npm',
    'npx',
    'pnpm',
    'prettier',
    'pwd',
    'tsc',
    'type',
    'vitest',
    'yarn',
  ]);

  private static readonly SHELL_WRAPPERS = new Set([
    'bash',
    'cmd',
    'cmd.exe',
    'powershell',
    'powershell.exe',
    'pwsh',
    'pwsh.exe',
    'sh',
    'wscript',
    'wscript.exe',
  ]);

  private static readonly DANGEROUS_PATTERNS = [
    /\brm(?:\.exe)?\s+.*(?:-[^\s]*r[^\s]*f|-[^\s]*f[^\s]*r)\s+(?:\/|\*|[a-z]:\\?)/i,
    /\bfind(?:\.exe)?\s+(?:\/|[a-z]:\\?)\s+.*\s-delete\b/i,
    /\bdel(?:\.exe)?\s+.*(?:\/s\b|\/q\b).*(?:[a-z]:\\?|\\\\)/i,
    /\bformat(?:\.com|\.exe)?\s+[c-z]:/i,
    /\b(?:shutdown|reboot|halt|poweroff)(?:\.exe)?\b/i,
    /\bsystemctl\s+(?:poweroff|reboot|halt|shutdown)\b/i,
    />\s*\/dev\/(?:sd[a-z]\d*|nvme\d+n\d+|hd[a-z]\d*)/i,
    /\bchmod(?:\.exe)?\s+-R\s+777\s+(?:\/|[a-z]:\\?)/i,
    /\bchown(?:\.exe)?\s+-R\b/i,
    /\breg(?:\.exe)?\s+delete\b/i,
    /\bnetsh\s+advfirewall\s+set\s+allprofiles\s+state\s+off\b/i,
    /\bRemove-Item\b[\s\S]*(?:-Recurse|-r\b)[\s\S]*(?:[a-z]:\\|\/)\b/i,
    /\bcurl(?:\.exe)?\b[\s\S]*\|\s*(?:bash|sh|powershell|pwsh)\b/i,
    /\bwget(?:\.exe)?\b[\s\S]*\|\s*(?:bash|sh|powershell|pwsh)\b/i,
  ];

  private static readonly SHELL_METACHARS = /(?:\|\||&&|[|<>`;]|\$\()/;

  public static isSafe(command: string): boolean {
    return this.explain(command).safe;
  }

  public static explain(command: string): CommandSafetyDecision {
    const normalized = this.normalizeCommand(command);
    if (!normalized) {
      return { safe: false, reason: 'empty-command', commandName: null };
    }

    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(normalized)) {
        return {
          safe: false,
          reason: 'dangerous-pattern',
          commandName: this.extractCommandName(normalized),
        };
      }
    }

    if (this.SHELL_METACHARS.test(normalized)) {
      return {
        safe: false,
        reason: 'shell-composition-requires-sandbox',
        commandName: this.extractCommandName(normalized),
      };
    }

    const commandName = this.extractCommandName(normalized);
    if (!commandName) {
      return { safe: false, reason: 'unknown-command', commandName: null };
    }
    if (this.SHELL_WRAPPERS.has(commandName)) {
      return { safe: false, reason: 'shell-wrapper-requires-sandbox', commandName };
    }
    if (!this.ALLOWED_COMMANDS.has(commandName)) {
      return { safe: false, reason: 'command-not-allowlisted', commandName };
    }

    return { safe: true, reason: 'allowlisted-command', commandName };
  }

  public static validateOrThrow(command: string): void {
    const decision = this.explain(command);
    if (!decision.safe) {
      throw new Error(
        `[SECURITY] Command blocked by allowlist policy (${decision.reason}): '${command}'`,
      );
    }
  }

  private static normalizeCommand(command: string): string {
    return String(command || '')
      .replace(/\u0000/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static extractCommandName(command: string): string | null {
    const match = command.match(/^"([^"]+)"|^'([^']+)'|^([^\s]+)/);
    const raw = (match?.[1] || match?.[2] || match?.[3] || '').trim();
    if (!raw) {
      return null;
    }
    const slashNormalized = raw.replace(/\\/g, '/');
    const basename = slashNormalized.split('/').pop() || slashNormalized;
    return basename.toLowerCase();
  }
}
