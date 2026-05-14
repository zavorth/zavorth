import type { EchoAgentSurfaceState } from './EchoClientService.js';

/**
 * Lightweight visual feedback bridge for the local agent.
 *
 * The overlay only presents data returned by public Echo contracts. It does
 * not own approvals, history, policy, routing, or lifecycle state.
 */
export class OverlayService {
  private notifier: any = null;

  constructor() {
    void this.loadNotifier();
  }

  private async loadNotifier(): Promise<void> {
    try {
      this.notifier = await import('node-notifier');
    } catch {
      console.log('[Overlay] node-notifier unavailable. Console feedback only.');
    }
  }

  public async showListening(activationMode: string): Promise<void> {
    console.log(`\n  ZAVORTH ECHO - Ouvindo... [${activationMode}]`);
    console.log('  ----------------------------------------');
    console.log('  Fale seu comando...\n');

    await this.notify({
      title: 'Zavorth Echo',
      message: `Ouvindo... (${activationMode})`,
      icon: this.getIconPath(),
    });
  }

  public async showProcessing(transcript: string): Promise<void> {
    console.log(`  Processando: "${transcript}"`);
    console.log('  Consultando o backend Echo...\n');
  }

  public async showResult(response: string, success: boolean, durationMs?: number): Promise<void> {
    const status = success ? 'OK' : 'ERRO';
    const timing = durationMs ? ` | ${durationMs}ms` : '';

    console.log(`  [${status}] ${response}${timing}`);
    console.log('  ----------------------------------------\n');

    await this.notify({
      title: success ? 'Zavorth - Executado' : 'Zavorth - Erro',
      message: `${this.truncate(response, 200)}${timing}`,
      icon: this.getIconPath(),
    });
  }

  public async showStatus(title: string, message: string): Promise<void> {
    console.log(`  [${title}] ${message}`);

    await this.notify({ title, message, icon: this.getIconPath() });
  }

  public async showEchoSurfaceState(state: EchoAgentSurfaceState): Promise<void> {
    const summary = state.summary;
    const latest = state.recentHistory[0] || null;
    const pendingPreview = state.pendingPermissions
      .slice(0, 2)
      .map((permission) => {
        const target = permission.toolName || permission.action || permission.id;
        return `${target} (${this.shortId(permission.approvalId)})`;
      });

    console.log('\n  ZAVORTH ECHO - Agent Surface State');
    console.log(`  Surface: ${state.context.surface} | Session: ${this.shortId(state.context.sessionId)} | RequestedBy: ${state.context.requestedBy}`);
    console.log(`  Approvals pendentes: ${summary.pendingApprovals}`);
    if (pendingPreview.length > 0) {
      console.log(`  Pendencias: ${pendingPreview.join(' | ')}`);
    }
    if (latest) {
      console.log(`  Ultimo run: ${this.shortId(latest.runId)} | ${latest.status} | ${latest.durationMs || 0}ms`);
      if (summary.lastCapabilityStatus) {
        console.log(`  Capability: ${summary.lastCapabilityStatus}`);
      }
      console.log(`  Prompt: ${this.truncate(latest.prompt, 120)}`);
      console.log(`  Resposta: ${this.truncate(latest.finalResponse, 160)}`);
    } else {
      console.log('  Historico: nenhum run recente retornado pelo Echo.');
    }
    if (state.recentPhysicalEvents.length > 0) {
      const latestPhysicalEvent = state.recentPhysicalEvents[0];
      console.log(`  IoT: ${latestPhysicalEvent.severity.toUpperCase()} | ${this.truncate(latestPhysicalEvent.feedback, 140)}`);
    }
    console.log('');

    const message = [
      `${summary.pendingApprovals} approval(s) pendente(s)`,
      latest ? `ultimo run ${this.shortId(latest.runId)} ${latest.status}` : 'sem runs recentes',
      summary.lastCapabilityStatus ? `capability ${summary.lastCapabilityStatus}` : '',
      summary.lastPhysicalFeedback ? `iot ${this.truncate(summary.lastPhysicalFeedback, 60)}` : '',
    ].filter((entry) => entry.length > 0).join(' | ');

    await this.notify({
      title: 'Zavorth Echo - Agent',
      message,
      icon: this.getIconPath(),
    });
  }

  private async notify(options: { title: string; message: string; icon?: string }): Promise<void> {
    if (!this.notifier) return;

    try {
      const notifier = this.notifier.default || this.notifier;
      notifier.notify({
        title: options.title,
        message: options.message,
        icon: options.icon,
        sound: false,
        wait: false,
        appID: 'Zavorth Agent',
      });
    } catch {
      // Notifications are best-effort.
    }
  }

  private getIconPath(): string | undefined {
    return undefined;
  }

  private shortId(value: string | null | undefined): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return '-';
    }
    return normalized.length <= 12 ? normalized : `${normalized.slice(0, 8)}...`;
  }

  private truncate(value: string | null | undefined, maxLength: number): string {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '-';
    }
    return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
  }
}
