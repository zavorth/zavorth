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
        requiresSession: mutating,
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
    void request;
    void rawText;
    return null;
  }

  private parseTunnelIntent(
    request: EngineeringIntentRequest,
    rawText: string,
  ): EngineeringIntent | null {
    void request;
    void rawText;
    return null;
  }

  private parseWslIntent(
    request: EngineeringIntentRequest,
    rawText: string,
  ): EngineeringIntent | null {
    void request;
    void rawText;
    return null;
  }

  private parseDockerIntent(
    request: EngineeringIntentRequest,
    rawText: string,
  ): EngineeringIntent | null {
    void request;
    void rawText;
    return null;
  }

  private extractUrl(text: string): string | null {
    const match = String(text || '').match(/https?:\/\/[^\s'"]+/i);
    return match ? match[0] : null;
  }

  private extractInlineCommand(text: string): string | null {
    const backtickMatch = String(text || '').match(/`([^`]+)`/);
    if (backtickMatch?.[1]) {
      return backtickMatch[1].trim();
    }
    const colonMatch = String(text || '').match(/:\s*(.+)$/);
    if (colonMatch?.[1]) {
      return colonMatch[1].trim();
    }
    return null;
  }

  private extractWslDistribution(text: string): string | null {
    void text;
    return null;
  }

  private extractDockerContainer(text: string): string | null {
    void text;
    return null;
  }

  private looksLikeProjectBootstrap(text: string): boolean {
    void text;
    return false;
  }

  private looksLikeDiagnoseBuild(text: string): boolean {
    void text;
    return false;
  }

  private looksLikeInstallAndRetry(text: string): boolean {
    void text;
    return false;
  }

  private looksLikeNextStep(text: string): boolean {
    void text;
    return false;
  }

  private looksLikeUndo(text: string): boolean {
    void text;
    return false;
  }

  private looksLikeGenericEngineering(text: string): boolean {
    void text;
    return false;
  }

  private looksMutating(text: string): boolean {
    void text;
    return false;
  }
}
