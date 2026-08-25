import { logger } from '../logger.js';
import { ExecutionRequest, ExecutionResult } from '../contracts/ExecutionContract.js';
import { GeminiProvider } from '../providers/GeminiProvider.js';
import { DangerousCommandBlocker } from '../security/DangerousCommandBlocker.js';

export class SelfHealingService {
  private llm: GeminiProvider;

  constructor() {
    this.llm = new GeminiProvider();
  }

  public async analyzeAndProposeFix(
    request: ExecutionRequest,
    failedResult: ExecutionResult,
    osPlatform: NodeJS.Platform = process.platform,
  ): Promise<string | null> {
    try {
      const errorLog =
        failedResult.stderr ||
        failedResult.error_message ||
        failedResult.stdout ||
        'unknown error.';

      const prompt = [
        `O Zavorth tentou run um comando no ambiente (${request.executor}) mas failed.`,
        `Sistema Operacional: ${osPlatform}`,
        `Workspace: ${request.workspace}`,
        '',
        '=== OBJETIVO ORIGINAL ===',
        request.objective,
        '',
        '=== INSTRUCOES TENTADAS ===',
        request.instructions.join('\n'),
        '',
        '=== error RETORNADO (STDERR) ===',
        errorLog,
        '',
        'You e o modulo de Auto-Correcao (Self-Healing) do Zavorth.',
        'Your mission: provide ONE terminal command (Bash for Linux/WSL, or PowerShell for Windows) that fixes this environment issue or installs the missing dependency.',
        'If the error cannot be fixed by a simple command, or requires human interaction, answer only with "UNFIXABLE".',
        '',
        'REGRAS:',
        '1. Respond only with the raw command. No markdown formatting, no backticks, no explanatory text.',
        '2. The command must be safe and non-interactive (use -y or --force if installing).',
        '3. If it cannot be fixed, say UNFIXABLE.',
        '4. Do not use command chains, pipes, redirects, shell heredoc, or multiple steps.',
      ].join('\n');

      const response = await this.llm.chat([{ role: 'user', content: prompt }]);
      let output = (response.content || '').trim();

      if (!output || /UNFIXABLE/i.test(output)) {
        return null;
      }

      output = this.extractCommand(output);
      if (!this.isSafeProposedCommand(output)) {
        return null;
      }

      return output;
    } catch (error: unknown) {logger.error('Failure in SelfHealingService:', error);
      return null;
    }
  }

  private extractCommand(output: string): string {
    const fencedMatch = output.match(/```(?:[a-z0-9_-]+)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim();
    }

    const withoutFences = output
      .replace(/```(?:[a-z0-9_-]+)?/gi, '')
      .replace(/```/g, '')
      .trim();

    const lines = withoutFences
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const commandLike = lines.find((line) => this.looksLikeCommand(line));
    if (commandLike) {
      return commandLike;
    }

    return withoutFences;
  }

  private looksLikeCommand(line: string): boolean {
    if (!line) {
      return false;
    }

    if (/^(aqui\s+is|segue|comando:|explanation:|note:|observation:)/i.test(line)) {
      return false;
    }

    return (
      /^(npm|pnpm|yarn|node|npx|git|bash|sh|pwsh|powershell|python|pip|apt|apt-get|brew|winget|choco|docker|wsl|mkdir|rm|mv|cp|sed|echo|cat|chmod|chown|curl|wget)\b/i.test(
        line,
      ) || /[><|&;]/.test(line)
    );
  }

  private isSafeProposedCommand(command: string): boolean {
    const trimmed = String(command || '').trim();
    if (!trimmed) {
      return false;
    }

    if (/[\r\n]/.test(trimmed)) {
      return false;
    }

    if (/&&|\|\||[;|><`]/.test(trimmed)) {
      return false;
    }

    return DangerousCommandBlocker.isSafe(trimmed);
  }
}
