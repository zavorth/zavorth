import path from 'path';
import { config } from '../config/index.js';

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

// Patterns and constants for risk evaluation
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
 * McpSecurityGuard — Avalia o risco de seguranca de um servidor MCP
 * antes da instalacao. Nenhuma decisao e tomada automaticamente;
 * o resultado e apresentado ao usuario para aprovacao.
 */
export class McpSecurityGuard {
  /**
   * Avalia o risco de instalar um servidor MCP com os parametros dados.
   * Retorna um objeto de assessment detalhado para apresentacao ao usuario.
   */
  public assess(input: McpSecurityInput): McpRiskAssessment {
    const reasons: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    // 1. Avaliacao do comando principal
    riskScore += this.assessCommand(input.command, reasons, recommendations);

    // 2. Avaliacao dos argumentos
    riskScore += this.assessArgs(input.args || [], reasons, recommendations);

    // 3. Avaliacao das variaveis de ambiente
    riskScore += this.assessEnv(input.env || {}, reasons, recommendations);

    // 4. Avaliacao da origem da sugestao
    riskScore += this.assessSource(input.source || 'user', reasons, recommendations);

    // 5. Avaliacao do pacote NPX (se aplicavel)
    riskScore += this.assessNpxPackage(input.command, input.args || [], reasons, recommendations);

    // Normalizar score
    riskScore = Math.max(0, Math.min(100, riskScore));

    const riskLevel = this.scoreToLevel(riskScore);
    const blocked = riskScore >= 90;
    const requiresApproval = true; // Sempre requer aprovacao

    if (blocked) {
      recommendations.push(
        'Este servidor MCP foi bloqueado por apresentar riscos criticos. '
        + 'Revise a configuracao manualmente antes de tentar novamente.',
      );
    }

    return {
      riskLevel,
      riskScore,
      reasons: reasons.length > 0 ? reasons : ['Nenhum risco significativo detectado.'],
      recommendations: recommendations.length > 0
        ? recommendations
        : ['Verifique a documentacao do servidor antes de aprovar.'],
      requiresApproval,
      blocked,
      summary: this.buildSummary(input, riskLevel, riskScore, reasons),
    };
  }

  // -- Avaliadores individuais -----------------------------------------------

  private assessCommand(command: string, reasons: string[], recommendations: string[]): number {
    const normalized = path.basename(command).toLowerCase().replace(/\.(exe|cmd|bat|sh)$/i, '');
    let score = 0;

    if (DANGEROUS_BINARIES.includes(normalized)) {
      score += 40;
      reasons.push(`O comando "${command}" e um binario potencialmente perigoso.`);
      recommendations.push('Verifique se este comando e realmente necessario para o MCP funcionar.');
    }

    if (!KNOWN_SAFE_COMMANDS.includes(normalized) && !normalized.startsWith('npx')) {
      score += 10;
      reasons.push(`O comando "${command}" nao faz parte dos comandos MCP comuns (npx, node, deno, bun).`);
    }

    if (path.isAbsolute(command)) {
      const matchesSensitive = SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(command));
      if (matchesSensitive) {
        score += 25;
        reasons.push(`O caminho "${command}" aponta para uma area sensivel do sistema.`);
      }
    }

    return score;
  }

  private assessArgs(args: string[], reasons: string[], recommendations: string[]): number {
    let score = 0;

    for (const arg of args) {
      // Verifica caminhos sensíveis nos argumentos
      const matchesSensitive = SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(arg));
      if (matchesSensitive) {
        score += 15;
        reasons.push(`O argumento "${arg}" referencia um caminho sensivel.`);
      }

      // Verifica injecao de comandos
      if (/[;&|`$]/.test(arg) && !arg.startsWith('${')) {
        score += 20;
        reasons.push(`O argumento "${arg}" contem caracteres que podem indicar injecao de comandos.`);
        recommendations.push('Revise os argumentos para garantir que nao ha tentativa de encadear comandos.');
      }
    }

    return score;
  }

  private assessEnv(env: Record<string, string>, reasons: string[], recommendations: string[]): number {
    let score = 0;
    const entries = Object.entries(env);

    for (const [key, value] of entries) {
      const isSensitiveKey = SENSITIVE_ENV_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitiveKey) {
        score += 5;
        reasons.push(`A variavel de ambiente "${key}" pode conter dados sensiveis.`);
      }

      // Valores hardcoded de credenciais
      if (isSensitiveKey && value.length > 0 && !value.startsWith('${')) {
        score += 10;
        reasons.push(`A variavel "${key}" parece ter um valor de credencial hardcoded.`);
        recommendations.push(`Use referencias de ambiente (\${env:...}) em vez de valores diretos para "${key}".`);
      }
    }

    return score;
  }

  private assessSource(source: string, reasons: string[], _recommendations: string[]): number {
    if (source === 'agent_suggestion') {
      reasons.push('Este MCP foi sugerido pelo agente, nao pelo usuario diretamente.');
      return 10;
    }
    return 0;
  }

  private assessNpxPackage(command: string, args: string[], reasons: string[], recommendations: string[]): number {
    const isNpx = path.basename(command).toLowerCase().replace(/\.(cmd|exe)$/i, '') === 'npx';
    if (!isNpx) {
      return 0;
    }

    // Encontrar o nome do pacote (pular flags como -y, --yes, -p, etc.)
    const packageArg = args.find((arg) => !arg.startsWith('-') && arg.length > 0);
    if (!packageArg) {
      reasons.push('Comando npx sem pacote identificavel.');
      return 15;
    }

    let score = 0;

    // Verificar se e de um escopo confiavel
    const isTrustedScope = TRUSTED_SCOPES.some((scope) => packageArg.startsWith(scope));
    if (isTrustedScope) {
      reasons.push(`O pacote "${packageArg}" pertence a um escopo confiavel.`);
      score -= 5; // bonus de confianca
    } else {
      reasons.push(
        `O pacote "${packageArg}" nao pertence a um escopo oficial conhecido `
        + '(@modelcontextprotocol, @anthropic, @google, etc.).',
      );
      score += 10;
      recommendations.push(
        `Verifique a pagina do pacote "${packageArg}" no npm antes de aprovar: `
        + `https://www.npmjs.com/package/${encodeURIComponent(packageArg)}`,
      );
    }

    return Math.max(0, score);
  }

  // -- Utilitarios -----------------------------------------------------------

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
      `Avaliacao de seguranca para servidor MCP "${input.id}"`,
      `Risco: ${riskLevel.toUpperCase()} (score ${riskScore}/100)`,
      `Comando: ${input.command} ${(input.args || []).join(' ')}`,
      '',
      'Fatores avaliados:',
      ...reasons.map((reason) => `  - ${reason}`),
    ];
    return lines.join('\n');
  }
}
