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
        'Erro desconhecido.';

      const prompt = [
        `O Zavorth tentou executar um comando no ambiente (${request.executor}) mas falhou.`,
        `Sistema Operacional: ${osPlatform}`,
        `Workspace: ${request.workspace}`,
        '',
        '=== OBJETIVO ORIGINAL ===',
        request.objective,
        '',
        '=== INSTRUCOES TENTADAS ===',
        request.instructions.join('\n'),
        '',
        '=== ERRO RETORNADO (STDERR) ===',
        errorLog,
        '',
        'Voce e o modulo de Auto-Correcao (Self-Healing) do Zavorth.',
        'Sua missao: fornecer UM UNICO comando de terminal (Bash se for Linux/WSL, ou PowerShell se for Windows) que corrija este problema ambiental ou instale a dependencia faltando.',
        'Se o erro nao puder ser corrigido por um simples comando, ou se requerer interacao humana, responda apenas com "UNFIXABLE".',
        '',
        'REGRAS:',
        '1. Responda APENAS com o comando puro. Nenhuma formatacao markdown, nenhuma crase, nenhum texto explicativo.',
        '2. O comando deve ser seguro e nao-interativo (use -y ou --force se for instalacao).',
        '3. Se for impossivel corrigir, diga UNFIXABLE.',
        '4. Nao use cadeia de comandos, pipes, redirects, shell heredoc ou multiplas etapas.',
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
    } catch (error: any) {
      logger.error('Falha no SelfHealingService:', error);
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

    if (/^(aqui\s+esta|segue|comando:|explicacao:|note:|observacao:)/i.test(line)) {
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
