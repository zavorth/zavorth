import path from 'path';

export type McpRiskAssessment = {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  reasons: string[];
  recommendations: string[];
  requiresApproval: boolean;
  blocked: boolean;
  summary: string;
};

export type McpSecurityInput = {
  id: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  capability?: string;
  source?: 'user' | 'agent_suggestion' | 'manifest_import';
};

const DANGEROUS_BINARIES = [
  'rm', 'del', 'format', 'fdisk', 'mkfs', 'dd',
  'curl', 'wget', 'powershell', 'cmd', 'bash',
  'ssh', 'scp', 'rsync', 'nc', 'ncat', 'netcat',
];

const SENSITIVE_PATH_PATTERNS = [
  /system32/i,
  /\/etc\//i,
  /\/root\//i,
  /\\windows\\/i,
  /\.ssh/i,
  /\.gnupg/i,
  /\.aws/i,
  /\.kube/i,
  /\.env/i,
  /private[_-]?key/i,
  /credentials/i,
];

const SENSITIVE_ENV_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /private[_-]?key/i,
  /credential/i,
];

const TRUSTED_SCOPES = [
  '@modelcontextprotocol/',
  '@anthropic/',
  '@google/',
  '@openai/',
  '@microsoft/',
  '@github/',
];

const KNOWN_SAFE_COMMANDS = ['npx', 'npx.cmd', 'node', 'node.exe', 'deno', 'bun'];

/**
 * Evaluates MCP server install risk before installation.
 * No decision is made automatically; the assessment is presented for approval.
 */
export class McpSecurityGuard {
  public assess(input: McpSecurityInput): McpRiskAssessment {
    const reasons: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    riskScore += this.assessCommand(input.command, reasons, recommendations);
    riskScore += this.assessArgs(input.args || [], reasons, recommendations);
    riskScore += this.assessEnv(input.env || {}, reasons, recommendations);
    riskScore += this.assessSource(input.source || 'user', reasons);
    riskScore += this.assessNpxPackage(input.command, input.args || [], reasons, recommendations);

    riskScore = Math.max(0, Math.min(100, riskScore));

    const riskLevel = this.scoreToLevel(riskScore);
    const blocked = riskScore >= 90;

    if (blocked) {
      recommendations.push(
        'This MCP server was blocked because it presents critical risks. '
        + 'Review the configuration manually before trying again.',
      );
    }

    return {
      riskLevel,
      riskScore,
      reasons: reasons.length > 0 ? reasons : ['No significant risk detected.'],
      recommendations: recommendations.length > 0
        ? recommendations
        : ['Review the server documentation before approving.'],
      requiresApproval: true,
      blocked,
      summary: this.buildSummary(input, riskLevel, riskScore, reasons),
    };
  }

  private assessCommand(command: string, reasons: string[], recommendations: string[]): number {
    const normalized = path.basename(command).toLowerCase().replace(/\.(exe|cmd|bat|sh)$/i, '');
    let score = 0;

    if (DANGEROUS_BINARIES.includes(normalized)) {
      score += 40;
      reasons.push(`Command "${command}" is a potentially dangerous binary.`);
      recommendations.push('Verify that this command is really required for the MCP server to work.');
    }

    if (!KNOWN_SAFE_COMMANDS.includes(normalized) && !normalized.startsWith('npx')) {
      score += 10;
      reasons.push(`Command "${command}" is not one of the common MCP commands (npx, node, deno, bun).`);
    }

    if (path.isAbsolute(command)) {
      const matchesSensitive = SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(command));
      if (matchesSensitive) {
        score += 25;
        reasons.push(`Path "${command}" points to a sensitive system area.`);
      }
    }

    return score;
  }

  private assessArgs(args: string[], reasons: string[], recommendations: string[]): number {
    let score = 0;

    for (const arg of args) {
      const matchesSensitive = SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(arg));
      if (matchesSensitive) {
        score += 15;
        reasons.push(`Argument "${arg}" references a sensitive path.`);
      }

      if (/[;&|`$]/.test(arg) && !arg.startsWith('${')) {
        score += 20;
        reasons.push(`Argument "${arg}" contains characters that may indicate command injection.`);
        recommendations.push('Review the arguments to ensure there is no attempt to chain commands.');
      }
    }

    return score;
  }

  private assessEnv(env: Record<string, string>, reasons: string[], recommendations: string[]): number {
    let score = 0;

    for (const [key, value] of Object.entries(env)) {
      const isSensitiveKey = SENSITIVE_ENV_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitiveKey) {
        score += 5;
        reasons.push(`Environment variable "${key}" may contain sensitive data.`);
      }

      if (isSensitiveKey && value.length > 0 && !value.startsWith('${')) {
        score += 10;
        reasons.push(`Variable "${key}" appears to contain a hardcoded credential value.`);
        recommendations.push(`Use environment references (\${env:...}) instead of direct values for "${key}".`);
      }
    }

    return score;
  }

  private assessSource(source: string, reasons: string[]): number {
    if (source === 'agent_suggestion') {
      reasons.push('This MCP server was suggested by the agent, not directly by the user.');
      return 10;
    }
    return 0;
  }

  private assessNpxPackage(command: string, args: string[], reasons: string[], recommendations: string[]): number {
    const isNpx = path.basename(command).toLowerCase().replace(/\.(cmd|exe)$/i, '') === 'npx';
    if (!isNpx) {
      return 0;
    }

    const packageArg = args.find((arg) => !arg.startsWith('-') && arg.length > 0);
    if (!packageArg) {
      reasons.push('npx command has no identifiable package.');
      return 15;
    }

    let score = 0;
    const isTrustedScope = TRUSTED_SCOPES.some((scope) => packageArg.startsWith(scope));
    if (isTrustedScope) {
      reasons.push(`Package "${packageArg}" belongs to a trusted scope.`);
      score -= 5;
    } else {
      reasons.push(
        `Package "${packageArg}" does not belong to a known official scope `
        + '(@modelcontextprotocol, @anthropic, @google, etc.).',
      );
      score += 10;
      recommendations.push(
        `Review the npm page for package "${packageArg}" before approving: `
        + `https://www.npmjs.com/package/${encodeURIComponent(packageArg)}`,
      );
    }

    return Math.max(0, score);
  }

  private scoreToLevel(score: number): McpRiskAssessment['riskLevel'] {
    if (score >= 70) return 'critical';
    if (score >= 40) return 'high';
    if (score >= 20) return 'medium';
    return 'low';
  }

  private buildSummary(
    input: McpSecurityInput,
    riskLevel: string,
    riskScore: number,
    reasons: string[],
  ): string {
    const lines = [
      `Security assessment for MCP server "${input.id}"`,
      `Risk: ${riskLevel.toUpperCase()} (score ${riskScore}/100)`,
      `Command: ${input.command} ${(input.args || []).join(' ')}`,
      '',
      'Evaluated factors:',
      ...reasons.map((reason) => `  - ${reason}`),
    ];
    return lines.join('\n');
  }
}
