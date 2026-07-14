import type {
  EngineeringIntent,
  EngineeringIntentRequest,
} from '../contracts/EngineeringCoreContract.js';

export class EngineeringIntentService {
  public parse(request: EngineeringIntentRequest): EngineeringIntent | null {
    const rawText = String(request.rawText || '').trim();
    if (!rawText) {
      return null;
    }

    if (this.looksLikeNextStep(rawText)) {
      return {
        kind: 'next_step',
        objective: rawText,
        mutating: false,
        requiresSession: false,
        preferredProfile: 'safe',
        workspaceHint: request.workspaceHint || null,
        suggestedCommands: [],
      };
    }

    if (this.looksLikeUndo(rawText)) {
      return {
        kind: 'undo_change',
        objective: rawText,
        mutating: true,
        requiresSession: false,
        preferredProfile: 'trusted',
        workspaceHint: request.workspaceHint || null,
        suggestedCommands: [],
      };
    }

    const overlordIntent = this.parseSystemOverlordIntent(request, rawText);
    if (overlordIntent) {
      return overlordIntent;
    }

    if (this.looksLikeInstallAndRetry(rawText)) {
      return {
        kind: 'install_and_retry',
        objective: rawText,
        mutating: true,
        requiresSession: true,
        preferredProfile: 'trusted',
        workspaceHint: request.workspaceHint || null,
        suggestedCommands: ['npm install', 'npm test'],
      };
    }

    if (this.looksLikeDiagnoseBuild(rawText)) {
      return {
        kind: 'diagnose_build',
        objective: rawText,
        mutating: false,
        requiresSession: true,
        preferredProfile: 'safe',
        workspaceHint: request.workspaceHint || null,
        suggestedCommands: ['npm run build', 'npm test'],
      };
    }

    if (this.looksLikeProjectBootstrap(rawText)) {
      return {
        kind: 'create_project',
        objective: rawText,
        mutating: true,
        requiresSession: true,
        preferredProfile: 'trusted',
        workspaceHint: request.workspaceHint || null,
        suggestedCommands: ['npm init -y'],
      };
    }

    if (this.looksLikeGenericEngineering(rawText)) {
      const mutating = this.looksMutating(rawText);
      return {
        kind: 'generic_engineering',
        objective: rawText,
        mutating,
        requiresSession: mutating || /(build|teste|debug|erro|task|patch)/i.test(rawText),
        preferredProfile: mutating ? 'trusted' : 'safe',
        workspaceHint: request.workspaceHint || null,
        suggestedCommands: [],
      };
    }

    return null;
  }

  private parseSystemOverlordIntent(
    request: EngineeringIntentRequest,
    rawText: string,
  ): EngineeringIntent | null {
    const tunnelIntent = this.parseTunnelIntent(request, rawText);
    if (tunnelIntent) {
      return tunnelIntent;
    }

    const wslIntent = this.parseWslIntent(request, rawText);
    if (wslIntent) {
      return wslIntent;
    }

    const dockerIntent = this.parseDockerIntent(request, rawText);
    if (dockerIntent) {
      return dockerIntent;
    }

    const browserIntent = this.parseBrowserIntent(request, rawText);
    if (browserIntent) {
      return browserIntent;
    }

    return null;
  }

  private parseBrowserIntent(
    request: EngineeringIntentRequest,
    rawText: string,
  ): EngineeringIntent | null {
    if (!/(abra|abrir|abre|navegue|navegar|acesse|acessar|open).*(navegador|browser|site|pagina|p[aá]gina|url)/i.test(rawText)) {
      return null;
    }
    const url = this.extractUrl(rawText);
    if (!url) {
      return null;
    }
    return {
      kind: 'system_overlord_operation',
      objective: rawText,
      mutating: true,
      requiresSession: false,
      preferredProfile: 'dangerous',
      preferredCapability: 'browser.control',
      preferredAutonomyLevel: 5,
      workspaceHint: request.workspaceHint || null,
      suggestedCommands: [
        JSON.stringify({
          action: 'navigate',
          url,
        }),
      ],
    };
  }

  private parseTunnelIntent(
    request: EngineeringIntentRequest,
    rawText: string,
  ): EngineeringIntent | null {
    if (!/(t[uú]nel|tunel|publica|publique|exponha|expor|tunnel|cloudflare|ngrok)/i.test(rawText)) {
      return null;
    }
    const targetUrl = this.extractUrl(rawText);
    const payload: Record<string, unknown> = {
      action: 'start',
    };
    if (targetUrl) {
      payload.targetUrl = targetUrl;
    }
    return {
      kind: 'system_overlord_operation',
      objective: rawText,
      mutating: true,
      requiresSession: false,
      preferredProfile: 'dangerous',
      preferredCapability: 'network.tunnel',
      preferredAutonomyLevel: 4,
      workspaceHint: request.workspaceHint || null,
      suggestedCommands: [JSON.stringify(payload)],
    };
  }

  private parseWslIntent(
    request: EngineeringIntentRequest,
    rawText: string,
  ): EngineeringIntent | null {
    if (!/\b(wsl|ubuntu)\b/i.test(rawText)) {
      return null;
    }
    const command = this.extractInlineCommand(rawText);
    if (!command) {
      return null;
    }
    const distribution = this.extractWslDistribution(rawText);
    const payload: Record<string, unknown> = {
      action: 'exec',
      command: 'bash',
      args: ['-lc', command],
    };
    if (distribution) {
      payload.distribution = distribution;
    }
    return {
      kind: 'system_overlord_operation',
      objective: rawText,
      mutating: true,
      requiresSession: false,
      preferredProfile: 'trusted',
      preferredCapability: 'wsl.exec',
      preferredAutonomyLevel: 4,
      workspaceHint: request.workspaceHint || null,
      suggestedCommands: [JSON.stringify(payload)],
    };
  }

  private parseDockerIntent(
    request: EngineeringIntentRequest,
    rawText: string,
  ): EngineeringIntent | null {
    if (!/\b(docker|container|cont[aê]iner)\b/i.test(rawText)) {
      return null;
    }
    const command = this.extractInlineCommand(rawText);
    const container = this.extractDockerContainer(rawText);
    if (!command || !container) {
      return null;
    }
    return {
      kind: 'system_overlord_operation',
      objective: rawText,
      mutating: true,
      requiresSession: false,
      preferredProfile: 'trusted',
      preferredCapability: 'docker.exec',
      preferredAutonomyLevel: 3,
      workspaceHint: request.workspaceHint || null,
      suggestedCommands: [
        JSON.stringify({
          action: 'exec',
          container,
          command: 'bash',
          args: ['-lc', command],
        }),
      ],
    };
  }

  private extractUrl(text: string): string | null {
    const match = String(text || '').match(/https?:\/\/[^\s'"]+/i);
    return match ? match[0] : null;
  }

  private extractInlineCommand(text: string): string | null {
    const quotedMatch = String(text || '').match(/["“](.+?)["”]/);
    if (quotedMatch?.[1]) {
      return quotedMatch[1].trim();
    }
    const backtickMatch = String(text || '').match(/`([^`]+)`/);
    if (backtickMatch?.[1]) {
      return backtickMatch[1].trim();
    }
    const colonMatch = String(text || '').match(/:\s*(.+)$/);
    if (colonMatch?.[1]) {
      return colonMatch[1].trim();
    }
    const naturalMatch = String(text || '').match(/\b(?:rode|rodar|executa|execute|run)\b.*?\b(?:wsl|ubuntu|docker|container|cont[aê]iner)\b\s+(.+)$/i);
    return naturalMatch?.[1]?.trim() || null;
  }

  private extractWslDistribution(text: string): string | null {
    const match = String(text || '').match(/\b(ubuntu(?:-[0-9.]+)?|debian|kali|opensuse)\b/i);
    return match?.[1] ? match[1] : null;
  }

  private extractDockerContainer(text: string): string | null {
    const match = String(text || '').match(/\b(?:container|cont[aê]iner)\s+([a-z0-9._-]+)/i);
    return match?.[1] ? match[1] : null;
  }

  private looksLikeProjectBootstrap(text: string): boolean {
    return /(crie|criar|gere|gerar|monte|montar|bootstrap|inicie|iniciar).*(express|servidor|api|projeto|app|servi[cç]o)/i.test(
      text,
    );
  }

  private looksLikeDiagnoseBuild(text: string): boolean {
    return (
      /(veja|descubra|analise|investigue|debugue|depure).*(build|teste|erro|falha|quebrou|quebrado)/i.test(text)
      || /por que .*?(build|teste).*?(quebrou|falhou)/i.test(text)
      || /(corrija|conserte).*(build|teste|typescript|tsc)/i.test(text)
    );
  }

  private looksLikeInstallAndRetry(text: string): boolean {
    return (
      /(instale|instalar).*(falta|faltando).*(teste|build|rode|rodar)/i.test(text)
      || /(instale what is missing e teste de novo|instala what is missing e testa de novo)/i.test(text)
    );
  }

  private looksLikeNextStep(text: string): boolean {
    return /(o que falta( para continuar)?|o que precisa para continuar|qual o proximo passo)/i.test(text);
  }

  private looksLikeUndo(text: string): boolean {
    return /(desfa[cç]a?|rollback|volte|reverta).*(ultima mudan[cç]a|ultima altera[cç][aã]o|ultimo patch|isso)/i.test(
      text,
    );
  }

  private looksLikeGenericEngineering(text: string): boolean {
    return /(arquivo|codigo|c[oó]digo|repo|repositorio|build|teste|typescript|tsc|npm|pnpm|yarn|depend[êe]ncia|patch|stack trace|servidor|express|bug)/i.test(
      text,
    );
  }

  private looksMutating(text: string): boolean {
    return /(crie|criar|gere|gerar|instale|instalar|corrija|conserte|aplique|edite|mude|altere|adicione|remova)/i.test(
      text,
    );
  }
}
